import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "35.240.229.188",
  user: "dev",
  password: "4Bh4gEh.kV7PJ{91",
  database: "massage",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ success: false, error: "กรุณาระบุวันที่" }, { status: 400 });
  }

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT therapist, time_slot FROM bookings WHERE date = ? AND status != 'ยกเลิก'",
      [date]
    );
    conn.release();

    return NextResponse.json({ success: true, bookings: rows });
  } catch (error) {
    console.error("GET bookings error:", error);
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { name, phone, therapist, time, date } = data;

    if (!name || !phone || !therapist || !time || !date) {
      return NextResponse.json({ success: false, error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
    }

    const conn = await pool.getConnection();
    try {
      // เช็คสถานะ Reservation ของ user
      const [userRows] = await conn.query(
        "SELECT * FROM bookings WHERE phone = ? LIMIT 1",
        [phone]
      );
      const user = (userRows as any)[0];
      if (user) {
        return NextResponse.json({ success: false, error: "คุณมีการจองอยู่แล้ว ไม่สามารถจองเพิ่มได้" }, { status: 409 });
      }

      // เช็คช่วงเวลาว่าง (ไม่รวม booking ที่ถูกยกเลิก)
      const [rows] = await conn.query(
        "SELECT COUNT(*) as count FROM bookings WHERE therapist = ? AND time_slot = ? AND date = ? AND status != 'ยกเลิก'",
        [therapist, time, date]
      );

      const count = (rows as any)[0].count;
      if (count > 0) {
        return NextResponse.json({ success: false, error: "ช่วงเวลานี้ถูกจองไปแล้ว" }, { status: 409 });
      }

      // บันทึกการจอง
      await conn.query(
        "INSERT INTO bookings (name, phone, therapist, time_slot, date, status) VALUES (?, ?, ?, ?, ?, 'รอดำเนินการ')",
        [name, phone, therapist, time, date]
      );

      // อัปเดตสถานะ Reservation ใน users เป็น TRUE
      await conn.query(
        "UPDATE users SET Reservation = TRUE WHERE phone = ?",
        [phone]
      );

    } finally {
      conn.release();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาดจากระบบ" }, { status: 500 });
  }
}
