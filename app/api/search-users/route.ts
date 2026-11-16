import { NextRequest, NextResponse } from "next/server";
import pool from '../dbconnection/db';

export async function GET(req: NextRequest) {
  const hn = req.nextUrl.searchParams.get("hn")?.trim() || "";
  const name = req.nextUrl.searchParams.get("name")?.trim() || "";

  try {
    let rows: any[] = [];

    // ✅ CONVERT(... USING utf8mb4) COLLATE utf8mb4_general_ci: คอลัมน์ med_user/new_user
    //    เป็น tis620_thai_ci แต่ connection เป็น utf8mb4 → เปรียบเทียบ/LIKE จะ error 1267
    //    (Illegal mix of collations) บน MariaDB 12.3 — แปลงฝั่ง column ให้ตรงกัน
    const conv = (expr: string) => `CONVERT(${expr} USING utf8mb4) COLLATE utf8mb4_general_ci`;

    // 1. ค้นหาด้วย HN (Partial Match — พิมพ์บางส่วนของ HN ก็เจอ)
    if (hn) {
      // ตรวจสอบ HN: อนุญาตเฉพาะตัวอักษรและตัวเลขเท่านั้นเพื่อความปลอดภัย
      if (!/^[a-zA-Z0-9]+$/.test(hn)) {
        return NextResponse.json({ 
          success: false, 
          message: "รูปแบบ HN ไม่ถูกต้อง (อนุญาตเฉพาะตัวอักษรและตัวเลข)" 
        }, { status: 400 });
      }

      const [r]: any = await pool.query(
        `SELECT hn, CONCAT(pname, fname, ' ', lname) AS name, NULL AS id_card_number, mobile_phone_number AS phone
         FROM med_user
         WHERE ${conv("hn")} LIKE ?
         LIMIT 100`,
        [`%${hn}%`]
      );
      rows = r;
    } 
    
    // 2. ค้นหาด้วยชื่อ (Partial Match)
    else if (name) {
      // ตรวจสอบความยาวขั้นต่ำ: อย่างน้อย 2 ตัวอักษร เพื่อลดภาระการค้นหาที่กว้างเกินไปใน MariaDB
      if (name.length < 2) {
        return NextResponse.json({ 
          success: false, 
          message: "กรุณาระบุชื่ออย่างน้อย 2 ตัวอักษร" 
        }, { status: 400 });
      }

      // ตรวจสอบอักขระที่อนุญาต: ภาษาไทย, อังกฤษ, ตัวเลข, ช่องว่าง, จุด (.), ขีดกลาง (-)
      // เพื่อกรองอักขระพิเศษที่เป็นภาระหรืออาจนำไปสู่ความผิดพลาดของ Query
      const nameRegex = /^[a-zA-Z0-9\u0E00-\u0E7F\s.-]+$/;
      if (!nameRegex.test(name)) {
        return NextResponse.json({ 
          success: false, 
          message: "คำค้นหามีอักขระที่ไม่ได้รับอนุญาต" 
        }, { status: 400 });
      }

      // แยกคำค้นหาและกรองคำว่าง
      const terms = name.split(/\s+/).filter(t => t.length > 0);
      
      // ล้างเครื่องหมาย % และ _ ที่ผู้ใช้อาจใส่เข้ามาเองเพื่อบังคับการค้นหาแบบกว้าง (Wildcard protection)
      const sanitizedTerms = terms.map(t => t.replace(/[%_]/g, ''));

      // ตรวจสอบหลังจากล้างแล้วว่ายังมีคำเหลืออยู่หรือไม่
      if (sanitizedTerms.length === 0) {
        return NextResponse.json({ success: false, message: "คำค้นหาไม่ถูกต้อง" }, { status: 400 });
      }

      // สร้างเงื่อนไข Query (Logic เดิม — ใช้ conv() ที่ประกาศด้านบน)
      const whereClauseMed = sanitizedTerms.map(() => `(${conv("CONCAT(pname, fname, ' ', lname)")} LIKE ? OR ${conv("CONCAT(fname, ' ', lname)")} LIKE ?)` ).join(" AND ");
      const whereClauseNew = sanitizedTerms.map(() => `${conv("name")} LIKE ?`).join(" AND ");

      // ✅ แยกเป็น 2 query แทน UNION ALL — med_user (tis620) กับ new_user (utf8mb4)
      //    มี collation ต่างกัน UNION บน MariaDB จะ throw "Illegal mix of collations"
      //    (error 1267) → ถูก catch แล้วฟ้อง "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล"
      const paramsMed = sanitizedTerms.flatMap(term => [`%${term}%`, `%${term}%`]);
      const paramsNew = sanitizedTerms.map(term => `%${term}%`);

      const [rMed, rNew]: any = await Promise.all([
        pool.query(
          `SELECT hn, CONCAT(pname, fname, ' ', lname) AS name, NULL AS id_card_number, mobile_phone_number AS phone
           FROM med_user
           WHERE ${whereClauseMed}
           LIMIT 100`,
          paramsMed
        ),
        pool.query(
          `SELECT NULL AS hn, name, id_card_number, mobile_phone_number AS phone
           FROM new_user
           WHERE ${whereClauseNew}
           LIMIT 100`,
          paramsNew
        ),
      ]);
      rows = [...rMed[0], ...rNew[0]].slice(0, 100);
    } else {
      return NextResponse.json({ success: false, message: "กรุณาระบุ HN หรือชื่อที่ต้องการค้นหา" });
    }

    const users = rows.map((r: any) => ({
      hn: r.hn || "",
      name: r.name,
      id_card_number: r.id_card_number || "",
      phone: r.phone || "",
    }));

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    // ✅ log รายละเอียด error จริง (code/errno/sqlState/sqlMessage) เพื่อ diagnose บน server
    console.error("Search API Error:", {
      code: error?.code,
      errno: error?.errno,
      sqlState: error?.sqlState,
      message: error?.sqlMessage || error?.message || error,
      sql: error?.sql,
    });
    return NextResponse.json({ success: false, message: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล" }, { status: 500 });
  }
}
