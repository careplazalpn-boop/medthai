import { NextResponse } from "next/server";
import pool from '../dbconnection/db';

// ฟังก์ชันสำหรับอัปเดตสถานะในฐานข้อมูลโดยตรง
async function updateBookingStatus(status: string, bookingId: string | number) {
    await pool.execute("UPDATE bookings SET status = ? WHERE id = ?", [status, bookingId]);
}

// GET: ดึง bookings ทั้งหมด พร้อม payment_status
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const confirmId = url.searchParams.get("confirmId");
        const now = new Date();
        const nowString = now.toISOString().slice(0, 19).replace('T', ' '); // รูปแบบ MySQL DATETIME

        let updatedStatus: string | null = null;
        let confirmedBooking: any = null;

        // --- 1. อัปเดตสถานะ Auto-Update ในฐานข้อมูลก่อน (Single Query) ---
        // ตรวจสอบ booking ที่ 'อยู่ในคิว' และเวลาสิ้นสุด (endTime) ผ่านไปแล้ว ให้เปลี่ยนเป็น 'สำเร็จ'
        // NOTE: ต้องมั่นใจว่า time_slot และ date ถูกจัดเก็บในรูปแบบที่ถูกต้องเพื่อใช้ฟังก์ชัน CONCAT/STR_TO_DATE
        // การคำนวณ endTime ต้องเกิดขึ้นใน SQL เพื่อความแม่นยำ
        
        await pool.execute(`
            UPDATE bookings
            SET status = 'สำเร็จ'
            WHERE status = 'อยู่ในคิว'
            AND CONCAT(date, ' ', SUBSTRING_INDEX(time_slot, '-', -1)) <= NOW()
        `);

        // --- 2. ฟังก์ชัน confirm booking (ถ้ามี confirmId) ---
        if (confirmId) {
            // ดึงข้อมูล booking ที่ต้องการ confirm เพื่อคำนวณสถานะใหม่
            const [bookingRows]: any = await pool.execute("SELECT id, time_slot, date FROM bookings WHERE id = ?", [confirmId]);
            const booking = bookingRows[0];
            
            if (booking) {
                // อัปเดตสถานะทันทีโดยใช้ NOW() และสมมติว่าเป็น 'อยู่ในคิว' หรือ 'สำเร็จ'
                const [result]: any = await pool.execute(`
                    UPDATE bookings 
                    SET status = CASE 
                        WHEN CONCAT(date, ' ', SUBSTRING_INDEX(time_slot, '-', -1)) <= NOW() THEN 'สำเร็จ'
                        ELSE 'อยู่ในคิว'
                    END
                    WHERE id = ?`, 
                    [confirmId]
                );
                
                if (result.affectedRows > 0) {
                    // ดึงสถานะที่ถูกอัปเดตกลับมา
                    const [updatedRows]: any = await pool.execute("SELECT status FROM bookings WHERE id = ?", [confirmId]);
                    updatedStatus = updatedRows[0].status;
                    confirmedBooking = { id: confirmId, status: updatedStatus };
                }
            }
        }

        // --- 3. ดึงข้อมูลทั้งหมดใน Query เดียว ---
        const [rows]: any = await pool.execute(
            "SELECT id, provider, name, phone, therapist, time_slot, date, status, payment_status, created_at FROM bookings ORDER BY id DESC"
        );
        
        // --- 4. คำนวณเฉลี่ยต่อเดือน (รวมไว้แล้ว) ---
        const year = now.getFullYear();
        const [avgRows]: any = await pool.execute(
            "SELECT COUNT(*) / 12 AS avg_per_month FROM bookings WHERE YEAR(date) = ?",
            [year]
        );
        const avgPerMonth = avgRows[0].avg_per_month || 0;

        return NextResponse.json({ success: true, bookings: rows, updatedStatus, avgPerMonth });
    } catch (error) {
        console.error("Error fetching all bookings:", error);
        // ตรวจสอบชนิดของ Error เพื่อส่ง Status Code ที่เหมาะสม (เช่น 404 ถ้าหาตารางไม่เจอ)
        const status = error && (error as any).code === 'ER_NO_SUCH_TABLE' ? 404 : 500;
        return NextResponse.json({ success: false, error: "ไม่สามารถดึงข้อมูลการจองทั้งหมดได้" }, { status: 500 });
    }
}

// DELETE: ลบ booking (ไม่มีการเปลี่ยนแปลง)
export async function DELETE(req: Request) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ success: false, error: "ไม่พบ id" }, { status: 400 });

        await pool.execute("DELETE FROM bookings WHERE id = ?", [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting booking:", error);
        return NextResponse.json({ success: false, error: "ไม่สามารถลบรายการได้" }, { status: 500 });
    }
}

// POST: mark payment (ไม่มีการเปลี่ยนแปลง)
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id } = body;
        if (!id) return NextResponse.json({ success: false, error: "ไม่พบ id" }, { status: 400 });

        await pool.execute("UPDATE bookings SET payment_status = 'paid' WHERE id = ?", [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating payment status:", error);
        return NextResponse.json({ success: false, error: "ไม่สามารถอัปเดตการจ่ายเงินได้" }, { status: 500 });
    }
}
