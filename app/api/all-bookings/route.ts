import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

// 🧩 ฟังก์ชันสำหรับอัปเดตสถานะ
async function updateBookingStatus(status: string, bookingId: string | number) {
  await pool.execute("UPDATE bookings SET status = ? WHERE id = ?", [status, bookingId]);
}

// 🧠 GET: ดึง bookings ทั้งหมด พร้อม pagination + filter + summary
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    // --- Pagination ---
    const page = parseInt(url.searchParams.get("page") || "1"); // 👈 ใช้ let แทน const
    const limit = parseInt(url.searchParams.get("limit") || "20");
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
    // ✅ ใหม่: กรองเฉพาะคิวที่มีการจองเตียงพิเศษ
    const filterSpecialBed = url.searchParams.get("specialBed") === "true";

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
    let query = `
      SELECT
        b.id, b.provider, b.name, b.phone, b.therapist, b.time_slot, b.date, b.status, b.payment_status, b.created_at,
        b.hn,
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
    let countQuery = `
      SELECT COUNT(*) AS total
      FROM bookings b
      LEFT JOIN special_bed_bookings sbb ON b.id = sbb.booking_id
      WHERE 1=1
    `;
    const queryParams: any[] = [];
    const countParams: any[] = [];

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
      countQuery += ` AND b.date = ?`;
      queryParams.push(filterDate);
      countParams.push(filterDate);
    }
    if (filterTimeSlot && filterTimeSlot !== "all") {
          query += `
            AND REPLACE(REPLACE(TRIM(b.time_slot), '–', '-'), ' ', '') = REPLACE(?, ' ', '')`;
          countQuery += `
            AND REPLACE(REPLACE(TRIM(b.time_slot), '–', '-'), ' ', '') = REPLACE(?, ' ', '')`;
          queryParams.push(filterTimeSlot.trim());
          countParams.push(filterTimeSlot.trim());
        }
   
    if (filterProvider && filterProvider !== "all") {
      query += ` AND b.provider = ?`;
      countQuery += ` AND b.provider = ?`;
      queryParams.push(filterProvider);
      countParams.push(filterProvider);
    }
    if (filterTherapist && filterTherapist !== "all") {
      query += ` AND b.therapist = ?`;
      countQuery += ` AND b.therapist = ?`;
      queryParams.push(filterTherapist);
      countParams.push(filterTherapist);
    }
    if (dbStatus && dbStatus !== "all") {
      query += ` AND b.status = ?`;
      countQuery += ` AND b.status = ?`;
      queryParams.push(dbStatus);
      countParams.push(dbStatus);
    }
    // ✅ ใหม่: กรองเฉพาะคิวที่มีการจองเตียงพิเศษ (ไม่ต้องใช้ param)
    if (filterSpecialBed) {
      query += ` AND sbb.id IS NOT NULL`;
      countQuery += ` AND sbb.id IS NOT NULL`;
    }

    if (!isExport) { // 🎯 ใช้ LIMIT และ OFFSET เมื่อ 'ไม่ใช่' โหมด Export เท่านั้น
        query += `
            ORDER BY 
              b.date ASC,
              STR_TO_DATE(SUBSTRING_INDEX(b.time_slot, '-', 1), '%H:%i') ASC,
              b.name ASC
            LIMIT ? OFFSET ?
        `;
        queryParams.push(limit, offset);
    } else {
        query += `
            ORDER BY 
              b.date ASC,
              STR_TO_DATE(SUBSTRING_INDEX(b.time_slot, '-', 1), '%H:%i') ASC,
              b.name ASC
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
    // ✅ ใหม่: ให้ summary สอดคล้องกับตัวกรองเตียงพิเศษด้วย
    if (filterSpecialBed) {
      summaryCondition += " AND sbb.id IS NOT NULL";
    }

    // ✅ ปรับปรุง: รวม 4 query สรุปสถานะเดิม (attended/cancelled/pending/inQueue) เป็น query เดียว
    // ด้วย conditional aggregation — สแกนตาราง bookings แค่รอบเดียวแทน 4 รอบ
    // ผลลัพธ์ตัวเลขที่ได้เหมือนเดิมทุกประการ (เงื่อนไข filter และการนับแต่ละสถานะไม่เปลี่ยน)
    const summaryQuery = `
      SELECT
        SUM(CASE WHEN b.status = 'สำเร็จ' THEN 1 ELSE 0 END) AS totalAttended,
        SUM(CASE WHEN b.status = 'ยกเลิก' THEN 1 ELSE 0 END) AS totalCancelled,
        SUM(CASE WHEN b.status = 'รอดำเนินการ' THEN 1 ELSE 0 END) AS totalPending,
        SUM(CASE WHEN b.status = 'อยู่ในคิว' THEN 1 ELSE 0 END) AS totalInQueue
      FROM bookings b
      LEFT JOIN special_bed_bookings sbb ON b.id = sbb.booking_id
      WHERE 1=1 ${summaryCondition}
    `;

    // --- Average per month ---
    const now = new Date();
    const year = now.getFullYear();
    const avgQuery = "SELECT COUNT(*) / 12 AS avg_per_month FROM bookings WHERE YEAR(date) = ?";

    // ✅ ปรับปรุง: ยิง query ทั้ง 4 ตัวที่เป็นอิสระต่อกัน (ไม่พึ่งผลลัพธ์ของกันและกัน) พร้อมกัน
    // ด้วย Promise.all แทนการ await ทีละตัวตามลำดับ — ลดเวลารอรวมจาก "ผลรวมของทุก query"
    // เหลือแค่ "เวลาของ query ที่ช้าที่สุดตัวเดียว" ผลลัพธ์ที่ได้เหมือนเดิมทุกประการ
    const [
      [rows],
      [countRows],
      [summaryRows],
      [avgRows],
    ]: any = await Promise.all([
      pool.execute(query, queryParams),
      pool.execute(countQuery, countParams),
      pool.execute(summaryQuery, summaryParams),
      pool.execute(avgQuery, [year]),
    ]);

    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const totalAttended = Number(summaryRows?.[0]?.totalAttended) || 0;
    const totalCancelled = Number(summaryRows?.[0]?.totalCancelled) || 0;
    const totalPending = Number(summaryRows?.[0]?.totalPending) || 0;
    const totalInQueue = Number(summaryRows?.[0]?.totalInQueue) || 0;

    const avgPerMonth = avgRows[0]?.avg_per_month || 0;

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