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
    const [rows] = await pool.query("SELECT name FROM therapist ORDER BY id ASC");
    const therapists = (rows as any[]).map(r => r.name);
    return NextResponse.json({ success: true, therapists });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to fetch therapists" });
  }
}
