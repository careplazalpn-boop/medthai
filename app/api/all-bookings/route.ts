import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

// 🧩 ฟังก์ชันสำหรับอัปเดตสถานะ
async function updateBookingStatus(status: string, bookingId: string | number) {
  await pool.execute("UPDATE bookings SET status = ? WHERE id = ?", [status, bookingId]);
}

// ✅ กัน Next.js cache ผลลัพธ์ของ GET (ข้อมูลต้องสดเสมอ)
export const dynamic = "force-dynamic";

// ✅ cache เบา ๆ ในหน่วยความจำ สำหรับข้อมูลที่เปลี่ยนน้อยและไม่ต้องยิง DB ทุกครั้ง
const CACHE_TTL_MS = 5 * 60 * 1000;
const avgCache = new Map<number, { value: number; at: number }>();
const therapistNameCache = new Map<number, { names: string[]; at: number }>();

// 🧠 GET: ดึง bookings ทั้งหมด พร้อม pagination + filter + summary
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    // --- Pagination ---
    // ✅ กันค่า NaN / ติดลบ / ใหญ่เกินไป (ค่าปกติ page=1, limit=20 ทำงานเหมือนเดิม)
    const rawPage = parseInt(url.searchParams.get("page") || "1", 10);
    const rawLimit = parseInt(url.searchParams.get("limit") || "20", 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 20;
    const isExport = url.searchParams.get("export") === "true";

    // --- Filters ---
    const filterDate = url.searchParams.get("date") || "";
    const filterTimeSlot =
      url.searchParams.get("timeSlot") ||
      url.searchParams.get("timeslot") ||
      url.searchParams.get("timeSlots") || // ✅ รองรับชื่อที่ frontend ใช้อยู่จริง
      "";

    const filterProvider = url.searchParams.get("provider") || "";
    const filterTherapist = url.searchParams.get("therapist") || "";
    const filterStatus = url.searchParams.get("status") || "";
    // ✅ ใหม่: กรองเตียงนวด — specialBed=true (มีเตียง) / specialBed=none (ยังไม่มีเตียง)
    //    ค่าเดิม false/อื่น ๆ = ไม่กรอง (เหมือนเดิมทุกประการ)
    const filterSpecialBedParam = url.searchParams.get("specialBed") || "";
    const filterHasBed = filterSpecialBedParam === "true";
    const filterNoBed = filterSpecialBedParam === "none";

    // ✅ ใหม่: ข้อมูลผู้ใช้ที่ login (ส่งมาจากหน้าเว็บ) ใช้เพื่อ "จัดลำดับการแสดงผล" เท่านั้น
    // ไม่ได้ใช้กรองหรือจำกัดสิทธิ์ข้อมูล — ถ้าไม่ส่งมา หรือไม่ใช่ role=user ลำดับเดิมทุกประการ
    const viewerRole = (url.searchParams.get("role") || "").toLowerCase().trim();
    const viewerRoleId = Number(url.searchParams.get("role_id") || 0);
    const isUserViewer =
      viewerRole === "user" && Number.isInteger(viewerRoleId) && viewerRoleId > 0 && viewerRoleId !== 909;

    // ✅ ถ้ามีการกรองค่าใด ๆ ให้รีเซ็ต page = 1

    const offset = (page - 1) * limit;

    // --- Confirm booking ---
    const confirmId = url.searchParams.get("confirmId");
    let updatedStatus: string | null = null;
    if (confirmId) {
      const [bookingRows]: any = await pool.execute(
        "SELECT id, time_slot, date FROM bookings WHERE id = ?",
        [confirmId]
      );
      const booking = bookingRows[0];
      if (booking) {
        // ✅ ตั้งสถานะเป็น "สำเร็จ" ทันทีเมื่อกดยืนยันด้วยมือ
        // (ไม่เช็คเวลาอีกต่อไป — แม้เวลาจะยังไม่ถึงหรือผ่านไปแล้วก็ไม่มีผล
        // ต้องกดปุ่มยืนยันด้วยมือเท่านั้นถึงจะเปลี่ยนสถานะ)
        const [result]: any = await pool.execute(
          `
          UPDATE bookings
          SET status = 'สำเร็จ'
          WHERE id = ?
        `,
          [confirmId]
        );
        if (result.affectedRows > 0) {
          const [updatedRows]: any = await pool.execute(
            "SELECT status FROM bookings WHERE id = ?",
            [confirmId]
          );
          updatedStatus = updatedRows[0].status;

          // ✅ ซิงก์สถานะเตียงพิเศษ — ทำงานเฉพาะตอนกดปุ่มเช็คถูก (ยืนยันคิวนี้)
          // และเฉพาะเมื่อผลลัพธ์ของการยืนยันคือ "สำเร็จ" เท่านั้น
          // (เงื่อนไข: booking นี้ต้องมีข้อมูลอยู่ใน special_bed_bookings.booking_id จริง
          // ซึ่งบังคับด้วย INNER JOIN ด้านล่าง)
          if (updatedStatus === "สำเร็จ") {
            await pool.execute(
              `
              UPDATE special_bed_bookings sbb
              INNER JOIN bookings b ON sbb.booking_id = b.id
              SET sbb.status = 1
              WHERE b.id = ? AND b.status = 'สำเร็จ' AND sbb.status <> 1
              `,
              [confirmId]
            );
          }
        }
      }
    }

    // --- Query หลัก ---
    // ✅ เพิ่ม LEFT JOIN กับ special_bed_bookings / special_beds เพื่อดึงข้อมูลเตียงพิเศษมาแสดงผล + ใช้กรอง
    // (ใช้ LEFT JOIN เพราะความสัมพันธ์เป็น booking : special_bed_booking = 1 : 1 อยู่แล้ว
    //  จึงไม่ทำให้จำนวนแถวของ bookings เปลี่ยนไป เมื่อไม่ได้เปิดใช้ filterSpecialBed)
    // 🌟 ปรับปรุง: เพิ่ม LEFT JOIN med_user และดึง u.sex ออกมา เพื่อใช้เช็คเพศการจองเตียงหน้าเว็บ
    let query = `
      SELECT
        b.id, b.provider, b.name, b.phone, b.therapist, b.time_slot, b.date, b.status, b.payment_status, b.created_at,
        b.hn,
        -- ✅ ใช้ subquery แทน LEFT JOIN med_user: รับประกัน 1 แถวต่อ 1 booking เสมอ
        -- (ถ้า med_user.hn ซ้ำ การ JOIN จะทำให้แถวเบิ้ล และ pagination/count เพี้ยน)
        -- ✅ CONVERT(...) USING tis620: แก้ collation mismatch (med_user.hn=tis620 vs bookings.hn=utf8mb4)
        --    ที่ทำให้ MySQL ใช้ index ไม่ได้ → full scan med_user 5 หมื่นแถวต่อ 1 แถว (~500ms → ~3ms)
        (SELECT u.sex FROM med_user u WHERE u.hn = CONVERT(b.hn USING tis620) LIMIT 1) AS sex,
        (sbb.id IS NOT NULL) AS has_special_bed,
        sb.bed_name AS bed_name,
        -- ✅ เปลี่ยนมาเช็ค HN จากตาราง bookings โดยตรง (เร็วกว่าเดิมมาก
        -- เพราะไม่ต้อง join กับ med_user ที่มีข้อมูลจำนวนมาก)
        (CASE WHEN b.hn IS NOT NULL AND b.hn <> '' THEN 1 ELSE 0 END) AS has_confirmed_hn,
        (CASE WHEN b.hn IS NULL OR b.hn = '' THEN 1 ELSE 0 END) AS is_new_user_pending
      FROM bookings b
      LEFT JOIN special_bed_bookings sbb ON b.id = sbb.booking_id
      LEFT JOIN special_beds sb ON sbb.bed_id = sb.id
      WHERE 1=1
    `;
    const queryParams: any[] = [];

    // --- แปลง filterStatus จากค่าที่หน้าเว็บ → ค่าจริงในฐานข้อมูล ---
    const statusMap: Record<string, string> = {
      upcoming: "รอดำเนินการ",
      in_queue: "อยู่ในคิว",
      past: "สำเร็จ",
      cancelled: "ยกเลิก",
    };
    const dbStatus = statusMap[filterStatus] || "";

    // --- Apply filters ---
    if (filterDate && filterDate !== "all") {
      query += ` AND b.date = ?`;
      queryParams.push(filterDate);
    }
    if (filterTimeSlot && filterTimeSlot !== "all") {
      query += `
        AND REPLACE(REPLACE(TRIM(b.time_slot), '–', '-'), ' ', '') = REPLACE(?, ' ', '')`;
      queryParams.push(filterTimeSlot.trim());
    }

    if (filterProvider && filterProvider !== "all") {
      query += ` AND b.provider = ?`;
      queryParams.push(filterProvider);
    }
    if (filterTherapist && filterTherapist !== "all") {
      query += ` AND b.therapist = ?`;
      queryParams.push(filterTherapist);
    }
    if (dbStatus && dbStatus !== "all") {
      query += ` AND b.status = ?`;
      queryParams.push(dbStatus);
    }
    // ✅ กรองเตียงนวด: มีเตียง (sbb.id IS NOT NULL) หรือยังไม่มีเตียง (sbb.id IS NULL)
    //    กรณี "ยังไม่ได้จองเตียง" ไม่นับคิวที่ยกเลิกแล้ว (status != 'ยกเลิก')
    if (filterHasBed) {
      query += ` AND sbb.id IS NOT NULL`;
    }
    if (filterNoBed) {
      query += ` AND sbb.id IS NULL AND b.status != 'ยกเลิก'`;
    }

    // ✅ ใหม่: ถ้าผู้ใช้เป็น role=user ให้คิวของตัวเอง (พนักงานนวดคนนั้น) แสดงก่อน
    // จับคู่ด้วย bookings.therapist_id = users.role_id (รหัสในตาราง therapist)
    // และสำรองด้วยชื่อ (name/fname) เฉพาะคิวเก่าที่ therapist_id ยังเป็น NULL
    // เป็นแค่คีย์เรียงลำดับแรก คีย์เดิมทั้งหมดยังทำงานต่อเป็นลำดับรอง
    let ownFirstOrder = "";
    const ownFirstParams: any[] = [];
    if (isUserViewer && !isExport) {
      let ownNames: string[] = [];
      try {
        // ✅ cache ชื่อหมอนวด (เปลี่ยนน้อยมาก) ลดการยิง DB เพิ่มต่อ 1 request
        const cached = therapistNameCache.get(viewerRoleId);
        if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
          ownNames = cached.names;
        } else {
          const [tRows]: any = await pool.execute(
            "SELECT name, fname FROM therapist WHERE id = ? LIMIT 1",
            [viewerRoleId]
          );
          ownNames = [tRows?.[0]?.name, tRows?.[0]?.fname].filter((n: any) => !!n);
          therapistNameCache.set(viewerRoleId, { names: ownNames, at: Date.now() });
        }
      } catch (e) {
        console.error("หาชื่อหมอนวดของผู้ใช้ไม่สำเร็จ (ไม่กระทบการแสดงผล ใช้ therapist_id อย่างเดียว):", e);
      }
      ownFirstParams.push(viewerRoleId);
      let nameCond = "";
      if (ownNames.length > 0) {
        nameCond = ` OR (b.therapist_id IS NULL AND b.therapist IN (${ownNames.map(() => "?").join(", ")}))`;
        ownFirstParams.push(...ownNames);
      }
      ownFirstOrder = `(CASE WHEN b.therapist_id = ?${nameCond} THEN 0 ELSE 1 END) ASC,`;
    }

    if (!isExport) { // 🎯 ใช้ LIMIT และ OFFSET เมื่อ 'ไม่ใช่' โหมด Export เท่านั้น
        query += `
            ORDER BY 
              ${ownFirstOrder}
              (CASE WHEN b.hn IS NULL OR b.hn = '' THEN 0 ELSE 1 END) ASC,
              b.date ASC,
              STR_TO_DATE(SUBSTRING_INDEX(b.time_slot, '-', 1), '%H:%i') ASC,
              b.name ASC,
              b.id ASC
            LIMIT ? OFFSET ?
        `;
        queryParams.push(...ownFirstParams, limit, offset);
    } else {
        query += `
            ORDER BY 
              (CASE WHEN b.hn IS NULL OR b.hn = '' THEN 0 ELSE 1 END) ASC,
              b.date ASC,
              STR_TO_DATE(SUBSTRING_INDEX(b.time_slot, '-', 1), '%H:%i') ASC,
              b.name ASC,
              b.id ASC
        `;
    }


    // --- Summary (รวมทุกหน้า ตาม filter เดียวกัน) ---
    let summaryCondition = "";
    const summaryParams: any[] = [];

    // สร้างเงื่อนไขเหมือน countQuery แต่ไม่เอา LIMIT/OFFSET
    if (filterDate && filterDate !== "all") {
      summaryCondition += " AND b.date = ?";
      summaryParams.push(filterDate);
    }
    if (filterTimeSlot && filterTimeSlot !== "all") {
      summaryCondition += " AND REPLACE(REPLACE(TRIM(b.time_slot), '–', '-'), ' ', '') = REPLACE(?, ' ', '')";
      summaryParams.push(filterTimeSlot.trim());
    }
    if (filterProvider && filterProvider !== "all") {
      summaryCondition += " AND b.provider = ?";
      summaryParams.push(filterProvider);
    }
    if (filterTherapist && filterTherapist !== "all") {
      summaryCondition += " AND b.therapist = ?";
      summaryParams.push(filterTherapist);
    }
    // ✅ ให้ summary สอดคล้องกับตัวกรองเตียงนวดด้วย (ทั้งสองทิศ)
    if (filterHasBed) {
      summaryCondition += " AND sbb.id IS NOT NULL";
    }
    if (filterNoBed) {
      summaryCondition += " AND sbb.id IS NULL";
    }
    // หมายเหตุ: summary ไม่กรอง status (ตั้งใจ) เพื่อให้การ์ดสรุปแสดงครบทุกสถานะ

    // ✅ ปรับปรุง: รวม 4 query สรุปสถานะเดิม (attended/cancelled/pending/inQueue) เป็น query เดียว
    // ด้วย conditional aggregation — สแกนตาราง bookings แค่รอบเดียวแทน 4 รอบ
    // ผลลัพธ์ตัวเลขที่ได้เหมือนเดิมทุกประการ (เงื่อนไข filter และการนับแต่ละสถานะไม่เปลี่ยน)
    // ✅ ปรับปรุง: รวม count (total) เข้ามาใน summary query เดียวกัน
    // total = จำนวนแถวตาม filter ทั้งหมด "รวม status" (เท่ากับ countQuery เดิมทุกประการ)
    // ทำให้เหลือแค่ 2 query ต่อ request (เดิม 4) ลดการแย่งคอนเนกชันใน pool
    const totalExpr =
      dbStatus && dbStatus !== "all"
        ? "SUM(CASE WHEN b.status = ? THEN 1 ELSE 0 END)"
        : "COUNT(*)";
    const summaryQueryParams: any[] =
      dbStatus && dbStatus !== "all" ? [dbStatus, ...summaryParams] : summaryParams;

    // ✅ ใช้ JOIN special_bed_bookings เฉพาะตอนกรองเตียงพิเศษ (ความสัมพันธ์ 1:1 ผลลัพธ์เท่าเดิม)
    const summaryQuery = `
      SELECT
        ${totalExpr} AS total,
        SUM(CASE WHEN b.status = 'สำเร็จ' THEN 1 ELSE 0 END) AS totalAttended,
        SUM(CASE WHEN b.status = 'ยกเลิก' THEN 1 ELSE 0 END) AS totalCancelled,
        SUM(CASE WHEN b.status = 'รอดำเนินการ' THEN 1 ELSE 0 END) AS totalPending,
        SUM(CASE WHEN b.status = 'อยู่ในคิว' THEN 1 ELSE 0 END) AS totalInQueue
      FROM bookings b
      ${filterHasBed || filterNoBed ? "LEFT JOIN special_bed_bookings sbb ON b.id = sbb.booking_id" : ""}
      WHERE 1=1 ${summaryCondition}
    `;

    // --- Average per month ---
    // ✅ เดิมใช้ YEAR(date) = ? ซึ่งทำให้ index ใช้ไม่ได้ (full table scan ทุก request)
    // เปลี่ยนเป็นช่วงวันที่ — ผลลัพธ์เท่าเดิม และ cache 5 นาที เพราะค่านี้เปลี่ยนช้ามาก
    const now = new Date();
    const year = now.getFullYear();
    const getAvgPerMonth = async (): Promise<number> => {
      const hit = avgCache.get(year);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
      const [avgRows]: any = await pool.execute(
        "SELECT COUNT(*) / 12 AS avg_per_month FROM bookings WHERE date >= ? AND date < ?",
        [`${year}-01-01`, `${year + 1}-01-01`]
      );
      const value = avgRows[0]?.avg_per_month || 0;
      avgCache.set(year, { value, at: Date.now() });
      return value;
    };

    // ✅ ยิง query ที่เป็นอิสระต่อกันพร้อมกัน (สูงสุด 3 คอนเนกชัน และปกติ avg มาจาก cache)
    const [[rows], [summaryRows], avgPerMonth]: any = await Promise.all([
      pool.execute(query, queryParams),
      pool.execute(summaryQuery, summaryQueryParams),
      getAvgPerMonth(),
    ]);

    const total = Number(summaryRows?.[0]?.total) || 0;
    const totalPages = Math.ceil(total / limit);

    const totalAttended = Number(summaryRows?.[0]?.totalAttended) || 0;
    const totalCancelled = Number(summaryRows?.[0]?.totalCancelled) || 0;
    const totalPending = Number(summaryRows?.[0]?.totalPending) || 0;
    const totalInQueue = Number(summaryRows?.[0]?.totalInQueue) || 0;

    // ✅ ส่งข้อมูลกลับ
    return NextResponse.json({
      success: true,
      bookings: rows,
      updatedStatus,
      avgPerMonth,
      pagination: { page, limit, total, totalPages },
      summary: { totalAttended, totalCancelled, totalPending, totalInQueue },
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถดึงข้อมูลการจองทั้งหมดได้" },
      { status: 500 }
    );
  }
}

// 🗑️ DELETE: ลบ booking
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id)
      return NextResponse.json({ success: false, error: "ไม่พบ id" }, { status: 400 });

    await pool.execute("DELETE FROM bookings WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting booking:", error);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถลบรายการได้" },
      { status: 500 }
    );
  }
}

// 🔁 PATCH: แก้ไขสถานะ (status) ของ booking ที่ "สำเร็จ" แล้ว
// ✅ ใหม่: ใช้สำหรับปุ่มสถานะแบบ "คลิกวนไปเรื่อยๆ" (ไม่มี Dropdown)
// เงื่อนไข: 1) เฉพาะแอดมิน (role_id 909) เท่านั้น 2) แก้ไขได้เฉพาะ booking ที่วันที่ตรงกับวันปัจจุบันเท่านั้น
// 3) แก้ไขได้เฉพาะรายการที่สถานะปัจจุบันเป็น "สำเร็จ" อยู่แล้วเท่านั้น (ตามที่ร้องขอ ไม่กระทบ flow ยืนยัน/ยกเลิกเดิม)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status, role_id } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
    }

    // ✅ 1. เฉพาะแอดมินเท่านั้นที่แก้ไขได้
    if (role_id !== 909) {
      return NextResponse.json(
        { success: false, error: "ไม่มีสิทธิ์แก้ไขรายการนี้" },
        { status: 403 }
      );
    }

    const [bookingRows]: any = await pool.execute(
      "SELECT id, date, status FROM bookings WHERE id = ?",
      [id]
    );
    const booking = bookingRows[0];
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "ไม่พบรายการที่ต้องการแก้ไข" },
        { status: 404 }
      );
    }

    // ✅ 2. ต้องตรงกับวันที่ปัจจุบันเท่านั้นถึงจะแก้ไขได้ (เช็คฝั่ง server กันเหนียว)
    const bookingDate = new Date(booking.date);
    bookingDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate.getTime() !== today.getTime()) {
      return NextResponse.json(
        { success: false, error: "ไม่สามารถแก้ไขได้ เนื่องจากวันที่ของรายการไม่ตรงกับวันที่ปัจจุบัน" },
        { status: 403 }
      );
    }

    // ✅ 3. แก้ไขได้เฉพาะรายการที่สถานะปัจจุบันเป็น "สำเร็จ" แล้วเท่านั้น
    if (booking.status !== "สำเร็จ") {
      return NextResponse.json(
        { success: false, error: "สามารถแก้ไขได้เฉพาะรายการที่มีสถานะ 'สำเร็จ' แล้วเท่านั้น" },
        { status: 403 }
      );
    }

    await updateBookingStatus(status, id);

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Error updating booking status:", error);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถอัปเดตสถานะได้" },
      { status: 500 }
    );
  }
}

// 💳 POST: mark payment
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, status } = body; // รับ status เข้ามาด้วย
    
    if (!id || !status) {
      return NextResponse.json({ success: false, error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
    }

    // อัปเดตสถานะตามที่ได้รับมา
    await pool.execute("UPDATE bookings SET payment_status = ? WHERE id = ?", [status, id]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating payment status:", error);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถอัปเดตการจ่ายเงินได้" },
      { status: 500 }
    );
  }
}