import { NextRequest, NextResponse } from "next/server";
import pool from '../dbconnection/db';

export async function GET(req: NextRequest) {
  const hn = req.nextUrl.searchParams.get("hn")?.trim() || "";
  const name = req.nextUrl.searchParams.get("name")?.trim() || "";

  try {
    let rows: any[] = [];

    // 1. ค้นหาด้วย HN (Exact Match)
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
         WHERE hn = ?
         LIMIT 100`,
        [hn]
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

      // สร้างเงื่อนไข Query (Logic เดิม)
      const whereClauseMed = sanitizedTerms.map(() => `(CONCAT(pname, fname, ' ', lname) LIKE ? OR CONCAT(fname, ' ', lname) LIKE ?)` ).join(" AND ");
      const whereClauseNew = sanitizedTerms.map(() => `name LIKE ?`).join(" AND ");

      const params: string[] = [];
      sanitizedTerms.forEach(term => params.push(`%${term}%`, `%${term}%`)); // สำหรับ med_user
      sanitizedTerms.forEach(term => params.push(`%${term}%`)); // สำหรับ new_user

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
      return NextResponse.json({ success: false, message: "กรุณาระบุ HN หรือชื่อที่ต้องการค้นหา" });
    }

    const users = rows.map((r: any) => ({
      hn: r.hn || "",
      name: r.name,
      id_card_number: r.id_card_number || "",
      phone: r.phone || "",
    }));

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ success: false, message: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล" }, { status: 500 });
  }
}
