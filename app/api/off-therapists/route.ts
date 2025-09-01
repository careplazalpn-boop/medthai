import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "lmwcc.synology.me",
  user: "medthai",
  password: "I4FEtUu*-uB-hAK0",
  database: "medthai",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ success: false, offTherapists: [] });

  try {
    const [rows]: any = await pool.query("SELECT name, off_date FROM therapist");
    const offTherapists: string[] = [];

    rows.forEach((row: any) => {
      if (row.off_date) {
        const offDates = row.off_date.split(",").map((d: string) => d.trim());
        if (offDates.includes(date)) offTherapists.push(row.name);
      }
    });

    return NextResponse.json({ success: true, offTherapists });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, offTherapists: [] });
  }
}
