// app/api/new-user/route.ts
import { NextResponse } from "next/server";
import pool from '../dbconnection/db';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { name, phone, idCard, therapist, time, date, provider } = data;

    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!phone) missingFields.push("phone");
    if (!therapist) missingFields.push("therapist");
    if (!time) missingFields.push("time");
    if (!date) missingFields.push("date");
    if (!provider) missingFields.push("provider");

    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `ข้อมูลไม่ครบถ้วน: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();
    try {
      // ตรวจสอบว่ามี id_card_number อยู่แล้วหรือยัง
      const [rows]: any = await conn.query(
        "SELECT id_card_number FROM new_user WHERE id_card_number = ?",
        [idCard]
      );

      if (rows.length === 0) {
        // ถ้ายังไม่มี id_card_number นี้ → insert
        await conn.query(
          "INSERT INTO new_user (name, id_card_number, mobile_phone_number) VALUES (?, ?, ?)",
          [name, idCard, phone || null]
        );
      }

      // บันทึก bookings (ทำทุกครั้ง)
      await conn.query(
        "INSERT INTO bookings (name, phone, date, therapist, time_slot, provider, status) VALUES (?, ?, ?, ?, ?, ?, 'รอดำเนินการ')",
        [name, phone, date, therapist, time, provider]
      );
    } finally {
      conn.release();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("New user booking error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดจากระบบ" },
      { status: 500 }
    );
  }
}
