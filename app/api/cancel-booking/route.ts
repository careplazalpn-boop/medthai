import { NextResponse } from "next/server";
import pool from "../dbconnection/db"; // ⚠️ ตรวจสอบพาธนำเข้าฐานข้อมูลของคุณว่าตรงหรือไม่

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id"); // รับ ID ของคิว (bookings.id)

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ไม่พบรหัสการจอง (id)" },
        { status: 400 }
      );
    }

    // 🌟 ขั้นตอนที่ 1: ลบข้อมูลการจองเตียงพิเศษออก (ถ้ามี) เพื่อคืนเตียงให้ว่างทันที
    await pool.execute(
      "DELETE FROM special_bed_bookings WHERE booking_id = ?",
      [id]
    );

    // 🌟 ขั้นตอนที่ 2: อัปเดตสถานะคิวหลักให้เป็น "ยกเลิก"
    const [result]: any = await pool.execute(
      "UPDATE bookings SET status = 'ยกเลิก' WHERE id = ?",
      [id]
    );

    /* 
      💡 หมายเหตุ: หากระบบของคุณออกแบบมาให้ "ลบข้อมูลคิวทิ้งไปเลย" (ลบแถวออกจาก DB) 
      แทนการเปลี่ยนแค่สถานะเป็น 'ยกเลิก' ให้ลบ/คอมเมนต์ 4 บรรทัดข้างบนออก 
      แล้วใช้คำสั่งบรรทัดข้างล่างนี้แทนครับ:

      const [result]: any = await pool.execute("DELETE FROM bookings WHERE id = ?", [id]);
    */

    // ตรวจสอบว่ามีการอัปเดตข้อมูลจริงหรือไม่
    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: "ไม่พบรายการจองที่ต้องการยกเลิก หรือถูกลบไปแล้ว" },
        { status: 404 }
      );
    }

    // ส่งค่ากลับไปให้ Frontend ทราบว่าทำรายการสำเร็จ
    return NextResponse.json({ success: true, updatedStatus: "ยกเลิก" });
    
  } catch (error) {
    console.error("Error API cancel-booking:", error);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถยกเลิกการจองและเตียงพิเศษได้" },
      { status: 500 }
    );
  }
}