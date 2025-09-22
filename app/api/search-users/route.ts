import { NextRequest, NextResponse } from "next/server";
import pool from '../dbconnection/db';

export async function GET(req: NextRequest) {
  const hn = req.nextUrl.searchParams.get("hn")?.trim() || "";
  const name = req.nextUrl.searchParams.get("name")?.trim() || "";

  try {
    let rows: any[] = [];

    if (hn) {
      // ค้นเฉพาะ med_user ตาม HN
      const [r]: any = await pool.query(
        `SELECT hn, CONCAT(pname, fname, ' ', lname) AS name, NULL AS id_card_number, mobile_phone_number AS phone
         FROM med_user
         WHERE hn = ?
         LIMIT 100`,
        [hn]
      );
      rows = r;
    } else if (name) {
      const terms = name.split(/\s+/);
      const whereClauseMed = terms.map(() => `(CONCAT(pname, fname, ' ', lname) LIKE ? OR CONCAT(fname, ' ', lname) LIKE ?)` ).join(" AND ");
      const whereClauseNew = terms.map(() => `name LIKE ?`).join(" AND ");

      const params: string[] = [];
      terms.forEach(term => params.push(`%${term}%`, `%${term}%`)); // med_user
      terms.forEach(term => params.push(`%${term}%`)); // new_user

      const [r]: any = await pool.query(
        `
        SELECT hn, CONCAT(pname, fname, ' ', lname) AS name, NULL AS id_card_number, mobile_phone_number AS phone
        FROM med_user
        WHERE ${whereClauseMed}
        UNION ALL
        SELECT NULL AS hn, name, id_card_number, mobile_phone_number AS phone
        FROM new_user
        WHERE ${whereClauseNew}
        LIMIT 100
        `,
        params
      );
      rows = r;
    } else {
      return NextResponse.json({ success: false, message: "No search query" });
    }

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
