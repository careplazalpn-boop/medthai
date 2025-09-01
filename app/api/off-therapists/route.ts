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

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ success: false, offTherapists: [] });

  try {
    const [rows]: any = await pool.query("SELECT name, off_date FROM therapist");
    const offTherapists: string[] = [];

    const todayTH = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); 
    // ใช้ en-CA เพื่อได้รูปแบบ YYYY-MM-DD ตรงกับฐานข้อมูล

    for (const row of rows) {
      if (row.off_date) {
        // แยกวันที่และกรองเอาเฉพาะวันที่ยังไม่ผ่าน
        const offDates = row.off_date
          .split(",")
          .map((d: string) => d.trim())
          .filter((d: string) => d >= todayTH);

        // อัปเดตฐานข้อมูลเพื่อลบวันที่เก่าออก
        if (offDates.join(",") !== row.off_date) {
          await pool.query("UPDATE therapist SET off_date = ? WHERE name = ?", [offDates.join(","), row.name]);
        }

        // ถ้าวันที่ที่ส่งมามีอยู่ใน offDates ให้เพิ่มชื่อ therapist
        if (offDates.includes(date)) {
          offTherapists.push(row.name);
        }
      }
    }

    return NextResponse.json({ success: true, offTherapists });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, offTherapists: [] });
  }
}
