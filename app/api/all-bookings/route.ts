import { NextResponse } from "next/server";
import pool from '../dbconnection/db';

// GET: ดึง bookings ทั้งหมด พร้อม payment_status
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const confirmId = url.searchParams.get("confirmId");

    // ดึง booking ทั้งหมด พร้อม payment_status
    const [rows]: any = await pool.execute(
      "SELECT id, provider, name, phone, therapist, time_slot, date, status, payment_status, created_at FROM bookings ORDER BY id DESC"
    );

    const now = new Date();
    let updatedStatus: string | null = null;

    // ฟังก์ชัน confirm booking
    if (confirmId) {
      const booking = rows.find((b: any) => b.id.toString() === confirmId);
      if (booking) {
        const [, endStr] = booking.time_slot.split("-");
        const [endHour, endMinute = "00"] = endStr.split(":");
        const bookingDate = new Date(booking.date);
        const endTime = new Date(bookingDate);
        endTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

        const newStatus = now >= endTime ? "สำเร็จ" : "อยู่ในคิว";

        await pool.execute("UPDATE bookings SET status = ? WHERE id = ?", [newStatus, confirmId]);
        booking.status = newStatus;
        updatedStatus = newStatus;
      }
    }

    // auto-update สำหรับ booking ที่อยู่ในคิว
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

    // ✅ เพิ่มคำนวณเฉลี่ยต่อเดือน
    const year = now.getFullYear();
    const [avgRows]: any = await pool.execute(
      "SELECT COUNT(*) / 12 AS avg_per_month FROM bookings WHERE YEAR(date) = ?",
      [year]
    );
    const avgPerMonth = avgRows[0].avg_per_month || 0;

    return NextResponse.json({ success: true, bookings: rows, updatedStatus, avgPerMonth });
  } catch (error) {
    console.error("Error fetching all bookings:", error);
    return NextResponse.json({ success: false, error: "ไม่สามารถดึงข้อมูลการจองทั้งหมดได้" }, { status: 500 });
  }
}

// DELETE: ลบ booking
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

// POST: mark payment
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ success: false, error: "ไม่พบ id" }, { status: 400 });

    await pool.execute("UPDATE bookings SET payment_status = 'paid' WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating payment status:", error);
    return NextResponse.json({ success: false, error: "ไม่สามารถอัปเดตการจ่ายเงินได้" }, { status: 500 });
  }
}
