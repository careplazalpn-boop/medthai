// app/api/update-user-phone/route.ts
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "lmwcc.synology.me",
  user: "medthai",
  password: "I4FEtUu*-uB-hAK0",
  database: "medthai",
});

// POST method
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { hn, phone } = body;

    if (!hn || !phone) {
      return NextResponse.json({ success: false, error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    const [rows]: any = await pool.query("SELECT mobile_phone_number FROM med_user WHERE hn = ?", [hn]);
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "ไม่พบผู้ใช้" }, { status: 404 });
    }

    const currentPhone = rows[0].mobile_phone_number;
    if (currentPhone === phone) {
      return NextResponse.json({ success: true, message: "เบอร์โทรเหมือนเดิม ไม่ต้องอัปเดต" });
    }

    await pool.query("UPDATE med_user SET mobile_phone_number = ? WHERE hn = ?", [phone, hn]);
    return NextResponse.json({ success: true, message: "อัปเดตเบอร์โทรเรียบร้อยแล้ว" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาดจากระบบ" }, { status: 500 });
  }
}