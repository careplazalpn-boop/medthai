import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "massage_booking",
});

export async function POST() {
  try {
    const [rows]: any = await pool.execute("SELECT id, time_slot, date, status FROM bookings");

    const now = new Date();

    for (const booking of rows) {
      if (booking.status === "ยกเลิก") continue;

      const [startStr, endStr] = booking.time_slot.split("-");
      const [startHour, startMinute = "00"] = startStr.split(".");
      const [endHour, endMinute = "00"] = endStr.split(".");

      const bookingDate = new Date(booking.date);
      const startTime = new Date(bookingDate);
      const endTime = new Date(bookingDate);

      startTime.setHours(parseInt(startHour), parseInt(startMinute));
      endTime.setHours(parseInt(endHour), parseInt(endMinute));

      let newStatus = booking.status;

      if (now < startTime) {
        newStatus = "รอดำเนินการ";
      } else if (now >= startTime && now < endTime) {
        newStatus = "อยู่ในคิว";
      } else {
        newStatus = "สำเร็จ";
      }

      if (booking.status !== newStatus) {
        await pool.execute("UPDATE bookings SET status = ? WHERE id = ?", [newStatus, booking.id]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาดในการอัปเดตสถานะ" });
  }
}
