// app/api/update-booking-name/route.ts
import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "lmwcc.synology.me",
  user: "medthai",
  password: "I4FEtUu*-uB-hAK0",
  database: "medthai",
});

export async function POST(req: NextRequest) {
  try {
    const { id, name } = await req.json();
    if (!id || !name) return NextResponse.json({ success: false, error: "Missing id or name" });

    await pool.query("UPDATE bookings SET name=? WHERE id=?", [name, id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message });
  }
}
