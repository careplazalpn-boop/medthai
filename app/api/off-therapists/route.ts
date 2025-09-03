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
  if (!date) return NextResponse.json({ success: false, offTherapists: [], disabledSlotsByTherapist: {} });

  try {
    const [rows]: any = await pool.query(
      "SELECT name, off_date, disabled_slots FROM therapist"
    );

    const offTherapists: string[] = [];
    const disabledSlotsByTherapist: Record<string, string[]> = {};

    rows.forEach((row: any) => {
      // เช็ควันไม่มา
      if (row.off_date) {
        const offDates = row.off_date
          .split(",")
          .map((d: string) => d.trim());
        if (offDates.includes(date)) offTherapists.push(row.name);
      }

      // ดึง slot ปิดของวันที่เลือก
      if (row.disabled_slots) {
        const slots = row.disabled_slots
          .split(",")
          .map((d: string) => d.trim())
          .filter((s: string) => s.startsWith(date + "|"))
          .map((s: string) => s.split("|")[1]); // แยกเอาเฉพาะ HH.MM-HH.MM
        if (slots.length > 0) disabledSlotsByTherapist[row.name] = slots;
      }
    });

    return NextResponse.json({ success: true, offTherapists, disabledSlotsByTherapist });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, offTherapists: [], disabledSlotsByTherapist: {} });
  }
}
