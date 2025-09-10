import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs"; // เปลี่ยนมาใช้ bcrypt
import crypto from "crypto";

const pool = mysql.createPool({
  host: "lmwcc.synology.me",
  user: "medthai",
  password: "I4FEtUu*-uB-hAK0",
  database: "medthai",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ฟังก์ชันสร้าง token ง่าย ๆ
function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();

    // ดึงข้อมูล user โดย query จาก username
    const [rows] = await conn.query(
      "SELECT id, username, name, role, password FROM users WHERE username = ?",
      [username]
    );

    conn.release();

    if ((rows as any).length === 0) {
      return NextResponse.json(
        { success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    const user = (rows as any)[0];

    // ตรวจสอบ password ด้วย bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    // ลบ password ออกจาก user object ก่อนส่งกลับ
    delete user.password;

    // สร้าง token session
    const token = generateToken();

    // TODO: บันทึก token ลง DB หรือ cache เพื่อใช้ตรวจสอบ session

    // สร้าง response พร้อมตั้ง cookie httpOnly สำหรับเก็บ token
    const response = NextResponse.json({ success: true, user });

    response.cookies.set({
      name: "session_token",
      value: token,
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 วัน
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;

  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดจากระบบ" },
      { status: 500 }
    );
  }
}
