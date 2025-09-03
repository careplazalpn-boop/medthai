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
    const { therapist, date, slot }: { therapist: string; date: string; slot?: string } = await req.json();
    if (!therapist || !date) return NextResponse.json({ success: false, message: "Missing params" });

    const conn = await pool.getConnection();

    // ดึงค่า off_date และ disabled_slots ปัจจุบัน
    const [rows]: any = await conn.query("SELECT off_date, disabled_slots FROM therapist WHERE name = ?", [therapist]);
    let offDates: string[] = [];
    let disabledSlots: string[] = [];

    if (rows[0]?.off_date) {
      offDates = rows[0].off_date.split(",").map((d: string) => d.trim()).filter(Boolean);
    }
    if (rows[0]?.disabled_slots) {
      disabledSlots = rows[0].disabled_slots.split(",").map((d: string) => d.trim()).filter(Boolean);
    }

    if (slot) {
      // toggle slot ปิด/เปิด
      const key = `${date}|${slot}`;
      if (disabledSlots.includes(key)) disabledSlots = disabledSlots.filter(d => d !== key);
      else disabledSlots.push(key);
    } else {
      // toggle วันไม่มา → update off_date
      if (offDates.includes(date)) offDates = offDates.filter(d => d !== date);
      else offDates.push(date);
    }

    // update DB ทั้งสองคอลัมน์
    await conn.query(
      "UPDATE therapist SET off_date = ?, disabled_slots = ? WHERE name = ?",
      [
        offDates.length > 0 ? offDates.join(",") : null,
        disabledSlots.length > 0 ? disabledSlots.join(",") : null,
        therapist
      ]
    );

    conn.release();
    return NextResponse.json({ success: true, offDates, disabledSlots, toggled: slot ? `${date}|${slot}` : date });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: "ไม่สามารถอัปเดตได้" });
  }
}
