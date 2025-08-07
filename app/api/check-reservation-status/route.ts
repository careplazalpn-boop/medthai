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
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ success: false, error: "กรุณาระบุเบอร์โทรศัพท์" }, { status: 400 });
  }

  try {
    const conn = await pool.getConnection();

    // ดึงข้อมูลการจองที่สถานะไม่ใช่ 'ยกเลิก' ของผู้ใช้คนนี้
    const [bookings] = await conn.query(
      `SELECT date, time_slot FROM bookings WHERE phone = ? AND status != 'ยกเลิก'`,
      [phone]
    );

    // ฟังก์ชันแปลง time_slot เช่น "8.00-9.30" -> เวลาเริ่มต้น Date object
    function parseStartTime(timeSlot: string, dateStr: string): Date {
      const [start] = timeSlot.split("-");
      const [hourStr, minStrRaw] = start.split(".");
      const minStr = minStrRaw ?? "00"; // ถ้า minStrRaw เป็น undefined หรือ null จะใช้ "00"
      const date = new Date(dateStr);
      date.setHours(parseInt(hourStr, 10), parseInt(minStr, 10), 0, 0);
      return date;
    }

    const now = new Date();
    let hasActiveBooking = false;

    (bookings as any[]).forEach(({ date, time_slot }) => {
      const startTime = parseStartTime(time_slot, date);
      if (startTime > now) {
        hasActiveBooking = true;
      }
    });

    // อัปเดตฟิลด์ Reservation ของผู้ใช้ตามสถานะ hasActiveBooking
    await conn.query(
      "UPDATE users SET Reservation = ? WHERE phone = ?",
      [hasActiveBooking ? 1 : 0, phone]
    );

    conn.release();

    return NextResponse.json({
      success: true,
      hasActiveBooking,
    });
  } catch (error) {
    console.error("check-reservation-status error:", error);
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
