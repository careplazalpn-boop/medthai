import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

// 📌 GET: ดึงรายการช่วงเวลาทั้งหมดจากตาราง time_slot
export async function GET() {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT slot FROM time_slot ORDER BY id ASC"
    );
    conn.release();

    const timeSlots = (rows as any[]).map((r) => r.slot);

    return NextResponse.json({
      success: true,
      timeSlots,
    });
  } catch (error) {
    console.error("GET /api/time-slots error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch time slots" },
      { status: 500 }
    );
  }
}