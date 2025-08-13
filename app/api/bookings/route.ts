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

// ฟังก์ชันช่วยแปลง time slot เป็น Date ของไทย
const parseTimeSlot = (dateStr: string, slot: string): Date => {
  const [startStr] = slot.split("-");
  const [hourStr, minStr = "00"] = startStr.split(".");
  const dateTimeStr = `${dateStr} ${hourStr.padStart(2, "0")}:${minStr.padStart(2, "0")}:00`;
  return new Date(new Date(dateTimeStr).toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
};

// GET bookings
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ success: false, error: "กรุณาระบุวันที่" }, { status: 400 });
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
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// POST booking
export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { hn, name, phone, therapist, time, date } = data;

    if (!hn || !name || !phone || !therapist || !time || !date) {
      return NextResponse.json({ success: false, error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
    }

    const conn = await pool.getConnection();
    try {
      // ตรวจสอบว่ามีการจองค้างอยู่หรือไม่
      const [userRows] = await conn.query(
        "SELECT * FROM bookings WHERE phone = ? AND status = 'รอดำเนินการ' LIMIT 1",
        [phone]
      );
      const user = (userRows as any)[0];
      if (user) {
        return NextResponse.json({ success: false, error: "คุณมีการจองอยู่แล้ว ไม่สามารถจองเพิ่มได้" }, { status: 409 });
      }

      // ตรวจสอบช่วงเวลาว่าง
      const [rows] = await conn.query(
        "SELECT COUNT(*) as count FROM bookings WHERE therapist = ? AND time_slot = ? AND date = ? AND status != 'ยกเลิก'",
        [therapist, time, date]
      );
      const count = (rows as any)[0].count;
      if (count > 0) {
        return NextResponse.json({ success: false, error: "ช่วงเวลานี้ถูกจองไปแล้ว" }, { status: 409 });
      }

      // บันทึกข้อมูลการจอง
      await conn.query(
        "INSERT INTO bookings (hn, name, phone, therapist, time_slot, date, status) VALUES (?, ?, ?, ?, ?, ?, 'รอดำเนินการ')",
        [hn, name, phone, therapist, time, date]
      );

      // อัปเดตสถานะการจองใน users
      await conn.query("UPDATE users SET Reservation = TRUE WHERE phone = ?", [phone]);

    } finally {
      conn.release();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาดจากระบบ" }, { status: 500 });
  }
}

// API ใหม่สำหรับอัปเดต active_status
export async function PATCH(request: Request) {
  try {
    const conn = await pool.getConnection();
    try {
      // เวลาปัจจุบันของไทย
      const thailandTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));

      // ดึง booking ที่ยังอยู่ในคิว
      const [bookings] = await conn.query(
        "SELECT id, therapist, date, time_slot FROM bookings WHERE status = 'รอดำเนินการ'"
      );

      const updateTherapists = new Set<string>();

      (bookings as any).forEach((b: any) => {
        const slotTime = parseTimeSlot(b.date, b.time_slot);
        if (thailandTime >= slotTime) {
          updateTherapists.add(b.therapist);
        }
      });

      // อัปเดต active_status เป็น 1
      for (const therapist of updateTherapists) {
        await conn.query("UPDATE therapist SET active_status = 1 WHERE name = ?", [therapist]);
      }
    } finally {
      conn.release();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH update active_status error:", error);
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาดในการอัปเดต active_status" }, { status: 500 });
  }
}
