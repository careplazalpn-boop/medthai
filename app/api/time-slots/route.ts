import { NextResponse } from "next/server";
import pool from '../dbconnection/db';

export async function GET() {
  try {
    const [rows] = await pool.query("SELECT slot FROM time_slot ORDER BY id ASC");
    const timeSlots = (rows as any[]).map(r => r.slot);
    return NextResponse.json({ success: true, timeSlots });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch time slots" });
  }
}