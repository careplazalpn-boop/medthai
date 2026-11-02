import { NextResponse } from "next/server";
import pool from "../dbconnection/db"; // ⚠️ ตรวจสอบพาธนำเข้าฐานข้อมูลของคุณว่าตรงหรือไม่

// GET: ดึงข้อมูลการจองเตียง (พร้อม Pagination) และคิวที่รอลงเตียง
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const roleId = Number(url.searchParams.get("role_id")) || 0;
    const isAdmin = url.searchParams.get("is_admin") === "true";
    const userName = url.searchParams.get("user_name") || ""; 

    // 🌟 รับค่า Pagination
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const offset = (page - 1) * limit;

    if (!date) {
      return NextResponse.json({ success: false, error: "Missing date" }, { status: 400 });
    }

    // ==============================================================
    // 1. ดึงคิวที่ลงเตียงไปแล้ว (bedBookings) แบบมี Pagination 
    // ==============================================================
    const [bedBookingRows]: any = await pool.execute(
      `SELECT 
         sbb.id AS special_booking_id, sbb.bed_id, sbb.booking_id, sbb.date, sbb.time_slot, sbb.note, sbb.created_by, sbb.status,
         sb.bed_code, sb.bed_name, sb.room_name, sb.bed_type,
         b.hn, b.name AS patient_name, b.phone AS patient_phone, b.therapist, b.provider, b.status AS booking_status,
         u.sex
       FROM special_bed_bookings sbb
       INNER JOIN bookings b ON sbb.booking_id = b.id
       INNER JOIN special_beds sb ON sbb.bed_id = sb.id
       LEFT JOIN med_user u ON b.hn = u.hn
       WHERE sbb.date = ?
       ORDER BY sb.bed_name ASC
       LIMIT ? OFFSET ?`,
      [date, limit, offset]
    );

    // 1.1 นับจำนวนรายการเตียงทั้งหมดในวันนี้เพื่อทำ Pagination 
    const [countRows]: any = await pool.execute(
      `SELECT COUNT(*) AS total 
       FROM special_bed_bookings sbb
       WHERE sbb.date = ?`,
      [date]
    );
    
    const totalRecords = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    // ==============================================================
    // 2. ดึงคิวที่รอลงเตียง (availableBookings) ไม่ต้องทำ Pagination
    // ==============================================================
    let availableQuery = `
      SELECT 
         b.id AS booking_id, b.hn, b.name, b.phone, b.therapist, b.provider, b.time_slot, b.date, b.status,
         u.sex
       FROM bookings b
       LEFT JOIN special_bed_bookings sbb ON b.id = sbb.booking_id
       LEFT JOIN med_user u ON b.hn = u.hn
       WHERE b.date = ? 
         AND b.status != 'ยกเลิก' 
         AND sbb.id IS NULL
    `;
    const availableParams: any[] = [date];

    // ✅ ถ้าไม่ใช่ Admin ให้กรองเฉพาะคิวที่ตัวเองดูแล (เป็น Therapist หรือ Provider)
    if (!isAdmin && roleId !== 909) {
      let ownNames: string[] = [userName]; 
      try {
        const [tRows]: any = await pool.execute(
          "SELECT name, fname FROM therapist WHERE id = ?",
          [roleId]
        );
        if (tRows.length > 0) {
          ownNames.push(tRows[0].name, tRows[0].fname);
        }
      } catch (e) {
        console.error("Error finding therapist name:", e);
      }

      ownNames = [...new Set(ownNames)].filter(Boolean); // ตัดชื่อว่างและซ้ำ

      if (ownNames.length > 0) {
        const placeholders = ownNames.map(() => "?").join(",");
        availableQuery += ` AND (b.therapist IN (${placeholders}) OR b.provider IN (${placeholders}))`;
        availableParams.push(...ownNames, ...ownNames);
      } else {
        availableQuery += ` AND b.therapist_id = ?`;
        availableParams.push(roleId);
      }
    }

    const [availableRows]: any = await pool.execute(availableQuery, availableParams);

    // 3. ส่งข้อมูลทั้งหมดกลับไปพร้อมข้อมูลหน้า Pagination
    return NextResponse.json({
      success: true,
      bedBookings: bedBookingRows,
      availableBookings: availableRows,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages
      }
    });

  } catch (error) {
    console.error("Error API beds-special-bookings:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}


// ==============================================================
// POST: บันทึกการจองเตียง
// ==============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bed_id, booking_id, date, time_slot, created_by, note, status } = body;
    
    // ใช้ ON DUPLICATE KEY UPDATE ป้องกันการ Error ทะลุ (Double Validation) 
    await pool.execute(
      `INSERT INTO special_bed_bookings (bed_id, booking_id, date, time_slot, created_by, note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         booking_id = VALUES(booking_id),
         created_by = VALUES(created_by),
         note = VALUES(note),
         status = VALUES(status)`,
      [bed_id, booking_id, date, time_slot, created_by || "staff", note || null, status ?? 0]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST special_bed_bookings error:", error);
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาดในการบันทึกการจองเตียง" }, { status: 500 });
  }
}

// ==============================================================
// DELETE: ยกเลิกการจองเตียง
// ==============================================================
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });

    await pool.execute("DELETE FROM special_bed_bookings WHERE id = ?", [id]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE special_bed_bookings error:", error);
    return NextResponse.json({ success: false, error: "ลบข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}

// ==============================================================
// PUT: อัปเดตสถานะบริการสำเร็จ (status = 1) (หากมีการเรียกใช้)
// ==============================================================
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || status === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    await pool.execute(
      `UPDATE special_bed_bookings SET status = ? WHERE id = ?`,
      [status, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT special_bed_bookings error:", error);
    return NextResponse.json({ success: false, error: "อัปเดตข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}