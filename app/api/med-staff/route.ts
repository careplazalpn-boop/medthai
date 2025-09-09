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
    const [rows] = await pool.query("SELECT name FROM med_staff ORDER BY id ASC");
    return NextResponse.json({ success: true, staff: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: "Cannot fetch med_staff" });
  }
}
