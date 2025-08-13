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
    return NextResponse.json({ success: false, error: "กรุณาระบุเบอร์โทร" }, { status: 400 });
  }

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT hn, pname, fname, lname FROM med_user WHERE mobile_phone_number = ? LIMIT 1",
      [phone]
    );
    conn.release();

    if ((rows as any).length === 0) {
      return NextResponse.json({ success: false, error: "ไม่พบข้อมูลผู้ใช้" }, { status: 404 });
    }

    const user = (rows as any)[0];
    const name = user.pname + user.fname + " " + user.lname;

    return NextResponse.json({ success: true, hn: user.hn, name });
  } catch (error) {
    console.error("GET user error:", error);
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาดจากระบบ" }, { status: 500 });
  }
}
