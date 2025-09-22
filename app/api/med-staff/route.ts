import { NextResponse } from "next/server";
import pool from '../dbconnection/db';

export async function GET() {
  try {
    const [rows] = await pool.query("SELECT name FROM med_staff ORDER BY id ASC");
    return NextResponse.json({ success: true, staff: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: "Cannot fetch med_staff" });
  }
}
