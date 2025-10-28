import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

// ฟังก์ชันสำหรับอัปเดตสถานะ
async function updateBookingStatus(status: string, bookingId: string | number) {
  await pool.execute("UPDATE bookings SET status = ? WHERE id = ?", [status, bookingId]);
}

// GET: ดึง bookings ทั้งหมด พร้อม pagination + filterDate + summary
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // --- Pagination ---
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // --- Filter by query params ---
    const filterDate = url.searchParams.get("date");
    const provider = url.searchParams.get("provider");
    const status = url.searchParams.get("status");

    // --- Auto-update status ---
    await pool.execute(`
      UPDATE bookings
      SET status = 'สำเร็จ'
      WHERE status = 'อยู่ในคิว'
      AND CONCAT(date, ' ', SUBSTRING_INDEX(time_slot, '-', -1)) <= NOW()
    `);

    // --- Confirm booking (ถ้ามี confirmId) ---
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

    // --- Query bookings (filter + pagination + sorting) ---
    let query = `
      SELECT id, provider, name, phone, therapist, time_slot, date, status, payment_status, created_at
      FROM bookings
      WHERE 1=1
    `;
    let countQuery = `SELECT COUNT(*) AS total FROM bookings WHERE 1=1`;
    const queryParams: any[] = [];

    // เพิ่ม filter
    if (filterDate) {
      query += ` AND date = ?`;
      countQuery += ` AND date = ?`;
      queryParams.push(filterDate);
    }
    if (provider) {
      query += ` AND provider = ?`;
      countQuery += ` AND provider = ?`;
      queryParams.push(provider);
    }
    if (status) {
      query += ` AND status = ?`;
      countQuery += ` AND status = ?`;
      queryParams.push(status);
    }

    query += `
      ORDER BY 
        date ASC,
        STR_TO_DATE(SUBSTRING_INDEX(time_slot, '-', 1), '%H:%i') ASC,
        name ASC
      LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    const [rows]: any = await pool.execute(query, queryParams);
    const [countRows]: any = await pool.execute(countQuery, queryParams.slice(0, queryParams.length - 2));
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // --- Summary: สถานะ สำเร็จ / ยกเลิก ---
    const [allRows]: any = await pool.execute("SELECT status FROM bookings");
    const totalAttended = (allRows as { status: string }[]).filter((b) => b.status === "สำเร็จ").length;
    const totalCancelled = (allRows as { status: string }[]).filter((b) => b.status === "ยกเลิก").length;

    // --- Avg per month ---
    const now = new Date();
    const year = now.getFullYear();
    const [avgRows]: any = await pool.execute(
      "SELECT COUNT(*) / 12 AS avg_per_month FROM bookings WHERE YEAR(date) = ?",
      [year]
    );
    const avgPerMonth = avgRows[0].avg_per_month || 0;

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

// DELETE: ลบ booking
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

// POST: mark payment
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
