import { NextResponse } from "next/server";
import pool from '../dbconnection/db';

// 📌 GET: ดึงข้อมูล (รวมฟิลด์ใหม่)
export async function GET() {
  try {
    const [therapists] = await pool.query(
      `SELECT id, name, pname, fname, lname, therapist_type, status FROM therapist`
    );
    const [medStaff] = await pool.query(
      `SELECT id, name, pname, fname, lname, role_id FROM med_staff`
    );

    return NextResponse.json({
      therapists,
      medStaff,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 📌 POST: เพิ่มข้อมูล (เพิ่ม therapist_type และ status)
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table") || "therapist";

    const data = await req.json();

    if (table === "therapist") {
      // สำหรับตาราง therapist ต้องใส่ฟิลด์ใหม่ด้วย
      const { name, pname, fname, lname, therapist_type, status } = data;
      await pool.query(
        `INSERT INTO therapist (name, pname, fname, lname, therapist_type, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, pname, fname, lname, therapist_type || 0, status || 0]
      );
    } else {
      // สำหรับ med_staff (คงเดิม)
      const { name, pname, fname, lname } = data;
      await pool.query(
        `INSERT INTO med_staff (name, pname, fname, lname) VALUES (?, ?, ?, ?)`,
        [name, pname, fname, lname]
      );
    }

    return NextResponse.json({ message: "เพิ่มสำเร็จ" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 📌 PUT: แก้ไขข้อมูล
export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table") || "therapist";
    const data = await req.json();

    if (table === "therapist") {
      const { id, name, pname, fname, lname, therapist_type, status } = data;
      await pool.query(
        `UPDATE therapist SET name=?, pname=?, fname=?, lname=?, therapist_type=?, status=? WHERE id=?`,
        [name, pname, fname, lname, therapist_type, status, id]
      );
    } else {
      const { id, name, pname, fname, lname } = data;
      await pool.query(
        `UPDATE med_staff SET name=?, pname=?, fname=?, lname=? WHERE id=?`,
        [name, pname, fname, lname, id]
      );
    }

    return NextResponse.json({ message: "แก้ไขข้อมูลสำเร็จ" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 📌 DELETE (คงเดิม)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table") || "therapist";
    const { id } = await req.json();

    await pool.query(`DELETE FROM ${table} WHERE id=?`, [id]);

    return NextResponse.json({ message: "ลบสำเร็จ" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}