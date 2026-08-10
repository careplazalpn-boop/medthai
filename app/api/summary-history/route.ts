import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

// ฟังก์ชันสำหรับอัปเดตสถานะในฐานข้อมูลโดยตรง
async function updateBookingStatus(status: string, bookingId: string | number) {
  const conn = await pool.getConnection();
  try {
    await conn.query("UPDATE bookings SET status = ? WHERE id = ?", [status, bookingId]);
  } finally {
    conn.release();
  }
}

// GET: ดึง bookings ทั้งหมด พร้อม payment_status และสถิติเตียงพิเศษ
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const confirmId = url.searchParams.get("confirmId");
    const now = new Date();

    const conn = await pool.getConnection();

    try {
      // --- 1. อัปเดตสถานะ Auto-Update ในฐานข้อมูลก่อน (Single Query) ---
      // ตรวจสอบ booking ที่ 'อยู่ในคิว' หรือ 'รอดำเนินการ' และเวลาสิ้นสุดผ่านไปแล้ว ให้เปลี่ยนเป็น 'สำเร็จ'
      await conn.query(`
        UPDATE bookings
        SET status = 'สำเร็จ'
        WHERE status IN ('อยู่ในคิว', 'รอดำเนินการ')
        AND CONCAT(date, ' ', TRIM(SUBSTRING_INDEX(time_slot, '-', -1))) <= NOW()
      `);

      // --- 2. ฟังก์ชัน confirm booking (ถ้ามี confirmId) ---
      let updatedStatus: string | null = null;
      if (confirmId) {
        const [bookingRows]: any = await conn.query(
          "SELECT id, time_slot, date FROM bookings WHERE id = ?",
          [confirmId]
        );
        const booking = bookingRows[0];
        
        if (booking) {
          const [result]: any = await conn.query(`
            UPDATE bookings 
            SET status = CASE 
              WHEN CONCAT(date, ' ', TRIM(SUBSTRING_INDEX(time_slot, '-', -1))) <= NOW() THEN 'สำเร็จ'
              ELSE 'อยู่ในคิว'
            END
            WHERE id = ?`, 
            [confirmId]
          );
          
          if (result.affectedRows > 0) {
            const [updatedRows]: any = await conn.query(
              "SELECT status FROM bookings WHERE id = ?",
              [confirmId]
            );
            updatedStatus = updatedRows[0]?.status || null;
          }
        }
      }

      // --- 3. ดึงข้อมูลทั้งหมดรวมเตียงพิเศษและสิทธิการรักษา ---
      const [rows]: any = await conn.query(`
        SELECT 
          b.id, 
          b.provider,
          b.name,
          b.phone,
          b.therapist, 
          b.time_slot,
          b.status, 
          b.date, 
          b.payment_status,
          b.created_at,
          sbb.id AS special_booking_id,
          sbb.bed_id,
          sbb.status AS special_bed_status,
          sb.bed_name,
          sb.room_name
        FROM bookings b
        LEFT JOIN special_bed_bookings sbb ON b.id = sbb.booking_id
        LEFT JOIN special_beds sb ON sbb.bed_id = sb.id
        ORDER BY b.date DESC, b.id DESC
      `);

      // --- 4. ดึงรายชื่อเตียงพิเศษทั้งหมด ---
      const [beds]: any = await conn.query(
        "SELECT id, bed_code, bed_name, room_name FROM special_beds ORDER BY id ASC"
      );

      // --- 5. คำนวณเฉลี่ยต่อเดือน ---
      const year = now.getFullYear();
      const [avgRows]: any = await conn.query(
        "SELECT COUNT(*) / 12 AS avg_per_month FROM bookings WHERE YEAR(date) = ?",
        [year]
      );
      const avgPerMonth = avgRows[0]?.avg_per_month || 0;

      return NextResponse.json({
        success: true,
        bookings: rows,
        specialBeds: beds,
        updatedStatus,
        avgPerMonth,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error("GET /api/summary-history error:", error);
    const status = error && error.code === 'ER_NO_SUCH_TABLE' ? 404 : 500;
    return NextResponse.json(
      { success: false, error: "ไม่สามารถดึงข้อมูลการจองทั้งหมดได้" },
      { status }
    );
  }
}

// DELETE: ลบ booking
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "ไม่พบ id" }, { status: 400 });

    const conn = await pool.getConnection();
    try {
      await conn.query("DELETE FROM bookings WHERE id = ?", [id]);
    } finally {
      conn.release();
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting booking:", error);
    return NextResponse.json({ success: false, error: "ไม่สามารถลบรายการได้" }, { status: 500 });
  }
}

// POST: mark payment
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ success: false, error: "ไม่พบ id" }, { status: 400 });

    const conn = await pool.getConnection();
    try {
      await conn.query("UPDATE bookings SET payment_status = 'paid' WHERE id = ?", [id]);
    } finally {
      conn.release();
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating payment status:", error);
    return NextResponse.json({ success: false, error: "ไม่สามารถอัปเดตการจ่ายเงินได้" }, { status: 500 });
  }
}