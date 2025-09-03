import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "lmwcc.synology.me",
  user: "medthai",
  password: "I4FEtUu*-uB-hAK0",
  database: "medthai",
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const confirmId = url.searchParams.get("confirmId");

    if (confirmId) {
      await pool.execute("UPDATE bookings SET status = 'อยู่ในคิว' WHERE id = ?", [confirmId]);
    }

    const [rows]: any = await pool.execute(
      "SELECT id, provider, name, phone, therapist, time_slot, date, status FROM bookings ORDER BY id DESC"
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

      if (booking.status === "รอดำเนินการ" && now >= endTime) {
        newStatus = "สำเร็จ";
      }
      if (booking.status === "อยู่ในคิว" && now >= endTime) {
        newStatus = "สำเร็จ";
      }

      if (booking.status !== newStatus) {
        await pool.execute("UPDATE bookings SET status = ? WHERE id = ?", [newStatus, booking.id]);
        booking.status = newStatus;
      }
    }

    return NextResponse.json({ success: true, bookings: rows });
  } catch (error) {
    console.error("Error fetching all bookings:", error);
    return NextResponse.json({ success: false, error: "ไม่สามารถดึงข้อมูลการจองทั้งหมดได้" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "ไม่พบ id" }, { status: 400 });

    await pool.execute("DELETE FROM bookings WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting booking:", error);
    return NextResponse.json({ success: false, error: "ไม่สามารถลบรายการได้" }, { status: 500 });
  }
}
