// วางที่: src/app/api/cancel-special-bed/route.ts
// (path import ของ db เหมือนกับ src/app/api/all-bookings/route.ts)
import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

// 🛏️ DELETE: ยกเลิกการจองเตียงพิเศษของ booking หนึ่งรายการ
// - ลบเฉพาะแถวในตาราง special_bed_bookings (ไม่แตะตาราง bookings เลย)
// - ใช้ transaction + ล็อกแถว เพื่อไม่ให้ชนกับการกดยืนยัน (สำเร็จ) ที่เกิดพร้อมกัน
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const bookingId = Number(url.searchParams.get("bookingId"));

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return NextResponse.json({ success: false, error: "ไม่พบรหัสการจอง" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const roleId = Number(body?.role_id || 0);
  const requesterName = String(body?.name || "").trim();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ล็อกแถว booking เพื่อกันการเปลี่ยนสถานะพร้อมกัน
    const [bookingRows]: any = await conn.execute(
      "SELECT id, therapist, status FROM bookings WHERE id = ? FOR UPDATE",
      [bookingId]
    );
    const booking = bookingRows[0];
    if (!booking) {
      await conn.rollback();
      return NextResponse.json({ success: false, error: "ไม่พบรายการจอง" }, { status: 404 });
    }

    // สิทธิ์: แอดมิน (909) หรือพนักงานนวดเจ้าของรายการ (ตรงกับเงื่อนไข canManageBooking ฝั่งหน้าเว็บ)
    const isAdmin = roleId === 909;
    const isOwner = !!requesterName && booking.therapist === requesterName;
    if (!isAdmin && !isOwner) {
      await conn.rollback();
      return NextResponse.json(
        { success: false, error: "ไม่มีสิทธิ์ยกเลิกการจองเตียงของรายการนี้" },
        { status: 403 }
      );
    }

    // เตียงที่ใช้บริการเสร็จแล้ว (booking สำเร็จ) ไม่ให้ยกเลิก
    if (booking.status === "สำเร็จ") {
      await conn.rollback();
      return NextResponse.json(
        { success: false, error: "ไม่สามารถยกเลิกการจองเตียงได้ เนื่องจากรายการนี้สำเร็จแล้ว" },
        { status: 409 }
      );
    }

    const [result]: any = await conn.execute(
      "DELETE FROM special_bed_bookings WHERE booking_id = ?",
      [bookingId]
    );

    if (!result.affectedRows) {
      await conn.rollback();
      return NextResponse.json(
        { success: false, error: "ไม่พบการจองเตียงของรายการนี้ (อาจถูกยกเลิกไปแล้ว)" },
        { status: 404 }
      );
    }

    await conn.commit();
    return NextResponse.json({ success: true, deleted: result.affectedRows });
  } catch (error) {
    try {
      await conn.rollback();
    } catch {}
    console.error("Error cancelling special bed booking:", error);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถยกเลิกการจองเตียงได้" },
      { status: 500 }
    );
  } finally {
    conn.release();
  }
}
