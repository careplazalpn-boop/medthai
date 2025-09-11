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

    // WHERE clause สำหรับ med_user
    const whereClauseMed = terms
      .map(() => `(CONCAT(pname, fname, lname) LIKE ? OR CONCAT(fname, ' ', lname) LIKE ?)` )
      .join(" AND ");

    // WHERE clause สำหรับ new_user
    const whereClauseNew = terms
      .map(() => `name LIKE ?`)
      .join(" AND ");

    const params: string[] = [];
    terms.forEach(term => {
      params.push(`%${term}%`, `%${term}%`); // med_user
    });
    terms.forEach(term => {
      params.push(`%${term}%`); // new_user
    });

    const [rows]: any = await pool.query(
      `
      SELECT 
        hn,
        CONCAT(pname, fname, ' ', lname) AS name,
        NULL AS id_card_number,
        mobile_phone_number AS phone
      FROM med_user
      WHERE ${whereClauseMed}

      UNION ALL

      SELECT 
        NULL AS hn,
        name,
        id_card_number,
        mobile_phone_number AS phone
      FROM new_user
      WHERE ${whereClauseNew}

      LIMIT 1000
      `,
      params
    );

    const users = rows.map((r: any) => ({
      hn: r.hn || "",
      name: r.name,
      id_card_number: r.id_card_number || "",
      phone: r.phone || "",
    }));

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "DB error" });
  }
}