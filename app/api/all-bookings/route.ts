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
    if (
      (filterDate && filterDate !== "all") ||
      (filterTimeSlot && filterTimeSlot !== "all") ||
      (filterProvider && filterProvider !== "all") ||
      (filterTherapist && filterTherapist !== "all") ||
      (filterStatus && filterStatus !== "")
    ) {
      page = 1;
    }

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

    query += `
      ORDER BY 
        date ASC,
        STR_TO_DATE(SUBSTRING_INDEX(time_slot, '-', 1), '%H:%i') ASC,
        name ASC
      LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    // --- ดึงข้อมูล ---
    const [rows]: any = await pool.execute(query, queryParams);
    const [countRows]: any = await pool.execute(countQuery, countParams);

    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);
// 1. Query สำหรับนับ "สำเร็จ" (Attended)
    let attendedQuery = `
      SELECT COUNT(*) AS totalAttended FROM bookings 
      WHERE 1=1 AND status = 'สำเร็จ' ${countQuery.replace('SELECT COUNT(*) AS total FROM bookings WHERE 1=1', '').replace('WHERE 1=1', '')}
    `;

    // 2. Query สำหรับนับ "ยกเลิก" (Cancelled)
    let cancelledQuery = `
      SELECT COUNT(*) AS totalCancelled FROM bookings 
      WHERE 1=1 AND status = 'ยกเลิก' ${countQuery.replace('SELECT COUNT(*) AS total FROM bookings WHERE 1=1', '').replace('WHERE 1=1', '')}
    `;
    // --- Summary ---
    const [allRows]: any = await pool.execute("SELECT status FROM bookings");
    const totalAttended = allRows.filter((b: any) => b.status === "สำเร็จ").length;
    const totalCancelled = allRows.filter((b: any) => b.status === "ยกเลิก").length;

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
      summary: { totalAttended, totalCancelled },
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
