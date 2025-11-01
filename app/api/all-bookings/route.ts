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
    let page = parseInt(url.searchParams.get("page") || "1"); // 👈 ใช้ let แทน const
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

    // ✅ ถ้ามีการกรองค่าใด ๆ ให้รีเซ็ต page = 1

    const offset = (page - 1) * limit;
    // --- Auto-update สถานะ ---
    await pool.execute(`
      UPDATE bookings
      SET status = 'สำเร็จ'
      WHERE status = 'อยู่ในคิว'
      AND CONCAT(date, ' ', SUBSTRING_INDEX(time_slot, '-', -1)) <= NOW()
    `);

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
        const [result]: any = await pool.execute(
          `
          UPDATE bookings
          SET status = CASE
            WHEN CONCAT(date, ' ', SUBSTRING_INDEX(time_slot, '-', -1)) <= NOW() THEN 'สำเร็จ'
            ELSE 'อยู่ในคิว'
          END
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
        }
      }
    }

    // --- Query หลัก ---
    let query = `
      SELECT id, provider, name, phone, therapist, time_slot, date, status, payment_status, created_at
      FROM bookings
      WHERE 1=1
    `;
    let countQuery = `SELECT COUNT(*) AS total FROM bookings WHERE 1=1`;
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
      query += ` AND date = ?`;
      countQuery += ` AND date = ?`;
      queryParams.push(filterDate);
      countParams.push(filterDate);
    }
    if (filterTimeSlot && filterTimeSlot !== "all") {
          query += `
            AND REPLACE(REPLACE(TRIM(time_slot), '–', '-'), ' ', '') = REPLACE(?, ' ', '')`;
          countQuery += `
            AND REPLACE(REPLACE(TRIM(time_slot), '–', '-'), ' ', '') = REPLACE(?, ' ', '')`;
          queryParams.push(filterTimeSlot.trim());
          countParams.push(filterTimeSlot.trim());
        }
   
    if (filterProvider && filterProvider !== "all") {
      query += ` AND provider = ?`;
      countQuery += ` AND provider = ?`;
      queryParams.push(filterProvider);
      countParams.push(filterProvider);
    }
    if (filterTherapist && filterTherapist !== "all") {
      query += ` AND therapist = ?`;
      countQuery += ` AND therapist = ?`;
      queryParams.push(filterTherapist);
      countParams.push(filterTherapist);
    }
    if (dbStatus && dbStatus !== "all") {
      query += ` AND status = ?`;
      countQuery += ` AND status = ?`;
      queryParams.push(dbStatus);
      countParams.push(dbStatus);
    }

    if (!isExport) { // 🎯 ใช้ LIMIT และ OFFSET เมื่อ 'ไม่ใช่' โหมด Export เท่านั้น
        query += `
            ORDER BY 
              date ASC,
              STR_TO_DATE(SUBSTRING_INDEX(time_slot, '-', 1), '%H:%i') ASC,
              name ASC
            LIMIT ? OFFSET ?
        `;
        queryParams.push(limit, offset);
    } else {
        query += `
            ORDER BY 
              date ASC,
              STR_TO_DATE(SUBSTRING_INDEX(time_slot, '-', 1), '%H:%i') ASC,
              name ASC
        `;
    }


    // --- ดึงข้อมูล ---
    const [rows]: any = await pool.execute(query, queryParams);
    const [countRows]: any = await pool.execute(countQuery, countParams);

    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);
    
 // --- Summary (รวมทุกหน้า ตาม filter เดียวกัน) ---
      let summaryCondition = "";
      const summaryParams: any[] = [];

      // สร้างเงื่อนไขเหมือน countQuery แต่ไม่เอา LIMIT/OFFSET
      if (filterDate && filterDate !== "all") {
        summaryCondition += " AND date = ?";
        summaryParams.push(filterDate);
      }
      if (filterTimeSlot && filterTimeSlot !== "all") {
        summaryCondition += " AND REPLACE(REPLACE(TRIM(time_slot), '–', '-'), ' ', '') = REPLACE(?, ' ', '')";
        summaryParams.push(filterTimeSlot.trim());
      }
      if (filterProvider && filterProvider !== "all") {
        summaryCondition += " AND provider = ?";
        summaryParams.push(filterProvider);
      }
      if (filterTherapist && filterTherapist !== "all") {
        summaryCondition += " AND therapist = ?";
        summaryParams.push(filterTherapist);
      }           

      
      // --- Query summary ครบ 4 สถานะ ---
      const attendedQuery = `SELECT COUNT(*) AS totalAttended FROM bookings WHERE status = 'สำเร็จ' ${summaryCondition}`;
      const cancelledQuery = `SELECT COUNT(*) AS totalCancelled FROM bookings WHERE status = 'ยกเลิก' ${summaryCondition}`;
      const pendingQuery = `SELECT COUNT(*) AS totalPending FROM bookings WHERE status = 'รอดำเนินการ' ${summaryCondition}`;
      const inQueueQuery = `SELECT COUNT(*) AS totalInQueue FROM bookings WHERE status = 'อยู่ในคิว' ${summaryCondition}`;


      const [attendedRows]: any = await pool.execute(attendedQuery, summaryParams.slice());
      const [cancelledRows]: any = await pool.execute(cancelledQuery, summaryParams.slice());
      const [pendingRows]: any = await pool.execute(pendingQuery, summaryParams.slice());
      const [inQueueRows]: any = await pool.execute(inQueueQuery, summaryParams.slice());

      const totalAttended = Number(attendedRows?.[0]?.totalAttended) || 0;
      const totalCancelled = Number(cancelledRows?.[0]?.totalCancelled) || 0;
      const totalPending = Number(pendingRows?.[0]?.totalPending) || 0;
      const totalInQueue = Number(inQueueRows?.[0]?.totalInQueue) || 0;

    // --- Average per month ---
    const now = new Date();
    const year = now.getFullYear();
    const [avgRows]: any = await pool.execute(
      "SELECT COUNT(*) / 12 AS avg_per_month FROM bookings WHERE YEAR(date) = ?",
      [year]
    );
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
    const { id } = body;
    if (!id)
      return NextResponse.json({ success: false, error: "ไม่พบ id" }, { status: 400 });

    await pool.execute("UPDATE bookings SET payment_status = 'paid' WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating payment status:", error);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถอัปเดตการจ่ายเงินได้" },
      { status: 500 }
    );
  }
}
