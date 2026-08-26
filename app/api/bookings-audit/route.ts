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
      // เช็ค booking ซ้ำเฉพาะ HN + therapist + time_slot + date
      const [existing] = await conn.query(
        "SELECT * FROM bookings WHERE hn = ? AND therapist = ? AND time_slot = ? AND date = ? AND status != 'ยกเลิก'",
        [hn || null, therapist, time, date]
      );

      if ((existing as any).length > 0) {
        return NextResponse.json(
          { success: false, error: "คุณได้ทำการจองในช่วงเวลานี้แล้ว" },
          { status: 400 }
        );
      }

      // ✅ ใหม่: หา therapist_id จากชื่อที่เลือก (best-effort) เพื่อบันทึกไว้ควบคู่กับชื่อเดิม
      // เหมือนกับ /api/bookings — ไม่กระทบการทำงานเดิมแม้หาไม่เจอ (บันทึกเป็น NULL แทน)
      let therapistId: number | null = null;
      try {
        const [therapistRows]: any = await conn.query(
          "SELECT id FROM therapist WHERE (name = ? OR fname = ?) AND status = 0 LIMIT 1",
          [therapist, therapist]
        );
        therapistId = therapistRows?.[0]?.id ?? null;
      } catch (lookupError) {
        console.error("หา therapist_id ไม่สำเร็จ (ไม่กระทบการจอง):", lookupError);
      }

      // Insert ข้อมูลใหม่
      await conn.query(
        "INSERT INTO bookings (hn, name, phone, date, therapist, therapist_id, time_slot, provider, bookedbyrole, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'รอดำเนินการ')",
        [hn || null, name, phone, date, therapist, therapistId, time, provider, bookedbyrole || 'user']
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