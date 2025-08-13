// /app/api/delete-booking/route.ts
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "lmwcc.synology.me",
  user: "medthai",
  password: "I4FEtUu*-uB-hAK0",
  database: "medthai",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ success: false, message: "Missing booking id" }, { status: 400 });
  }

  const conn = await pool.getConnection();

  try {
    // หาเบอร์โทรและ therapist จาก booking ที่จะยกเลิก
    const [rows] = await conn.query("SELECT phone, therapist FROM bookings WHERE id = ?", [id]);
    if ((rows as any).length === 0) {
      conn.release();
      return NextResponse.json({ success: false, message: "Booking not found" }, { status: 404 });
    }
    const phone = (rows as any)[0].phone;
    const therapistName = (rows as any)[0].therapist;

    // อัปเดตสถานะ booking เป็น "ยกเลิก"
    await conn.query("UPDATE bookings SET status = 'ยกเลิก' WHERE id = ?", [id]);

    // ตรวจสอบว่าผู้ใช้ยังมี booking ที่สถานะไม่ใช่ยกเลิกอยู่หรือไม่
    const [activeBookings] = await conn.query(
      "SELECT COUNT(*) as count FROM bookings WHERE phone = ? AND status != 'ยกเลิก'",
      [phone]
    );
    const count = (activeBookings as any)[0].count;

    // ถ้าไม่มี booking ที่ active อยู่แล้ว ให้ตั้ง Reservation = 0
    if (count === 0) {
      await conn.query("UPDATE users SET Reservation = 0 WHERE phone = ?", [phone]);
    }

    // อัปเดต therapist.active_status = 0 (default) สำหรับ therapist ที่ถูกยกเลิก booking
    await conn.query("UPDATE therapist SET active_status = 0 WHERE name = ?", [therapistName]);

    conn.release();

    return NextResponse.json({ success: true });
  } catch (error) {
    conn.release();
    console.error("Cancel booking error:", error);
    return NextResponse.json({ success: false, message: "Database error" }, { status: 500 });
  }
}
