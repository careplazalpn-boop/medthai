// /app/api/delete-booking/route.ts
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

// สร้าง connection pool ไปยังฐานข้อมูล
const pool = mysql.createPool({
  host: "35.240.229.188",
  user: "dev",
  password: "4Bh4gEh.kV7PJ{91",
  database: "massage",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ฟังก์ชันสำหรับรับคำขอ DELETE
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ success: false, message: "Missing booking id" }, { status: 400 });
  }

  const conn = await pool.getConnection();

  try {
    // หาเบอร์โทรจาก booking ที่จะยกเลิก
    const [rows] = await conn.query("SELECT phone FROM bookings WHERE id = ?", [id]);
    if ((rows as any).length === 0) {
      conn.release();
      return NextResponse.json({ success: false, message: "Booking not found" }, { status: 404 });
    }
    const phone = (rows as any)[0].phone;

    // อัปเดตสถานะ booking เป็น "ยกเลิก"
    await conn.query("UPDATE bookings SET status = 'ยกเลิก' WHERE id = ?", [id]);

    // ตรวจสอบว่าผู้ใช้ยังมี booking ที่สถานะไม่ใช่ยกเลิกอยู่หรือไม่
    const [activeBookings] = await conn.query(
      "SELECT COUNT(*) as count FROM bookings WHERE phone = ? AND status != 'ยกเลิก'",
      [phone]
    );
    const count = (activeBookings as any)[0].count;

    // ถ้าไม่มี booking ที่ active อยู่แล้ว ให้ตั้ง Reservation = 0
      await conn.query("UPDATE users SET Reservation = 0 WHERE phone = ?", [phone]);

    conn.release();

    return NextResponse.json({ success: true });
  } catch (error) {
    conn.release();
    console.error("Cancel booking error:", error);
    return NextResponse.json({ success: false, message: "Database error" }, { status: 500 });
  }
}
