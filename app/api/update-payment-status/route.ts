import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

export async function POST(req: Request) {
  try {
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ success: false, error: "Missing parameters" });
    }

    // ✅ ใหม่: เช็คสถานะปัจจุบันของ booking ก่อน — ถ้า "สำเร็จ" แล้ว ห้ามแก้ไข payment_status อีก
    // (กันกรณีมีการเรียก API นี้ตรงๆ โดยไม่ผ่านหน้าเว็บ ซึ่งฝั่ง UI ถูกล็อกไว้แล้ว)
    const [rows]: any = await pool.execute(
      "SELECT status FROM bookings WHERE id = ?",
      [id]
    );
    const booking = rows[0];
    if (!booking) {
      return NextResponse.json({ success: false, error: "ไม่พบรายการนี้" });
    }
    if (booking.status === "สำเร็จ") {
      return NextResponse.json({
        success: false,
        error: "รายการนี้สำเร็จแล้ว ไม่สามารถแก้ไขสถานะการจ่ายเงินได้",
      });
    }

    await pool.execute("UPDATE bookings SET payment_status = ? WHERE id = ?", [status, id]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error updating payment status:", err);
    return NextResponse.json({ success: false, error: "Internal server error" });
  }
}