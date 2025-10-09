import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

export async function POST(req: Request) {
  try {
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ success: false, error: "Missing parameters" });
    }

    await pool.execute("UPDATE bookings SET payment_status = ? WHERE id = ?", [status, id]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error updating payment status:", err);
    return NextResponse.json({ success: false, error: "Internal server error" });
  }
}
