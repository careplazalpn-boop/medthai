import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "lmwcc.synology.me",
  user: "medthai",
  password: "I4FEtUu*-uB-hAK0",
  database: "medthai",
});

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") || "";

  if (!name.trim()) {
    return NextResponse.json({ success: false, message: "No name" });
  }

  try {
    const [rows]: any = await pool.query(
      `SELECT hn, pname, fname, lname, mobile_phone_number AS phone
       FROM med_user
       WHERE fname LIKE ?
       LIMIT 500`,
      [`%${name}%`]
    );

    // รวมคำนำหน้า + ชื่อ + นามสกุล
    const users = rows.map((r: any) => ({
      hn: r.hn,
      name: `${r.pname}${r.fname} ${r.lname}`, // รวมคำนำหน้า
      phone: r.phone || "",
    }));

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "DB error" });
  }
}
