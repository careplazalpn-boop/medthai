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
    // แยกคำจาก input
    const terms = name.trim().split(/\s+/);

    // สร้าง WHERE clause สำหรับแต่ละคำ
const whereClause = terms
  .map(() => `(CONCAT(pname, fname, lname) LIKE ? OR CONCAT(fname, ' ', lname) LIKE ?)` )
  .join(" AND ");

const params: string[] = [];
terms.forEach(term => {
  params.push(`%${term}%`, `%${term}%`);
});

    const [rows]: any = await pool.query(
      `SELECT hn, pname, fname, lname, mobile_phone_number AS phone
       FROM med_user
       WHERE ${whereClause}
       LIMIT 1000`,
      params
    );

    const users = rows.map((r: any) => ({
      hn: r.hn,
      name: `${r.pname}${r.fname} ${r.lname}`,
      phone: r.phone || "",
    }));

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "DB error" });
  }
}
