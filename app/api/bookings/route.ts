import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date)
    return NextResponse.json(
      { success: false, error: "กรุณาระบุวันที่" },
      { status: 400 }
    );

  try {
    const conn = await pool.getConnection();

    // ดึงค่า role/userId เพื่อตรวจสอบสิทธิ์
    const roleParam = url.searchParams.get("role") || url.searchParams.get("role_id") || "";
    const userIdParam = url.searchParams.get("userId") || url.searchParams.get("user_id") || "";
    
    let isAdmin = false;
    const normalizedRole = String(roleParam).toLowerCase().trim();
    
    if (normalizedRole === "909" || normalizedRole === "admin") {
      isAdmin = true;
    } else if (userIdParam) {
      const [userRows]: any = await conn.query("SELECT role, role_id FROM users WHERE id = ?", [userIdParam]);
      if (userRows && userRows.length > 0) {
        const rId = String(userRows[0].role_id);
        const rName = String(userRows[0].role || "").toLowerCase();
        if (rId === "909" || rId === "admin" || rName === "909" || rName === "admin") isAdmin = true;
      }
    }

    let query = "";
    const queryParams = [date];

    if (isAdmin) {
      // Admin: แสดงทั้งหมดตาม status ของ therapist
      query = `
        SELECT b.therapist, b.time_slot, b.name, b.status, b.bookedbyrole 
        FROM bookings b
        INNER JOIN therapist t ON (b.therapist = t.name OR b.therapist = t.fname)
        WHERE b.date = ? AND b.status != 'ยกเลิก' AND t.status = 0
      `;
    } else {
      // Guest / User ทั่วไป: กรองเฉพาะ therapist_type = 0 และ status = 0
      query = `
        SELECT b.therapist, b.time_slot, b.name, b.status, b.bookedbyrole 
        FROM bookings b
        INNER JOIN therapist t ON (b.therapist = t.name OR b.therapist = t.fname)
        WHERE b.date = ? AND b.status != 'ยกเลิก' AND t.status = 0 AND t.therapist_type = 0
      `;
    }

    const [rows] = await conn.query(query, queryParams);
    conn.release();
    return NextResponse.json({ success: true, bookings: rows });
  } catch (error) {
    console.error("GET bookings error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { provider, hn, name, phone, therapist, time, date, bookedbyrole } =
      await request.json();

    const missingFields = [];
    if (!provider) missingFields.push("provider");
    if (!name) missingFields.push("name");
    if (!phone) missingFields.push("phone");
    if (!therapist) missingFields.push("therapist");
    if (!time) missingFields.push("time");
    if (!date) missingFields.push("date");

    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `ข้อมูลไม่ครบถ้วน: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();
    try {
      const [existing] = await conn.query(
        "SELECT * FROM bookings WHERE hn = ? AND therapist = ? AND time_slot = ? AND date = ? AND status != 'ยกเลิก'",
        [hn || null, therapist, time, date]
      );

      if ((existing as any).length > 0) {
        return NextResponse.json(
          { success: false, error: "คุณได้ทำการจองในช่วงเวลานี้แล้ว" },
          { status: 400 }
        );
      }

      await conn.query(
        "INSERT INTO bookings (hn, name, phone, date, therapist, time_slot, provider, bookedbyrole, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'รอดำเนินการ')",
        [hn || null, name, phone, date, therapist, time, provider, bookedbyrole || 'user']
      );
    } finally {
      conn.release();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดจากระบบ" },
      { status: 500 }
    );
  }
}