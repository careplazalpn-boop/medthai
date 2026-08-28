import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

// ✅ ใหม่: แปลงวันที่ (YYYY-MM-DD) เป็นรูปแบบไทย พ.ศ. เช่น "27 สิงหาคม 2569"
// ใช้เฉพาะตอนแสดงผลข้อความแจ้งเตือน ไม่กระทบการเก็บ/query วันที่ในฐานข้อมูล (ยังเป็น ค.ศ. เหมือนเดิมทุกที่)
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
function formatThaiDate(dateInput: string | Date): string {
  let y: number, m: number, d: number;

  if (dateInput instanceof Date) {
    // ✅ แก้บั๊ก: ใช้ getFullYear/getMonth/getDate (เวลาท้องถิ่น) แทน toISOString()
    // เพราะ toISOString() แปลงเป็น UTC ก่อน ทำให้วันที่เลื่อนถอยไป 1 วันในเซิร์ฟเวอร์โซนเวลา UTC+7 (ไทย)
    y = dateInput.getFullYear();
    m = dateInput.getMonth() + 1;
    d = dateInput.getDate();
  } else {
    const parts = String(dateInput).slice(0, 10).split("-").map(Number);
    [y, m, d] = parts;
  }

  if (!y || !m || !d) return String(dateInput);
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

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

    // ดึงข้อมูลการจองหลักพร้อม LEFT JOIN ตาราง special_bed_bookings และ special_beds
    if (isAdmin) {
      query = `
        SELECT 
          b.id, 
          b.therapist, 
          b.time_slot, 
          b.name, 
          b.hn,
          b.status, 
          b.bookedbyrole,
          (CASE WHEN sbb.id IS NOT NULL THEN 1 ELSE 0 END) AS has_special_bed,
          sb.bed_name,
          sb.room_name,
          (CASE WHEN b.hn IS NOT NULL AND b.hn <> '' THEN 1 ELSE 0 END) AS has_confirmed_hn,
          (CASE WHEN b.hn IS NULL OR b.hn = '' THEN 1 ELSE 0 END) AS is_new_user_pending
        FROM bookings b
        INNER JOIN therapist t ON t.id = b.therapist_id
        LEFT JOIN special_bed_bookings sbb ON b.id = sbb.booking_id
        LEFT JOIN special_beds sb ON sbb.bed_id = sb.id
        WHERE b.date = ? AND b.status != 'ยกเลิก' AND t.status = 0 AND b.therapist_id IS NOT NULL

        UNION ALL

        SELECT 
          b.id, 
          b.therapist, 
          b.time_slot, 
          b.name, 
          b.hn,
          b.status, 
          b.bookedbyrole,
          (CASE WHEN sbb.id IS NOT NULL THEN 1 ELSE 0 END) AS has_special_bed,
          sb.bed_name,
          sb.room_name,
          (CASE WHEN b.hn IS NOT NULL AND b.hn <> '' THEN 1 ELSE 0 END) AS has_confirmed_hn,
          (CASE WHEN b.hn IS NULL OR b.hn = '' THEN 1 ELSE 0 END) AS is_new_user_pending
        FROM bookings b
        INNER JOIN therapist t ON (b.therapist = t.name OR b.therapist = t.fname)
        LEFT JOIN special_bed_bookings sbb ON b.id = sbb.booking_id
        LEFT JOIN special_beds sb ON sbb.bed_id = sb.id
        WHERE b.date = ? AND b.status != 'ยกเลิก' AND t.status = 0 AND b.therapist_id IS NULL
      `;
      queryParams.push(date);
    } else {
      query = `
        SELECT 
          b.id, 
          b.therapist, 
          b.time_slot, 
          b.name, 
          b.hn,
          b.status, 
          b.bookedbyrole,
          (CASE WHEN sbb.id IS NOT NULL THEN 1 ELSE 0 END) AS has_special_bed,
          sb.bed_name,
          sb.room_name,
          (CASE WHEN b.hn IS NOT NULL AND b.hn <> '' THEN 1 ELSE 0 END) AS has_confirmed_hn,
          (CASE WHEN b.hn IS NULL OR b.hn = '' THEN 1 ELSE 0 END) AS is_new_user_pending
        FROM bookings b
        INNER JOIN therapist t ON t.id = b.therapist_id
        LEFT JOIN special_bed_bookings sbb ON b.id = sbb.booking_id
        LEFT JOIN special_beds sb ON sbb.bed_id = sb.id
        WHERE b.date = ? AND b.status != 'ยกเลิก' AND t.status = 0 AND t.therapist_type = 0 AND b.therapist_id IS NOT NULL

        UNION ALL

        SELECT 
          b.id, 
          b.therapist, 
          b.time_slot, 
          b.name, 
          b.hn,
          b.status, 
          b.bookedbyrole,
          (CASE WHEN sbb.id IS NOT NULL THEN 1 ELSE 0 END) AS has_special_bed,
          sb.bed_name,
          sb.room_name,
          (CASE WHEN b.hn IS NOT NULL AND b.hn <> '' THEN 1 ELSE 0 END) AS has_confirmed_hn,
          (CASE WHEN b.hn IS NULL OR b.hn = '' THEN 1 ELSE 0 END) AS is_new_user_pending
        FROM bookings b
        INNER JOIN therapist t ON (b.therapist = t.name OR b.therapist = t.fname)
        LEFT JOIN special_bed_bookings sbb ON b.id = sbb.booking_id
        LEFT JOIN special_beds sb ON sbb.bed_id = sb.id
        WHERE b.date = ? AND b.status != 'ยกเลิก' AND t.status = 0 AND t.therapist_type = 0 AND b.therapist_id IS NULL
      `;
      queryParams.push(date);
    }

    const [rows] = await conn.query(query, queryParams);
    conn.release();
    return NextResponse.json({ success: true, bookings: rows });
  } catch (error) {
    console.error("GET bookings error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการดึงข้อมูลการจอง" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const {
      provider,
      hn,
      name,
      phone,
      therapist,
      time,
      date,
      bookedbyrole,
      id_card_number,
      idCard, // เผื่อฝั่งหน้าเว็บส่งมาในชื่อ idCard (camelCase) แทน id_card_number
    } = await request.json();

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
      // ✅ ใหม่: ถ้ามี HN ส่งมา (ผู้รับบริการเดิม) ต้องตรวจสอบว่า HN + ชื่อ ตรงกับข้อมูลจริง
      // ในตาราง med_user เท่านั้น เพื่อป้องกันกรณีผู้ใช้พิมพ์ข้อมูลเองโดยไม่ได้กดค้นหา/เลือก
      // รายชื่อจากระบบ ทำให้ HN หรือชื่อไม่ตรงกับความเป็นจริง — ถ้าไม่พบให้ reject ทันที
      // ก่อนถึงขั้นตอนอื่นใดๆ (TRIM ตัดช่องว่างหัว-ท้ายกันกรณีพิมพ์เว้นวรรคเกินมา)
      //
      // กรณีไม่มี HN (ผู้รับบริการรายใหม่จริง ๆ ที่ยังไม่มีประวัติ) ไม่ถูกเช็คเงื่อนไขนี้
      // ยังคง logic เดิมทั้งหมดด้านล่าง (เช็ค/บันทึกลง new_user เป็นข้อมูลชั่วคราวรอฝ่าย
      // เวชระเบียนทำประวัติที่สมบูรณ์และ sync มาที่ med_user ภายหลัง)
      if (hn) {
        const [medUserRows]: any = await conn.query(
          "SELECT id FROM med_user WHERE TRIM(hn) = TRIM(?) AND TRIM(name) = TRIM(?) LIMIT 1",
          [hn, name]
        );
        if (!medUserRows || medUserRows.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error:
                "ไม่พบข้อมูลผู้รับบริการ (HN และชื่อ) นี้ในระบบ กรุณากดค้นหาและเลือกรายชื่อผู้รับบริการจากระบบก่อนทำการจอง",
            },
            { status: 400 }
          );
        }
      }

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

      // ✅ ใหม่: ตรวจสอบเพิ่มเติมว่า HN นี้จองคิว (กับผู้ให้บริการ/เวลาอื่นใดก็ตาม) ไว้แล้วในวันเดียวกันหรือไม่
      // ยกเว้นคิวที่ถูกยกเลิกแล้ว (status != 'ยกเลิก') — ตรวจสอบเฉพาะกรณีมี hn เท่านั้น
      // (ผู้รับบริการรายใหม่ที่ยังไม่มี HN จะไม่ถูกเช็คเงื่อนไขนี้ ทำงานตาม logic เดิมทุกประการ)
      // หมายเหตุ: เช็คนี้ทำงาน "ต่อจาก" เงื่อนไขเดิมด้านบน จึงไม่กระทบผลลัพธ์/ข้อความ error เดิมของกรณีที่ตรวจจับได้อยู่แล้ว
      if (hn) {
        const [dupHnRows]: any = await conn.query(
          `
          SELECT b.id, b.date, b.time_slot, b.therapist, b.therapist_id, t.name AS therapist_name
          FROM bookings b
          LEFT JOIN therapist t ON t.id = b.therapist_id
          WHERE b.hn = ? AND b.date = ? AND b.status != 'ยกเลิก'
          LIMIT 1
          `,
          [hn, date]
        );

        if (dupHnRows && dupHnRows.length > 0) {
          const dupBooking = dupHnRows[0];
          // ใช้ชื่อจากตาราง therapist ผ่าน therapist_id ก่อน ถ้าไม่มีค่อย fallback เป็นชื่อข้อความเดิมที่เก็บไว้ใน bookings.therapist
          const therapistDisplayName = dupBooking.therapist_name || dupBooking.therapist || "ไม่ระบุ";
          // ✅ ใหม่: แปลงวันที่จาก bookings.date เป็นรูปแบบไทย พ.ศ. สำหรับแสดงในข้อความแจ้งเตือน
          const thaiDate = formatThaiDate(dupBooking.date);
          return NextResponse.json(
            {
              success: false,
              error: `HN นี้ได้ทำการจองคิวกับ ${therapistDisplayName} ไว้แล้วในวันที่ ${thaiDate} ช่วงเวลา ${dupBooking.time_slot} กรุณายกเลิกคิวเดิมก่อน หากต้องการจองคิวใหม่`,
            },
            { status: 400 }
          );
        }
      }

      // ✅ ใหม่: หา therapist_id จากชื่อที่เลือก (best-effort) เพื่อบันทึกไว้ควบคู่กับชื่อเดิม
      // ไม่กระทบการทำงานเดิมแม้หาไม่เจอ (จะบันทึกเป็น NULL แล้ว query เก่ายังใช้ชื่อ fallback ได้ตามปกติ)
      let therapistId: number | null = null;
      try {
        const [therapistRows]: any = await conn.query(
          "SELECT id FROM therapist WHERE (name = ? OR fname = ?) AND status = 0 LIMIT 1",
          [therapist, therapist]
        );
        therapistId = therapistRows?.[0]?.id ?? null;
      } catch (lookupError) {
        console.error("หา therapist_id ไม่สำเร็จ (ไม่กระทบการจอง):", lookupError);
      }

      await conn.query(
        "INSERT INTO bookings (hn, name, phone, date, therapist, therapist_id, time_slot, provider, bookedbyrole, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'รอดำเนินการ')",
        [hn || null, name, phone, date, therapist, therapistId, time, provider, bookedbyrole || 'user']
      );

      // 📌 ผู้มารับบริการรายใหม่ที่ยังไม่มี HN (ไม่ได้ดึงจากตารางหลัก)
      // บันทึกข้อมูลเบื้องต้นไว้ในตาราง new_user เพื่อรอเจ้าหน้าที่บันทึก HN ให้สมบูรณ์ภายหลัง
      // เป็นการทำงานแบบ best-effort: ถ้าขั้นตอนนี้ล้มเหลว จะไม่กระทบการจองที่บันทึกไปแล้วด้านบน
      if (!hn) {
        try {
          const idCardValue = id_card_number || idCard || null;

          const [dup]: any = await conn.query(
            "SELECT id FROM new_user WHERE name = ? AND mobile_phone_number = ? LIMIT 1",
            [name, phone]
          );

          if (!dup || dup.length === 0) {
            await conn.query(
              "INSERT INTO new_user (name, id_card_number, mobile_phone_number, created_at) VALUES (?, ?, ?, NOW())",
              [name, idCardValue, phone]
            );
          }
        } catch (newUserError) {
          console.error("บันทึกข้อมูล new_user (รอ HN) ล้มเหลว:", newUserError);
          // ไม่ throw ต่อ เพื่อไม่ให้กระทบผลลัพธ์การจองที่สำเร็จไปแล้ว
        }
      }
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