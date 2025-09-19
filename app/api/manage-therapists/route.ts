import { NextResponse } from "next/server";
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

// 📌 GET: ดึงทั้ง therapist + med_staff
export async function GET() {
  try {
    const [therapists] = await pool.query(
      `SELECT id, name, pname, fname, lname FROM therapist`
    );
    const [medStaff] = await pool.query(
      `SELECT id, name, pname, fname, lname FROM med_staff`
    );

    return NextResponse.json({
      therapists,
      medStaff,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


// 📌 POST
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table") || "therapist";

    const { name, pname, fname, lname } = await req.json();

    const [result]: any = await pool.query(
      `INSERT INTO ${table} (name, pname, fname, lname) VALUES (?, ?, ?, ?)`,
      [name, pname, fname, lname]
    );

    return NextResponse.json({ message: "เพิ่มสำเร็จ", id: result.insertId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 📌 PUT
export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get("table") || "therapist";

    const { id, name, pname, fname, lname } = await req.json();

    await pool.query(
      `UPDATE ${table} SET name=?, pname=?, fname=?, lname=? WHERE id=?`,
      [name, pname, fname, lname, id]
    );

    return NextResponse.json({ message: "แก้ไขข้อมูลสำเร็จ" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 📌 DELETE
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
