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

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  if (!date) return NextResponse.json({ success: false, error: "กรุณาระบุวันที่" }, { status: 400 });

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
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { provider, hn, name, phone, therapist, time, date } = await request.json();

    // ตรวจสอบ field จำเป็น
    const missingFields = [];
    if (!provider) missingFields.push("provider");
    if (!hn) missingFields.push("hn");
    if (!name) missingFields.push("name");
    if (!phone) missingFields.push("phone");
    if (!therapist) missingFields.push("therapist");
    if (!time) missingFields.push("time");
    if (!date) missingFields.push("date");

    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `ข้อมูลไม่ครบถ้วน: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();
    try {
      // ตรวจสอบ user เก่ามี booking รอดำเนินการอยู่หรือไม่
      const [userRows] = await conn.query(
        "SELECT * FROM bookings WHERE hn = ? AND status = 'รอดำเนินการ' LIMIT 1",
        [hn]
      );
      if ((userRows as any).length > 0) {
        return NextResponse.json({ success: false, error: "คุณมีการจองอยู่แล้ว ไม่สามารถจองเพิ่มได้" }, { status: 409 });
      }

      // ตรวจสอบช่วงเวลาว่าง
      const [rows] = await conn.query(
        "SELECT COUNT(*) as count FROM bookings WHERE therapist = ? AND time_slot = ? AND date = ? AND status != 'ยกเลิก'",
        [therapist, time, date]
      );
      if ((rows as any)[0].count > 0) {
        return NextResponse.json({ success: false, error: "ช่วงเวลานี้ถูกจองไปแล้ว" }, { status: 409 });
      }

      // บันทึก booking สำหรับ user เก่า
      await conn.query(
        "INSERT INTO bookings (hn, name, phone, date, therapist, time_slot, provider, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'รอดำเนินการ')",
        [hn, name, phone, date, therapist, time, provider]
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
