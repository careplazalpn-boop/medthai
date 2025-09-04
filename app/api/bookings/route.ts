// app/api/bookings/route.ts
import { NextResponse } from "next/server";
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

// GET bookings
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { success: false, error: "กรุณาระบุวันที่" },
      { status: 400 }
    );
  }

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT therapist, time_slot, status FROM bookings WHERE date = ? AND status != 'ยกเลิก'",
      [date]
    );
    conn.release();

    return NextResponse.json({ success: true, bookings: rows });
  } catch (error) {
    console.error("GET bookings error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}

// POST booking
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { provider, hn, name, phone, therapist, time, date } = data; // ✅ เพิ่ม provider

    if (!provider || !hn || !name || !phone || !therapist || !time || !date) { // ✅ ตรวจสอบ provider ด้วย
      return NextResponse.json(
        { success: false, error: "ข้อมูลไม่ครบถ้วน" },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();
    try {
      // ตรวจสอบว่ามีการจองค้างอยู่หรือไม่
      const [userRows] = await conn.query(
        "SELECT * FROM bookings WHERE name = ? AND status = 'รอดำเนินการ' LIMIT 1",
        [name]
      );
      const user = (userRows as any)[0];
      if (user) {
        return NextResponse.json(
          {
            success: false,
            error: "คุณมีการจองอยู่แล้ว ไม่สามารถจองเพิ่มได้",
          },
          { status: 409 }
        );
      }

      // ตรวจสอบช่วงเวลาว่าง
      const [rows] = await conn.query(
        "SELECT COUNT(*) as count FROM bookings WHERE therapist = ? AND time_slot = ? AND date = ? AND status != 'ยกเลิก'",
        [therapist, time, date]
      );
      const count = (rows as any)[0].count;
      if (count > 0) {
        return NextResponse.json(
          { success: false, error: "ช่วงเวลานี้ถูกจองไปแล้ว" },
          { status: 409 }
        );
      }

      // บันทึกข้อมูลการจอง พร้อม provider ✅
      await conn.query(
        "INSERT INTO bookings (provider, hn, name, phone, therapist, time_slot, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'รอดำเนินการ')",
        [provider, hn, name, phone, therapist, time, date]
      );

      // อัปเดตสถานะการจองใน users
      await conn.query("UPDATE users SET Reservation = TRUE WHERE phone = ?", [
        phone,
      ]);
    } finally {
      conn.release();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดจากระบบ" },
      { status: 500 }
    );
  }
}
