import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "lmwcc.synology.me",
  user: "medthai",
  password: "I4FEtUu*-uB-hAK0",
  database: "medthai",
});

export async function GET() {
  try {
    const [rows] = await pool.query("SELECT slot FROM time_slot ORDER BY id ASC");
    const timeSlots = (rows as any[]).map(r => r.slot);
    return NextResponse.json({ success: true, timeSlots });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch time slots" });
  }
}