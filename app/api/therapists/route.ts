import { NextResponse } from "next/server";
import pool from '../dbconnection/db';

export async function GET() {
  try {
    const [rows] = await pool.query("SELECT name FROM therapist ORDER BY id ASC");
    const therapists = (rows as any[]).map(r => r.name);
    return NextResponse.json({ success: true, therapists });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch therapists" });
  }
}
