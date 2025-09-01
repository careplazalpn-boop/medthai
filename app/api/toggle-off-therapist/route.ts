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

export async function POST(req: NextRequest) {
  try {
    const { therapist, date }: { therapist: string; date: string } = await req.json();
    if (!therapist || !date) return NextResponse.json({ success: false, message: "Missing params" });

    const conn = await pool.getConnection();

    // ดึงค่า off_date ปัจจุบัน
    const [rows]: any = await conn.query("SELECT off_date FROM therapist WHERE name = ?", [therapist]);
    let offDates: string[] = [];

    if (rows[0]?.off_date) {
      const val = rows[0].off_date;
      // ตรวจสอบว่าเป็น string
      if (typeof val === "string") offDates = val.split(",").map((d: string) => d.trim()).filter(Boolean);
    }

    const formattedDate = date; // date ส่งมาเป็น "YYYY-MM-DD"

    if (offDates.includes(formattedDate)) {
      // ถ้าวันนี้อยู่ใน list → ลบออก (ยกเลิกไม่มา)
      offDates = offDates.filter(d => d !== formattedDate);
    } else {
      // เพิ่มวันใหม่
      offDates.push(formattedDate);
    }

    // อัปเดตค่าใหม่ใน DB
    const newOffDate = offDates.length > 0 ? offDates.join(",") : null;
    await conn.query("UPDATE therapist SET off_date = ? WHERE name = ?", [newOffDate, therapist]);

    conn.release();
    return NextResponse.json({ success: true, offDates });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: "ไม่สามารถอัปเดตหมอไม่มาได้" });
  }
}
