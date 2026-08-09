import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

// 📌 GET: ดึงข้อมูลเตียงพิเศษทั้งหมด
export async function GET() {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT id, bed_code, bed_name, room_name, status FROM special_beds ORDER BY id ASC"
    );
    conn.release();

    return NextResponse.json({
      success: true,
      beds: rows,
    });
  } catch (error: any) {
    console.error("GET /api/beds-special error:", error);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถดึงข้อมูลเตียงพิเศษได้" },
      { status: 500 }
    );
  }
}

// 📌 POST: เพิ่มข้อมูลเตียงพิเศษใหม่
export async function POST(request: Request) {
  try {
    const { bed_code, bed_name, room_name, status } = await request.json();

    if (!bed_code || !bed_name) {
      return NextResponse.json(
        { success: false, error: "กรุณากรอกรหัสเตียงและชื่อเตียง" },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();
    const [result]: any = await conn.query(
      "INSERT INTO special_beds (bed_code, bed_name, room_name, status) VALUES (?, ?, ?, ?)",
      [bed_code, bed_name, room_name || null, status ?? 0]
    );
    conn.release();

    return NextResponse.json({
      success: true,
      message: "เพิ่มข้อมูลเตียงพิเศษเรียบร้อยแล้ว",
      insertId: result.insertId,
    });
  } catch (error: any) {
    console.error("POST /api/beds-special error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการเพิ่มเตียงพิเศษ" },
      { status: 500 }
    );
  }
}

// 📌 PUT: แก้ไขข้อมูลเตียงพิเศษ หรือเปลี่ยนสถานะเปิด/ปิดใช้งาน
export async function PUT(request: Request) {
  try {
    const { id, bed_code, bed_name, room_name, status } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุ ID ของเตียงที่ต้องการแก้ไข" },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();
    await conn.query(
      "UPDATE special_beds SET bed_code = ?, bed_name = ?, room_name = ?, status = ? WHERE id = ?",
      [bed_code, bed_name, room_name || null, status ?? 0, id]
    );
    conn.release();

    return NextResponse.json({
      success: true,
      message: "อัปเดตข้อมูลเตียงพิเศษเรียบร้อยแล้ว",
    });
  } catch (error: any) {
    console.error("PUT /api/beds-special error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการแก้ไขข้อมูลเตียงพิเศษ" },
      { status: 500 }
    );
  }
}

// 📌 DELETE: ลบข้อมูลเตียงพิเศษ
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุ ID ของเตียงที่ต้องการลบ" },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();
    await conn.query("DELETE FROM special_beds WHERE id = ?", [id]);
    conn.release();

    return NextResponse.json({
      success: true,
      message: "ลบข้อมูลเตียงพิเศษเรียบร้อยแล้ว",
    });
  } catch (error: any) {
    console.error("DELETE /api/beds-special error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการลบเตียงพิเศษ" },
      { status: 500 }
    );
  }
}