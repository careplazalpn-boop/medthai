// /app/api/cancel-booking/route.ts
import { NextRequest, NextResponse } from "next/server";
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

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { success: false, message: "Missing booking id" },
      { status: 400 }
    );
  }

  const conn = await pool.getConnection();
  try {
    // ตรวจสอบว่ามี booking อยู่หรือไม่
    const [rows] = await conn.query("SELECT id FROM bookings WHERE id = ?", [id]);
    if ((rows as any).length === 0) {
      conn.release();
      return NextResponse.json(
        { success: false, message: "Booking not found" },
        { status: 404 }
      );
    }

    // อัปเดตสถานะ booking เป็น "ยกเลิก"
    await conn.query("UPDATE bookings SET status = 'ยกเลิก' WHERE id = ?", [id]);

    conn.release();
    return NextResponse.json({ success: true });
  } catch (error) {
    conn.release();
    console.error("Cancel booking error:", error);
    return NextResponse.json(
      { success: false, message: "Database error" },
      { status: 500 }
    );
  }
}
