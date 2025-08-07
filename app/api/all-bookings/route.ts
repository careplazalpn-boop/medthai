import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "lmwcc.synology.me",
  user: "medthai",
  password: "I4FEtUu*-uB-hAK0",
  database: "medthai",
});

export async function GET() {
  try {
    const [rows]: any = await pool.execute(
      "SELECT id, name, phone, therapist, time_slot, date, status FROM bookings ORDER BY id DESC"
    );

    const now = new Date();

    for (const booking of rows) {
      if (booking.status === "ยกเลิก") continue;

      const [startStr, endStr] = booking.time_slot.split("-");
      const [startHour, startMinute = "00"] = startStr.split(".");
      const [endHour, endMinute = "00"] = endStr.split(".");

      const bookingDate = new Date(booking.date);
      const startTime = new Date(bookingDate);
      const endTime = new Date(bookingDate);

      startTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
      endTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

      let newStatus = booking.status;

      if (now < startTime) {
        newStatus = "รอดำเนินการ";
      } else if (now >= startTime && now < endTime) {
        newStatus = "อยู่ในคิว";
      } else if (now >= endTime) {
        newStatus = "สำเร็จ";
      }

      if (booking.status !== newStatus) {
        await pool.execute(
          "UPDATE bookings SET status = ? WHERE id = ?",
          [newStatus, booking.id]
        );
        booking.status = newStatus;
      }
    }

    return NextResponse.json({ success: true, bookings: rows });
  } catch (error) {
    console.error("Error fetching all bookings:", error);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถดึงข้อมูลการจองทั้งหมดได้" },
      { status: 500 }
    );
  }
}
