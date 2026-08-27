import { NextResponse } from "next/server";
import pool from "../dbconnection/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, status } = body;

    // ✅ ใหม่: รับข้อมูลผู้เรียก API มาด้วย เพื่อใช้ตรวจสอบสิทธิ์ก่อนแก้ไข
    // รองรับทั้งชื่อคีย์ role/role_id และ userId/user_id เผื่อฝั่งหน้าเว็บส่งมาคนละแบบ (เหมือน /api/bookings เดิม)
    const roleParam = body.role ?? body.role_id ?? "";
    const userIdParam = body.userId ?? body.user_id ?? "";

    if (!id || !status) {
      return NextResponse.json({ success: false, error: "Missing parameters" });
    }

    // ✅ ใหม่: ตรวจสอบสิทธิ์ผู้เรียก — แอดมิน (909) แก้ไขได้ทุกรายการ
    // ผู้ใช้ทั่วไปแก้ไขได้เฉพาะรายการที่ตนเองเป็นเจ้าของ (therapist ของ booking ตรงกับชื่อผู้ใช้ที่ login)
    let isAdmin = false;
    let currentUserName: string | null = null;
    const normalizedRole = String(roleParam).toLowerCase().trim();

    if (normalizedRole === "909" || normalizedRole === "admin") {
      isAdmin = true;
    }

    if (userIdParam) {
      const [userRows]: any = await pool.execute(
        "SELECT name, role, role_id FROM users WHERE id = ?",
        [userIdParam]
      );
      if (userRows && userRows.length > 0) {
        currentUserName = userRows[0].name ?? null;
        const rId = String(userRows[0].role_id);
        const rName = String(userRows[0].role || "").toLowerCase();
        if (rId === "909" || rId === "admin" || rName === "909" || rName === "admin") isAdmin = true;
      }
    }

    // ถ้าไม่ใช่แอดมิน และไม่มี userId ให้ยืนยันตัวตนเลย ปฏิเสธไว้ก่อนเพื่อความปลอดภัย
    if (!isAdmin && !userIdParam) {
      return NextResponse.json(
        { success: false, error: "ไม่มีสิทธิ์แก้ไขรายการนี้" },
        { status: 403 }
      );
    }

    // ✅ เดิม: เช็คสถานะปัจจุบันของ booking ก่อน — ถ้า "สำเร็จ" แล้ว ห้ามแก้ไข payment_status อีก
    // (กันกรณีมีการเรียก API นี้ตรงๆ โดยไม่ผ่านหน้าเว็บ ซึ่งฝั่ง UI ถูกล็อกไว้แล้ว)
    // ✅ ใหม่: ดึง therapist มาด้วย เพื่อใช้เช็คความเป็นเจ้าของรายการ
    const [rows]: any = await pool.execute(
      "SELECT status, therapist FROM bookings WHERE id = ?",
      [id]
    );
    const booking = rows[0];
    if (!booking) {
      return NextResponse.json({ success: false, error: "ไม่พบรายการนี้" });
    }

    // ✅ ใหม่: ถ้าไม่ใช่แอดมิน ต้องเป็นเจ้าของรายการ (therapist ตรงกับชื่อผู้ใช้) เท่านั้นถึงจะแก้ไขได้
    if (!isAdmin) {
      const isOwner = !!currentUserName && booking.therapist === currentUserName;
      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: "ไม่สามารถแก้ไขรายการของผู้อื่นได้" },
          { status: 403 }
        );
      }
    }

    if (booking.status === "สำเร็จ") {
      return NextResponse.json({
        success: false,
        error: "รายการนี้สำเร็จแล้ว ไม่สามารถแก้ไขสถานะการจ่ายเงินได้",
      });
    }

    await pool.execute("UPDATE bookings SET payment_status = ? WHERE id = ?", [status, id]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error updating payment status:", err);
    return NextResponse.json({ success: false, error: "Internal server error" });
  }
}