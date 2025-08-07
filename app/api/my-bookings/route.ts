import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "lmwcc.synology.me",
  user: "medthai",
  password: "I4FEtUu*-uB-hAK0",
  database: "medthai",
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ success: false, error: "ไม่มีเบอร์โทร" }, { status: 400 });
  }

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      "SELECT * FROM bookings WHERE phone = ? ORDER BY date DESC",
      [phone]
    );

    conn.release();
    return NextResponse.json({ success: true, bookings: rows });
  } catch (err) {
    conn.release();
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
