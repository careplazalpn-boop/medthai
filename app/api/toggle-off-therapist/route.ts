import { NextRequest, NextResponse } from "next/server";
import pool from '../dbconnection/db';

export async function POST(req: NextRequest) {
  try {
    // 🌟 รับค่า role เข้ามาเพิ่ม (ส่งมาจาก page.tsx ที่เราปรับปรุงไป)
    const { therapist, date, slot, role }: { therapist: string; date: string; slot?: string; role?: string } = await req.json();
    if (!therapist || !date) return NextResponse.json({ success: false, message: "Missing params" });

    // จัดการสิทธิ์ให้อ่านง่ายขึ้น
    const userRole = (role === "admin" || String(role) === "909") ? "admin" : "user";

    const conn = await pool.getConnection();

    // ดึงค่า off_date และ disabled_slots ปัจจุบัน
    const [rows]: any = await conn.query("SELECT off_date, disabled_slots FROM therapist WHERE name = ?", [therapist]);
    let offDates: string[] = [];
    let disabledSlots: string[] = [];

    if (rows[0]?.off_date) {
      offDates = rows[0].off_date.split(",").map((d: string) => d.trim()).filter(Boolean);
    }
    if (rows[0]?.disabled_slots) {
      disabledSlots = rows[0].disabled_slots.split(",").map((d: string) => d.trim()).filter(Boolean);
    }

    if (slot) {
      // ==========================================
      // จัดการระดับ Slot เวลา
      // ==========================================
      const targetPrefix = `${date}|${slot}`;
      // หาว่ามี slot นี้ถูกบันทึกไว้ไหม (เช็คจาก prefix เพื่อรองรับทั้งแบบมีและไม่มี role ต่อท้าย)
      const existingItem = disabledSlots.find(d => d.startsWith(targetPrefix));

      if (existingItem) {
        // 🔴 กรณีมีอยู่แล้ว = ต้องการ "เปิด" (ยกเลิกการปิด)
        const parts = existingItem.split("|");
        const creatorRole = parts[2] || "user"; // ถ้าของเก่าไม่มี role ให้ถือเป็น user

        // 🛑 ดักสิทธิ์: ถ้า Admin เป็นคนปิดไว้ แต่ User พยายามจะเปิด -> ห้ามทำ
        if (creatorRole === "admin" && userRole !== "admin") {
          conn.release();
          return NextResponse.json({ 
            success: false, 
            error: "ไม่สามารถเปิดได้: ช่วงเวลานี้ถูกปิดให้บริการโดยผู้ดูแลระบบ (Admin)" 
          });
        }

        // อนุญาตให้ลบ (เปิดสล็อตคืน)
        disabledSlots = disabledSlots.filter(d => d !== existingItem);
      } else {
        // 🟢 กรณีไม่มี = ต้องการ "ปิด"
        // บันทึกโดยฝัง Role ลงไปด้วย
        disabledSlots.push(`${targetPrefix}|${userRole}`);
      }

    } else {
      // ==========================================
      // จัดการระดับ วันไม่มา (ทั้งวัน)
      // ==========================================
      const existingItem = offDates.find(d => d.startsWith(date));

      if (existingItem) {
        // 🔴 ต้องการ "เปิด" วันนี้
        const parts = existingItem.split("|");
        const creatorRole = parts[1] || "user"; // ของเก่าคือดึง index 1

        // 🛑 ดักสิทธิ์
        if (creatorRole === "admin" && userRole !== "admin") {
          conn.release();
          return NextResponse.json({ 
            success: false, 
            error: "ไม่สามารถเปิดได้: วันนี้ถูกตั้งค่า 'ไม่มา' โดยผู้ดูแลระบบ (Admin)" 
          });
        }

        // อนุญาตให้ลบ
        offDates = offDates.filter(d => d !== existingItem);
      } else {
        // 🟢 ต้องการ "ปิด" วันนี้
        offDates.push(`${date}|${userRole}`);
      }
    }

    // อัปเดต DB กลับเข้าไป
    await conn.query(
      "UPDATE therapist SET off_date = ?, disabled_slots = ? WHERE name = ?",
      [
        offDates.length > 0 ? offDates.join(",") : null,
        disabledSlots.length > 0 ? disabledSlots.join(",") : null,
        therapist
      ]
    );

    conn.release();
    return NextResponse.json({ 
      success: true, 
      offDates, 
      disabledSlots, 
      toggled: slot ? `${date}|${slot}` : date 
    });
    
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล" });
  }
}