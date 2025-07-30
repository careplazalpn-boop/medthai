import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "35.240.229.188",
  user: "dev",
  password: "4Bh4gEh.kV7PJ{91",
  database: "massage",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ success: false, error: "กรุณาระบุเบอร์โทร" }, { status: 400 });
  }

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT Reservation FROM users WHERE phone = ? LIMIT 1",
      [phone]
    );
    conn.release();

    if ((rows as any).length === 0) {
      return NextResponse.json({ success: false, error: "ไม่พบข้อมูลผู้ใช้" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: (rows as any)[0] });
  } catch (error) {
    console.error("GET user error:", error);
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาดจากระบบ" }, { status: 500 });
  }
}
