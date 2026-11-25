import { NextRequest, NextResponse } from "next/server";
import pool from '../dbconnection/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { hn, pname, fname, lname, name, mobile_phone_number } = body;

    if (!hn || !pname || !fname || !lname || !name || !mobile_phone_number) {
      return NextResponse.json({ success: false, message: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    // 🔎 เช็คว่ามี HN อยู่แล้วหรือไม่
    const [rows]: any = await pool.query("SELECT hn FROM med_user WHERE hn = ?", [hn]);
    if (rows.length > 0) {
      return NextResponse.json({ success: false, message: "มีข้อมูล HN นี้อยู่แล้ว ไม่สามารถเพิ่มได้อีก" }, { status: 409 });
    }

    // ✅ ถ้าไม่ซ้ำ -> insert
    // is_manual=1: เป็นคนไข้ที่เพิ่มเองผ่านระบบ → full sync จะไม่ลบ record นี้
    const baseParams = [hn, pname, fname, lname, name, mobile_phone_number];
    try {
      await pool.query(
        `INSERT INTO med_user (hn, pname, fname, lname, name, mobile_phone_number, last_update, is_manual)
        VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 1)`,
        baseParams
      );
    } catch (e: any) {
      // fallback: ถ้ายังไม่ได้ ALTER TABLE เพิ่ม column is_manual
      if (e?.code !== "ER_BAD_FIELD_ERROR") throw e;
      await pool.query(
        `INSERT INTO med_user (hn, pname, fname, lname, name, mobile_phone_number, last_update)
        VALUES (?, ?, ?, ?, ?, ?, CURDATE())`,
        baseParams
      );
    }

    return NextResponse.json({ success: true, message: "บันทึกสำเร็จ" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
