import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

/**
 * GET /api/summary-therapists?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * สรุปยอดการให้บริการที่ "สำเร็จ" ของผู้ให้บริการแต่ละคน แยกเป็นรายวัน
 * ภายในช่วงวันที่ที่กำหนด
 *
 * อ้างอิงสคีมาจริงจาก api/summary-history/route.ts:
 *   - ตาราง bookings มีคอลัมน์: id, provider, name, phone, therapist, time_slot,
 *     status, date, payment_status, created_at
 *   - b.therapist เก็บเป็น "ชื่อผู้ให้บริการ" แบบข้อความโดยตรง ไม่ได้ join กับตาราง therapist ด้วย id
 *   - ค่า status ที่ถือว่า "สำเร็จ" คือ string 'สำเร็จ'
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "กรุณาระบุช่วงวันที่ (start, end)" },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();
    try {
      // อัปเดตสถานะ booking ที่เลยเวลาแล้วให้เป็น "สำเร็จ" ก่อน
      // (ใช้ logic เดียวกับ api/summary-history เพื่อให้ยอดสรุปตรงกับความเป็นจริง)
      await conn.query(`
        UPDATE bookings
        SET status = 'สำเร็จ'
        WHERE status IN ('อยู่ในคิว', 'รอดำเนินการ')
        AND CONCAT(date, ' ', TRIM(SUBSTRING_INDEX(time_slot, '-', -1))) <= NOW()
      `);

      // ดึงยอดงานที่ "สำเร็จ" ของผู้ให้บริการแต่ละคน แยกตามวัน
      // ใช้ DATE_FORMAT แทน DATE() เพื่อให้ MySQL คืนค่าเป็น string ตรงๆ
      // (ถ้าใช้ DATE() แล้วให้ JS แปลงด้วย toISOString() จะโดน timezone UTC
      //  ทำให้วันที่เลื่อนถอยหลัง 1 วันสำหรับโซนเวลาไทย UTC+7)
      const [rows]: any = await conn.query(
        `
        SELECT
          b.therapist                        AS therapist_name,
          DATE_FORMAT(b.date, '%Y-%m-%d')    AS work_date,
          COUNT(*)                           AS total
        FROM bookings b
        WHERE b.status = 'สำเร็จ'
          AND b.therapist IS NOT NULL
          AND b.therapist <> ''
          AND DATE(b.date) BETWEEN ? AND ?
        GROUP BY b.therapist, DATE_FORMAT(b.date, '%Y-%m-%d')
        ORDER BY b.therapist, work_date
        `,
        [startDate, endDate]
      );

      // รวบรวมรายการ "วันที่" ทั้งหมดที่พบข้อมูล (ใช้เป็นหัวคอลัมน์)
      // work_date เป็น string "YYYY-MM-DD" อยู่แล้วจาก DATE_FORMAT ด้านบน
      const dateSet = new Set<string>();
      rows.forEach((r: any) => {
        dateSet.add(String(r.work_date));
      });
      const dates = Array.from(dateSet).sort();

      // จัดกลุ่มข้อมูลตามชื่อผู้ให้บริการ (ไม่มี id เพราะ bookings.therapist เก็บชื่อตรงๆ)
      type TherapistRow = {
        name: string;
        counts: Record<string, number>;
        total: number;
      };
      const therapistMap = new Map<string, TherapistRow>();

      rows.forEach((r: any) => {
        const d = String(r.work_date);
        const name = String(r.therapist_name).trim();

        if (!therapistMap.has(name)) {
          therapistMap.set(name, { name, counts: {}, total: 0 });
        }
        const entry = therapistMap.get(name)!;
        entry.counts[d] = Number(r.total);
        entry.total += Number(r.total);
      });

      const therapists = Array.from(therapistMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "th")
      );

      // รวมยอดรายวัน (สำหรับแถว "รวมทั้งหมด")
      const dailyTotals: Record<string, number> = {};
      let grandTotal = 0;
      dates.forEach((d) => {
        const sum = therapists.reduce((s, t) => s + (t.counts[d] || 0), 0);
        dailyTotals[d] = sum;
        grandTotal += sum;
      });

      return NextResponse.json({
        start: startDate,
        end: endDate,
        dates,
        therapists,
        dailyTotals,
        grandTotal,
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("summary-therapists GET error:", err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูลสรุปรายงาน" },
      { status: 500 }
    );
  }
}
