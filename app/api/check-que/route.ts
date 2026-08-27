import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

/**
 * GET /api/check-que?keyword=ชื่อ/HN/เบอร์โทร
 *   -> โหมดค้นหา: ค้นหาใน med_user จากชื่อ-สกุล, HN, หรือเบอร์โทร (mobile_phone_number)
 *      รองรับพิมพ์บางส่วนของชื่อ+นามสกุลแยกกันด้วยช่องว่างได้ (เช่น "นิรัน บุญ")
 *      คืนรายชื่อผู้รับบริการที่พบ (สูงสุด 30 คน) ให้ฝั่งหน้าเว็บแสดงให้เลือก
 *
 * GET /api/check-que?hn=xxxxxxxxx&page=1&limit=20
 *   -> โหมดแสดงรายละเอียด: คืนข้อมูลผู้รับบริการ (จาก med_user)
 *      พร้อมประวัติการนัดหมาย/รับบริการ (จาก bookings) แบ่งหน้า เรียงล่าสุดไปเก่าสุด
 *      (อนาคต -> ปัจจุบัน -> อดีต) — limit รองรับค่า 10/20/30/50/100 เท่านั้น (ค่า default 20)
 *
 * อ้างอิงสคีมาจริง:
 *   - med_user: id, hn, name, pname, fname, lname, deathday, hometel, informname,
 *     worktel, last_update, death, mobile_phone_number
 *   - bookings: id, provider, hn, name, phone, therapist, time_slot, date,
 *     created_at, status, bookedbyrole, payment_status, therapist_id
 *   - bookings.hn คือคีย์ที่ใช้เชื่อมกับ med_user.hn (ผูกประวัติการรับบริการ)
 *   - bookings.therapist_id (ถ้ามี) join กับ therapist.id / therapist.name
 *     เพื่อเอาชื่อผู้ให้บริการล่าสุด — ถ้าไม่มี (ข้อมูลเก่า) fallback ไปใช้
 *     bookings.therapist (ชื่อข้อความที่บันทึกไว้ตอนจองจริง)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const keyword = (searchParams.get("keyword") || "").trim();
    const hn = (searchParams.get("hn") || "").trim();

    const conn = await pool.getConnection();
    try {
      // -------------------- โหมดค้นหา (ยังไม่ระบุ HN ชัดเจน) --------------------
      if (!hn) {
        if (!keyword) {
          return NextResponse.json(
            { success: false, error: "กรุณาระบุคำค้นหา (ชื่อ-สกุล หรือ HN)" },
            { status: 400 }
          );
        }

        // ✅ ใหม่: แยกคำค้นหาด้วยช่องว่าง แล้วให้แต่ละคำต้อง "เจอที่ไหนก็ได้" ในชื่อ/นามสกุล/HN
        // (AND ระหว่างคำที่พิมพ์มา, OR ระหว่างฟิลด์ที่เจอ) เพื่อรองรับการค้นแบบพิมพ์บางส่วนของ
        // ชื่อและนามสกุลพร้อมกัน เช่น "นิรัน บุญ" ก็ยังหา "นิรันดร บุญชู" เจอ
        const words = keyword.split(/\s+/).filter(Boolean);
        const conditions: string[] = [];
        const params: string[] = [];
        for (const w of words) {
          const like = `%${w}%`;
          conditions.push(`
            (
              hn LIKE ?
              OR name LIKE ?
              OR fname LIKE ?
              OR lname LIKE ?
              OR mobile_phone_number LIKE ?
              OR CONCAT(IFNULL(fname,''), ' ', IFNULL(lname,'')) LIKE ?
              OR CONCAT(IFNULL(pname,''), IFNULL(fname,''), ' ', IFNULL(lname,'')) LIKE ?
            )
          `);
          params.push(like, like, like, like, like, like, like);
        }

        const [rows]: any = await conn.query(
          `
          SELECT
            id, hn, name, pname, fname, lname, mobile_phone_number, hometel
          FROM med_user
          WHERE ${conditions.join(" AND ")}
          ORDER BY name ASC
          LIMIT 30
          `,
          params
        );

        const results = rows.map((r: any) => ({
          id: r.id,
          hn: r.hn,
          name: (r.name && String(r.name).trim()) || `${r.pname || ""}${r.fname || ""} ${r.lname || ""}`.trim(),
          phone: r.mobile_phone_number || r.hometel || "",
        }));

        return NextResponse.json({ success: true, mode: "search", results });
      }

      // ✅ ใหม่: รองรับแบ่งหน้าประวัติการนัดหมาย/รับบริการ — จำกัดค่า limit ให้อยู่ในชุดที่กำหนดเท่านั้น
      const allowedLimits = [10, 20, 30, 50, 100];
      const pageRaw = parseInt(searchParams.get("page") || "1", 10);
      const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
      const limitRaw = parseInt(searchParams.get("limit") || "20", 10);
      const limit = allowedLimits.includes(limitRaw) ? limitRaw : 20;
      const offset = (page - 1) * limit;

      // -------------------- โหมดแสดงรายละเอียด + ประวัติ (ระบุ HN แล้ว) --------------------
      const [userRows]: any = await conn.query(
        `
        SELECT id, hn, name, pname, fname, lname, hometel, mobile_phone_number, death, deathday
        FROM med_user
        WHERE hn = ?
        LIMIT 1
        `,
        [hn]
      );

      if (!userRows || userRows.length === 0) {
        return NextResponse.json(
          { success: false, error: "ไม่พบข้อมูลผู้รับบริการ (HN นี้)" },
          { status: 404 }
        );
      }

      const u = userRows[0];
      const patient = {
        id: u.id,
        hn: u.hn,
        name: (u.name && String(u.name).trim()) || `${u.pname || ""}${u.fname || ""} ${u.lname || ""}`.trim(),
        phone: u.mobile_phone_number || u.hometel || "",
        isDeceased: String(u.death) === "1",
      };

      // นับจำนวนประวัติทั้งหมดของ HN นี้ (สำหรับคำนวณจำนวนหน้า)
      const [countRows]: any = await conn.query(
        `SELECT COUNT(*) AS total FROM bookings WHERE hn = ?`,
        [hn]
      );
      const total = Number(countRows?.[0]?.total) || 0;
      const totalPages = Math.max(1, Math.ceil(total / limit));

      // ใช้ DATE_FORMAT แทน DATE() เพื่อให้ MySQL คืนค่าเป็น string ตรงๆ
      // (กัน timezone bug แบบเดียวกับที่แก้ไว้ใน api/summary-therapists และ api/bookings)
      // เรียง "ล่าสุดไปเก่าสุด" (อนาคต -> ปัจจุบัน -> อดีต) ด้วย date DESC + เวลา DESC แล้วค่อยตัดหน้าด้วย LIMIT/OFFSET
      // ✅ ใหม่: LEFT JOIN special_bed_bookings / special_beds เพื่อดึงข้อมูลเตียงพิเศษมาแสดงคู่กับประวัติ
      // (เป็น LEFT JOIN เพราะ booking : special_bed_booking = 1 : 1 อยู่แล้ว จึงไม่ทำให้จำนวนแถวประวัติเปลี่ยนไป)
      const [historyRows]: any = await conn.query(
        `
        SELECT
          b.id,
          DATE_FORMAT(b.date, '%Y-%m-%d') AS date,
          b.time_slot,
          b.therapist,
          b.therapist_id,
          t.name AS therapist_name,
          b.status,
          b.payment_status,
          b.provider,
          (sbb.id IS NOT NULL) AS has_special_bed,
          sb.bed_code,
          sb.bed_name,
          sb.room_name
        FROM bookings b
        LEFT JOIN therapist t ON t.id = b.therapist_id
        LEFT JOIN special_bed_bookings sbb ON sbb.booking_id = b.id
        LEFT JOIN special_beds sb ON sb.id = sbb.bed_id
        WHERE b.hn = ?
        ORDER BY b.date DESC, STR_TO_DATE(SUBSTRING_INDEX(b.time_slot, '-', 1), '%H:%i') DESC
        LIMIT ? OFFSET ?
        `,
        [hn, limit, offset]
      );

      const history = historyRows.map((r: any) => ({
        id: r.id,
        date: r.date,
        time_slot: r.time_slot,
        therapist: r.therapist_name || r.therapist || "ไม่ระบุ",
        status: r.status || "รอดำเนินการ",
        payment_status: r.payment_status || "unpaid",
        provider: r.provider,
        // ✅ ใหม่: ข้อมูลเตียงพิเศษ (ถ้ามีการจอง)
        hasSpecialBed: !!r.has_special_bed,
        bedCode: r.bed_code || null,
        bedName: r.bed_name || null,
        roomName: r.room_name || null,
      }));

      return NextResponse.json({
        success: true,
        mode: "detail",
        patient,
        history,
        pagination: { page, limit, total, totalPages },
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("check-que GET error:", err);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการค้นหาข้อมูล" },
      { status: 500 }
    );
  }
}