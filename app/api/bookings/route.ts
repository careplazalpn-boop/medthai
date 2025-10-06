// app/api/bookings/route.ts
import { NextResponse } from "next/server";
import pool from '../dbconnection/db';

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  if (!date)
    return NextResponse.json(
      { success: false, error: "กรุณาระบุวันที่" },
      { status: 400 }
    );

  try {
    const conn = await pool.getConnection();
    // ดึง name และ bookedbyrole ของผู้จองมาด้วย
    const [rows] = await conn.query(
      "SELECT therapist, time_slot, name, status, bookedbyrole FROM bookings WHERE date = ? AND status != 'ยกเลิก'",
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

export async function POST(request: Request) {
  try {
    const { provider, hn, name, phone, therapist, time, date, bookedbyrole } =
      await request.json();

    // ตรวจ field จำเป็น
    const missingFields = [];
    if (!provider) missingFields.push("provider");
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
      // เช็คว่ามีการจองซ้ำหรือยัง
      const [existing] = await conn.query(
        "SELECT * FROM bookings WHERE hn = ? AND name = ? AND phone = ? AND therapist = ? AND time_slot = ? AND date = ? AND status != 'ยกเลิก'",
        [hn || null, name, phone, therapist, time, date]
      );

      // ถ้ามี record อยู่แล้ว
      if ((existing as any).length > 0) {
        return NextResponse.json(
          { success: false, error: "คุณได้ทำการจองในช่วงเวลานี้แล้ว" },
          { status: 400 }
        );
      }

      // Insert ข้อมูลใหม่
      await conn.query(
        "INSERT INTO bookings (hn, name, phone, date, therapist, time_slot, provider, bookedbyrole, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'รอดำเนินการ')",
        [hn || null, name, phone, date, therapist, time, provider, bookedbyrole || 'user']
      );
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