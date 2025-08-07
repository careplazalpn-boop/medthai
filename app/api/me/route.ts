// เป็น API สำหรับตรวจสอบ สถานะการล็อกอินของผู้ใช้ ว่ายังล็อกอินอยู่และ session ถูกต้องหรือไม่
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "lmwcc.synology.me",
  user: "medthai",
  password: "I4FEtUu*-uB-hAK0",
  database: "medthai",
});

export async function GET() {
  const cookieStore = await cookies(); // 👈 ใช้ await ที่นี่
  const sessionToken = cookieStore.get("session")?.value;

  if (!sessionToken) {
    return NextResponse.json(
      { success: false, error: "ไม่มี session" },
      { status: 401 }
    );
  }

  const conn = await pool.getConnection();
  const [rows] = await conn.query(
    `SELECT users.id, users.name, users.email, users.phone, users.role 
     FROM sessions 
     JOIN users ON sessions.user_id = users.id 
     WHERE sessions.token = ?`,
    [sessionToken]
  );
  conn.release();

  if ((rows as any).length === 0) {
    return NextResponse.json(
      { success: false, error: "session ไม่ถูกต้อง" },
      { status: 401 }
    );
  }

  const user = (rows as any)[0];
  return NextResponse.json({ success: true, user });
}
