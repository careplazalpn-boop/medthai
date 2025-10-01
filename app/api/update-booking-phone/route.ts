
import { NextRequest, NextResponse } from "next/server";
import pool from '../dbconnection/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, phone } = body;

    if (!id || !phone) {
      return NextResponse.json({ success: false, error: "Missing id or phone" }, { status: 400 });
    }

    await pool.query("UPDATE bookings SET phone = ? WHERE id = ?", [phone, id]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}