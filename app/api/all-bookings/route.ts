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

    const [rows]: any = await pool.execute(
      "SELECT id, provider, name, phone, therapist, time_slot, date, status FROM bookings ORDER BY id DESC"
    );

    const now = new Date();
    let updatedStatus: string | null = null;

// ตัวอย่างฟังก์ชัน confirm booking
if (confirmId) {
  const booking = rows.find((b: any) => b.id.toString() === confirmId);
  if (booking) {
    const [, endStr] = booking.time_slot.split("-");
    const [endHour, endMinute = "00"] = endStr.split(":");

    // สร้าง Date ของ booking และ endTime
    const bookingDate = new Date(booking.date);
    const endTime = new Date(bookingDate);
    endTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

    // กำหนด status หลังกดยืนยัน
    const newStatus = now >= endTime ? "สำเร็จ" : "อยู่ในคิว";

    // อัปเดต database
    await pool.execute("UPDATE bookings SET status = ? WHERE id = ?", [newStatus, confirmId]);
    booking.status = newStatus;

    updatedStatus = newStatus; // ส่งกลับ frontend
  }
}

// --- auto-update สำหรับทุก booking ที่อยู่ในคิว
for (const booking of rows) {
  if (booking.status === "อยู่ในคิว") {
    const [, endStr] = booking.time_slot.split("-");
    const [endHour, endMinute = "00"] = endStr.split(":");

    const bookingDate = new Date(booking.date);
    const endTime = new Date(bookingDate);
    endTime.setHours(parseInt(endHour, 10), parseInt(endMinute, 10), 0, 0);

    if (now >= endTime) {
      booking.status = "สำเร็จ";
      await pool.execute("UPDATE bookings SET status = ? WHERE id = ?", ["สำเร็จ", booking.id]);
    }
  }
}

    return NextResponse.json({ success: true, bookings: rows, updatedStatus });
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
