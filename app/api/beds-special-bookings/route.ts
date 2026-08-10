import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

// 📌 GET: ดึงข้อมูลการจองเตียงพิเศษ และคิวนวดหลักที่พร้อมลงเตียงตามสิทธิ์ผู้ใช้งาน
export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const roleId = url.searchParams.get("role_id") || "";
  const isAdminParam = url.searchParams.get("is_admin") === "true" || roleId === "909";

  if (!date) {
    return NextResponse.json(
      { success: false, error: "กรุณาระบุวันที่" },
      { status: 400 }
    );
  }

  try {
    const conn = await pool.getConnection();

    try {
      // 1. ตรวจสอบชื่อหมอนวด/ผู้ให้บริการที่ผูกกับ role_id
      let loggedInTherapistName = "";
      if (!isAdminParam && roleId) {
        const [therapistRows]: any = await conn.query(
          "SELECT name FROM therapist WHERE id = ? AND status = 0",
          [roleId]
        );
        if (therapistRows.length > 0) {
          loggedInTherapistName = therapistRows[0].name;
        }
      }

      // 2. ดึงรายการเตียงพิเศษที่มีการจองในวันที่ระบุ (ดึง sbb.status ซึ่งเป็น INT(1) มาด้วย)
      const [bedBookings] = await conn.query(
        `SELECT 
          sbb.id AS special_booking_id,
          sbb.bed_id,
          sbb.booking_id,
          sbb.date,
          sbb.time_slot,
          sbb.note,
          sbb.created_by,
          sbb.status,
          sb.bed_code,
          sb.bed_name,
          sb.room_name,
          b.hn,
          b.name AS patient_name,
          b.phone AS patient_phone,
          b.therapist,
          b.provider,
          b.status AS booking_status
         FROM special_bed_bookings sbb
         INNER JOIN special_beds sb ON sbb.bed_id = sb.id
         INNER JOIN bookings b ON sbb.booking_id = b.id
         WHERE sbb.date = ? AND b.status != 'ยกเลิก'
         ORDER BY sb.id ASC, sbb.time_slot ASC`,
        [date]
      );

      // 3. ดึงรายการคิวนวดหลัก (bookings) ที่ยังไม่ได้ลงเตียงพิเศษ
      let availableQuery = `
        SELECT 
          b.id AS booking_id,
          b.hn,
          b.name,
          b.phone,
          b.therapist,
          b.provider,
          b.time_slot,
          b.date,
          b.status
         FROM bookings b
         LEFT JOIN special_bed_bookings sbb ON b.id = sbb.booking_id
         WHERE b.date = ? 
           AND b.status != 'ยกเลิก' 
           AND sbb.id IS NULL
      `;

      const availableParams: any[] = [date];

      if (!isAdminParam && loggedInTherapistName) {
        availableQuery += ` AND (b.therapist = ? OR b.provider = ?)`;
        availableParams.push(loggedInTherapistName, loggedInTherapistName);
      }

      availableQuery += ` ORDER BY b.time_slot ASC, b.id ASC`;

      const [availableBookings] = await conn.query(availableQuery, availableParams);

      return NextResponse.json({
        success: true,
        bedBookings: bedBookings,
        availableBookings: availableBookings,
        therapistName: loggedInTherapistName,
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error("GET /api/beds-special-bookings error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการดึงข้อมูลการจองเตียงพิเศษ" },
      { status: 500 }
    );
  }
}

// 📌 POST: บันทึกการจองเตียงพิเศษลงฐานข้อมูล (บันทึก status = 0)
export async function POST(request: Request) {
  try {
    const { bed_id, booking_id, date, time_slot, created_by, note, status } = await request.json();

    if (!bed_id || !booking_id || !date || !time_slot) {
      return NextResponse.json(
        { success: false, error: "ข้อมูลสำหรับการจองเตียงพิเศษไม่ครบถ้วน" },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();

    try {
      // 1. ตรวจสอบว่าเตียงนี้ในช่วงเวลานี้ถูกจองไปแล้วหรือไม่
      const [existingBed]: any = await conn.query(
        `SELECT sbb.id 
         FROM special_bed_bookings sbb
         INNER JOIN bookings b ON sbb.booking_id = b.id
         WHERE sbb.bed_id = ? AND sbb.date = ? AND REPLACE(sbb.time_slot, ' ', '') = REPLACE(?, ' ', '') AND b.status != 'ยกเลิก'`,
        [bed_id, date, time_slot]
      );

      if (existingBed.length > 0) {
        return NextResponse.json(
          { success: false, error: "เตียงพิเศษนี้ถูกจองในช่วงเวลาดังกล่าวไปแล้ว" },
          { status: 400 }
        );
      }

      // 2. ตรวจสอบว่าคิวจองนวดนี้ลงเตียงซ้ำหรือไม่
      const [existingBooking]: any = await conn.query(
        "SELECT id FROM special_bed_bookings WHERE booking_id = ?",
        [booking_id]
      );

      if (existingBooking.length > 0) {
        return NextResponse.json(
          { success: false, error: "คิวนวดนี้ถูกจองเตียงพิเศษไปเรียบร้อยแล้ว" },
          { status: 400 }
        );
      }

      // 3. บันทึกการจองเตียงพิเศษลงตาราง (กำหนด status = 0 สำหรับการจองใหม่)
      await conn.query(
        `INSERT INTO special_bed_bookings (bed_id, booking_id, date, time_slot, created_by, note, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [bed_id, booking_id, date, time_slot, created_by || "staff", note || null, status ?? 0]
      );

      return NextResponse.json({
        success: true,
        message: "บันทึกการจองเตียงพิเศษสำเร็จ",
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error("POST /api/beds-special-bookings error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการบันทึกการจองเตียงพิเศษ" },
      { status: 500 }
    );
  }
}

// 📌 PUT: อัปเดตสถานะการจองเตียงพิเศษ (เช่น ปรับเป็น status = 1 เมื่อบริการสำเร็จ)
export async function PUT(request: Request) {
  try {
    const { id, status } = await request.json();

    if (!id || status === undefined) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุ ID และสถานะที่ต้องการอัปเดต" },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();

    try {
      await conn.query(
        "UPDATE special_bed_bookings SET status = ? WHERE id = ?",
        [status, id]
      );

      return NextResponse.json({
        success: true,
        message: "อัปเดตสถานะการจองเตียงพิเศษสำเร็จ",
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error("PUT /api/beds-special-bookings error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการอัปเดตสถานะการจองเตียงพิเศษ" },
      { status: 500 }
    );
  }
}

// 📌 DELETE: ยกเลิกการจองเตียงพิเศษ
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุ ID รายการจองเตียงพิเศษที่ต้องการยกเลิก" },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();

    try {
      await conn.query("DELETE FROM special_bed_bookings WHERE id = ?", [id]);
      return NextResponse.json({
        success: true,
        message: "ยกเลิกการจองเตียงพิเศษเรียบร้อยแล้ว",
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error("DELETE /api/beds-special-bookings error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการยกเลิกการจองเตียงพิเศษ" },
      { status: 500 }
    );
  }
}