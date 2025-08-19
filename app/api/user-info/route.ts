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
  const phone = searchParams.get("phone")?.replace(/-/g, "") || "";
  const hn = searchParams.get("hn")?.trim() || "";
  const name = searchParams.get("name")?.trim() || "";

  if (!phone && !hn && !name) {
    return NextResponse.json({ success: false, error: "กรุณาระบุ HN, เบอร์โทร หรือชื่อเต็ม" }, { status: 400 });
  }

  try {
    const conn = await pool.getConnection();

    let query = "";
    let params: string[] = [];

    if (name) {
      query = "SELECT hn, pname, fname, lname, mobile_phone_number FROM med_user WHERE CONCAT(pname, fname, ' ', lname) = ? LIMIT 1";
      params = [name];
    } else if (hn) {
      query = "SELECT hn, pname, fname, lname, mobile_phone_number FROM med_user WHERE hn = ? LIMIT 1";
      params = [hn];
    } else if (phone) {
      query = "SELECT hn, pname, fname, lname, mobile_phone_number FROM med_user WHERE REPLACE(mobile_phone_number, '-', '') = ? LIMIT 1";
      params = [phone];
    }

    const [rows] = await conn.query(query, params);
    conn.release();

    if ((rows as any).length === 0) {
      return NextResponse.json({ success: false, error: "ไม่พบข้อมูลผู้ใช้" }, { status: 404 });
    }

    const user = (rows as any)[0];
    const fullName = user.pname + user.fname + " " + user.lname;

    return NextResponse.json({
      success: true,
      hn: user.hn,
      name: fullName,
      phone: user.mobile_phone_number,
    });
  } catch (error) {
    console.error("GET user-info error:", error);
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาดจากระบบ" }, { status: 500 });
  }
}
