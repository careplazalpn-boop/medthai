import { NextResponse } from "next/server";
import pool from "../dbconnection/db"; // ⚠️ ตรวจสอบพาธนำเข้าฐานข้อมูลของคุณว่าตรงหรือไม่

// ทำให้รูปแบบช่วงเวลาเทียบกันได้เสมอ เช่น "08:00 – 09:30" => "8:00-9:30"
// (เหมือน normalizeSlot ฝั่งหน้าเว็บ) ใช้กันกรณีเก็บ time_slot คนละรูปแบบแล้วตรวจเตียงซ้ำไม่เจอ
const normalizeSlot = (slotStr: string) => {
  if (!slotStr) return "";
  let s = String(slotStr).replace(/\s+/g, "").replace(/–/g, "-");
  s = s.replace(/(^|-)0+(\d)/g, "$1$2");
  return s;
};

// ✅ cache ชื่อหมอนวดในหน่วยความจำ (เปลี่ยนน้อยมาก) — เดิมทุก request ของ user ทั่วไป
//    ต้องยิง SELECT therapist เพิ่ม 1 query เพื่อหา name/fname ของ role_id ตัวเอง
const THERAPIST_NAME_CACHE_TTL = 5 * 60 * 1000;
const therapistNameCache = new Map<number, { names: string[]; at: number }>();

// GET: ดึงข้อมูลการจองเตียง (พร้อม Pagination) และคิวที่รอลงเตียง
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const roleId = Number(url.searchParams.get("role_id")) || 0;
    const isAdmin = url.searchParams.get("is_admin") === "true";
    const userName = url.searchParams.get("user_name") || "";

    // 🌟 รับค่า Pagination (กัน NaN / ติดลบ / ใหญ่เกินไป)
    const rawPage = parseInt(url.searchParams.get("page") || "1", 10);
    const rawLimit = parseInt(url.searchParams.get("limit") || "10", 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 10;
    const offset = (page - 1) * limit;

    // ✅ โหมด all=1: คืนข้อมูลการจองเตียงของวันนั้นทั้งหมดใน request เดียว (ไม่แบ่งหน้า)
    //    ใช้โดยหน้าจองเตียงพิเศษสำหรับ "ผังเตียง" — เดิม frontend ต้องวนเรียก API ทีละหน้า
    //    (limit=100 ต่อครั้ง × จำนวนหน้า) ทำให้ช้ามากและยิง query หนักซ้ำหลายรอบ
    const fetchAll = url.searchParams.get("all") === "1";

    // ✅ skip_available=1: ข้ามการดึงคิวรอลงเตียง (availableBookings) — ใช้โดยตาราง pagination
    //    ที่ frontend มีข้อมูลคิวชุดเดียวกันจาก request all=1 อยู่แล้ว ไม่ต้อง query ซ้ำ
    const skipAvailable = url.searchParams.get("skip_available") === "1";

    if (!date) {
      return NextResponse.json({ success: false, error: "Missing date" }, { status: 400 });
    }

    // ==============================================================
    // 1. ดึงคิวที่ลงเตียงไปแล้ว (bedBookings) แบบมี Pagination
    // ==============================================================
    // ✅ แก้ 1: ORDER BY เดิมเรียงแค่ sb.bed_name — เตียงเดียวกันที่ถูกจองหลายช่วงเวลามีค่าเท่ากัน
    //    MySQL จึงเรียงลำดับในกลุ่มที่เท่ากันไม่แน่นอนระหว่างแต่ละหน้า (LIMIT/OFFSET) ทำให้บางรายการ
    //    "ตกหล่น" ไม่ปรากฏในหน้าใดเลย และบางรายการซ้ำ → เพิ่ม sbb.id เป็นตัวตัดสินให้ลำดับคงที่
    // ✅ แก้ 2: เปลี่ยน LEFT JOIN med_user เป็น subquery ดึงเพศ รับประกัน 1 แถวต่อ 1 การจองเตียง
    //    (ถ้า med_user.hn ซ้ำ JOIN จะทำให้แถวเบิ้ล ทำให้จำนวนแถวไม่ตรงกับ COUNT และแบ่งหน้าเพี้ยน)
    // ✅ ยิง query หลัก (เตียง) ทันทีโดยไม่รอ — ให้ทำงานขนานกับ query คิว/นับด้านล่าง
    const bedBookingsPromise: Promise<any> = pool.execute(
      `SELECT
         sbb.id AS special_booking_id, sbb.bed_id, sbb.booking_id, sbb.date, sbb.time_slot, sbb.note, sbb.created_by, sbb.status,
         sb.bed_code, sb.bed_name, sb.room_name, sb.bed_type,
         b.hn, b.name AS patient_name, b.phone AS patient_phone, b.therapist, b.provider, b.status AS booking_status,
         -- ✅ CONVERT(...) USING tis620: แก้ collation mismatch (med_user.hn=tis620 vs bookings.hn=utf8mb4)
         --    ที่ทำให้ MySQL ใช้ index ไม่ได้ → full scan med_user 5 หมื่นแถวต่อ 1 แถว (~500ms → ~3ms)
         --    ค่า HN เป็นตัวเลข ASCII แปลง charset ไม่เสียหาย ผลลัพธ์เหมือนเดิม
         (SELECT u.sex FROM med_user u WHERE u.hn = CONVERT(b.hn USING tis620) LIMIT 1) AS sex
       FROM special_bed_bookings sbb
       INNER JOIN bookings b ON sbb.booking_id = b.id
       INNER JOIN special_beds sb ON sbb.bed_id = sb.id
       WHERE sbb.date = ?
       ORDER BY sb.bed_name ASC, sbb.id ASC${fetchAll ? "" : "\n       LIMIT ? OFFSET ?"}`,
      fetchAll ? [date] : [date, limit, offset]
    );

    // ✅ นับจำนวนรายการ (เฉพาะโหมดแบ่งหน้า) — ยิงพร้อมกันไปเลย ไม่ต้องรอ query หลัก
    const countPromise: Promise<any> | null = fetchAll
      ? null
      : pool.execute(
          `SELECT COUNT(*) AS total
           FROM special_bed_bookings sbb
           INNER JOIN bookings b ON sbb.booking_id = b.id
           INNER JOIN special_beds sb ON sbb.bed_id = sb.id
           WHERE sbb.date = ?`,
          [date]
        );

    // ==============================================================
    // 2. ดึงคิวที่รอลงเตียง (availableBookings) ไม่ต้องทำ Pagination
    // ==============================================================
    let availableQuery = `
      SELECT
         b.id AS booking_id, b.hn, b.name, b.phone, b.therapist, b.provider, b.time_slot, b.date, b.status,
         (SELECT u.sex FROM med_user u WHERE u.hn = CONVERT(b.hn USING tis620) LIMIT 1) AS sex
       FROM bookings b
       LEFT JOIN special_bed_bookings sbb ON b.id = sbb.booking_id
       WHERE b.date = ?
         AND b.status != 'ยกเลิก'
         AND sbb.id IS NULL
    `;
    const availableParams: any[] = [date];

    // ✅ ถ้าไม่ใช่ Admin ให้กรองเฉพาะคิวที่ตัวเองดูแล (เป็น Therapist หรือ Provider)
    if (!skipAvailable && !isAdmin && roleId !== 909) {
      let ownNames: string[] = [userName];
      try {
        const cached = therapistNameCache.get(roleId);
        if (cached && Date.now() - cached.at < THERAPIST_NAME_CACHE_TTL) {
          ownNames.push(...cached.names);
        } else {
          const [tRows]: any = await pool.execute(
            "SELECT name, fname FROM therapist WHERE id = ?",
            [roleId]
          );
          const names = tRows.length > 0 ? [tRows[0].name, tRows[0].fname].filter(Boolean) : [];
          therapistNameCache.set(roleId, { names, at: Date.now() });
          ownNames.push(...names);
        }
      } catch (e) {
        console.error("Error finding therapist name:", e);
      }

      ownNames = [...new Set(ownNames)].filter(Boolean); // ตัดชื่อว่างและซ้ำ

      if (ownNames.length > 0) {
        const placeholders = ownNames.map(() => "?").join(",");
        availableQuery += ` AND (b.therapist IN (${placeholders}) OR b.provider IN (${placeholders}))`;
        availableParams.push(...ownNames, ...ownNames);
      } else {
        availableQuery += ` AND b.therapist_id = ?`;
        availableParams.push(roleId);
      }
    }

    // ✅ ยิง query คิวรอลงเตียงทันที (ไม่ await) ให้ทำงานขนานกับ query เตียง/นับที่ยิงไว้ข้างบน
    //    (ข้าม entirely ถ้าผู้เรียกส่ง skip_available=1)
    const availablePromise: Promise<any> = skipAvailable
      ? Promise.resolve([[]])
      : pool.execute(availableQuery, availableParams);

    // 3. รอผลทุก query พร้อมกัน แล้วส่งข้อมูลทั้งหมดกลับไปพร้อมข้อมูลหน้า Pagination
    const [bedBookingRows]: any = await bedBookingsPromise;
    const [availableRows]: any = await availablePromise;

    let totalRecords: number;
    let totalPages: number;
    if (fetchAll) {
      // โหมด all=1 ไม่ต้อง COUNT — ใช้จำนวนแถวที่ได้จริงแทน
      totalRecords = bedBookingRows.length;
      totalPages = 1;
    } else {
      const [countRows]: any = await countPromise!;
      totalRecords = Number(countRows[0]?.total) || 0;
      totalPages = Math.ceil(totalRecords / limit);
    }

    return NextResponse.json({
      success: true,
      bedBookings: bedBookingRows,
      availableBookings: availableRows,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
      all: fetchAll,
    });
  } catch (error) {
    console.error("Error API beds-special-bookings:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

// ==============================================================
// POST: บันทึกการจองเตียง
// ==============================================================
// ✅ แก้สำคัญ: เดิมใช้ INSERT ... ON DUPLICATE KEY UPDATE booking_id = VALUES(booking_id)
//    ถ้า (bed, date, time_slot) นี้มีคนจองอยู่แล้ว คำสั่งจะ "เขียนทับ" คนไข้เดิมด้วยคนไข้ใหม่แบบเงียบ ๆ
//    (ไม่ error) → ผู้จองคนแรกเสียเตียงโดยไม่รู้ตัว และเป็นต้นเหตุให้เกิดการจองซ้ำซ้อนเมื่อผังไม่แสดงรายการเดิม
//    เปลี่ยนเป็นตรวจสอบใน transaction ก่อน: เตียงว่างจริงและคิวนี้ยังไม่มีเตียง จึงบันทึก ไม่เช่นนั้นตอบ 409
export async function POST(req: Request) {
  let conn: any = null;
  try {
    const body = await req.json();
    const { bed_id, booking_id, date, time_slot, created_by, note, status } = body;

    if (!bed_id || !booking_id || !date || !time_slot) {
      return NextResponse.json(
        { success: false, error: "ข้อมูลไม่ครบถ้วน (bed_id, booking_id, date, time_slot)" },
        { status: 400 }
      );
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // ล็อกแถวคิวที่จะลงเตียง กันสองคนกดลงเตียงให้คิวเดียวกันพร้อมกัน
    const [bookingRows]: any = await conn.query(
      "SELECT id, status FROM bookings WHERE id = ? FOR UPDATE",
      [booking_id]
    );
    if (!bookingRows || bookingRows.length === 0) {
      await conn.rollback();
      return NextResponse.json({ success: false, error: "ไม่พบคิวที่ต้องการลงเตียง" }, { status: 404 });
    }
    if (bookingRows[0].status === "ยกเลิก") {
      await conn.rollback();
      return NextResponse.json({ success: false, error: "คิวนี้ถูกยกเลิกแล้ว ไม่สามารถลงเตียงได้" }, { status: 400 });
    }

    // ดึงรายการเตียงของวันนั้นที่เกี่ยวข้อง (เตียงเดียวกัน หรือคิวเดียวกัน) พร้อมล็อก
    const [existingRows]: any = await conn.query(
      `SELECT sbb.id, sbb.bed_id, sbb.booking_id, sbb.time_slot,
              b.status AS booking_status, b.name AS patient_name
       FROM special_bed_bookings sbb
       LEFT JOIN bookings b ON b.id = sbb.booking_id
       WHERE sbb.date = ? AND (sbb.bed_id = ? OR sbb.booking_id = ?)
       FOR UPDATE`,
      [date, bed_id, booking_id]
    );

    const wantedSlot = normalizeSlot(time_slot);
    const staleIds: number[] = []; // รายการค้างของคิวที่ถูกยกเลิก/ถูกลบไปแล้ว — เคลียร์ทิ้งได้

    for (const row of existingRows as any[]) {
      const isStale = !row.booking_status || row.booking_status === "ยกเลิก";

      if (isStale) {
        // รายการค้างที่ชนกับเตียง/ช่วงเวลานี้ หรือเป็นของคิวเดียวกัน ให้เคลียร์
        if (
          (Number(row.bed_id) === Number(bed_id) && normalizeSlot(row.time_slot) === wantedSlot) ||
          Number(row.booking_id) === Number(booking_id)
        ) {
          staleIds.push(row.id);
        }
        continue;
      }

      if (Number(row.booking_id) === Number(booking_id)) {
        await conn.rollback();
        return NextResponse.json(
          { success: false, error: "คิวนี้ถูกลงเตียงพิเศษไปแล้ว" },
          { status: 409 }
        );
      }

      if (Number(row.bed_id) === Number(bed_id) && normalizeSlot(row.time_slot) === wantedSlot) {
        await conn.rollback();
        return NextResponse.json(
          {
            success: false,
            error: `เตียงนี้ในช่วงเวลา ${time_slot} ถูกจองแล้ว (${row.patient_name || "ไม่ระบุชื่อ"}) กรุณารีเฟรชหน้าและเลือกเตียงอื่น`,
          },
          { status: 409 }
        );
      }
    }

    if (staleIds.length > 0) {
      await conn.query(
        `DELETE FROM special_bed_bookings WHERE id IN (${staleIds.map(() => "?").join(",")})`,
        staleIds
      );
    }

    await conn.query(
      `INSERT INTO special_bed_bookings (bed_id, booking_id, date, time_slot, created_by, note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bed_id, booking_id, date, time_slot, created_by || "staff", note || null, status ?? 0]
    );

    await conn.commit();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (conn) {
      try { await conn.rollback(); } catch {}
    }
    // กันกรณีสองคำขอชนกันและติด unique key ของตาราง (ถ้ามี)
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { success: false, error: "เตียงนี้ถูกจองไปแล้ว กรุณารีเฟรชหน้าและเลือกเตียงอื่น" },
        { status: 409 }
      );
    }
    console.error("POST special_bed_bookings error:", error);
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาดในการบันทึกการจองเตียง" }, { status: 500 });
  } finally {
    if (conn) conn.release(); // ✅ ปล่อยคอนเนกชันเสมอ ไม่ให้ค้างใน pool
  }
}

// ==============================================================
// DELETE: ยกเลิกการจองเตียง
// ==============================================================
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });

    await pool.execute("DELETE FROM special_bed_bookings WHERE id = ?", [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE special_bed_bookings error:", error);
    return NextResponse.json({ success: false, error: "ลบข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}

// ==============================================================
// PUT: อัปเดตสถานะบริการสำเร็จ (status = 1) (หากมีการเรียกใช้)
// ==============================================================
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || status === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    await pool.execute(
      `UPDATE special_bed_bookings SET status = ? WHERE id = ?`,
      [status, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT special_bed_bookings error:", error);
    return NextResponse.json({ success: false, error: "อัปเดตข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}
