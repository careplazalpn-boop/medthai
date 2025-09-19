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
    const { id, pname, fname, lname } = await req.json();

    if (!id || (!pname && !fname && !lname)) {
      return NextResponse.json({ success: false, error: "Missing id or name parts" });
    }

    // รวม pname+fname ติดกัน แล้วตามด้วย lname
    const fullName = [pname + fname, lname].filter(Boolean).join(" ");

    // อัปเดต name ใน bookings
    await pool.query("UPDATE bookings SET name=? WHERE id=?", [fullName, id]);

    // ดึง hn จาก bookings
    const [rows]: any = await pool.query("SELECT hn FROM bookings WHERE id=?", [id]);

    if (rows.length > 0 && rows[0].hn) {
      const hn = rows[0].hn;

      // อัปเดต med_user: name, pname, fname, lname
      await pool.query(
        "UPDATE med_user SET name=?, pname=?, fname=?, lname=? WHERE hn=?",
        [fullName, pname, fname, lname, hn]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: (err as Error).message });
  }
}