import { NextResponse } from "next/server";
import pool from "../dbconnection/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ฟังก์ชันสร้าง Session Token
function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน",
        },
        { status: 400 }
      );
    }

    const conn = await pool.getConnection();

    try {
      // ดึงข้อมูลผู้ใช้
      const [rows] = await conn.query(
        `SELECT
            id,
            username,
            name,
            role,
            password,
            role_id
         FROM users
         WHERE username = ?`,
        [username]
      );

      if ((rows as any).length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
          },
          { status: 401 }
        );
      }

      const user = (rows as any)[0];

      // ตรวจสอบรหัสผ่าน
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return NextResponse.json(
          {
            success: false,
            error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
          },
          { status: 401 }
        );
      }

      // ลบ Password ก่อนส่งกลับ
      delete user.password;

      // ============================
      // ตรวจสอบสิทธิ์ Admin
      // role_id = 909 คือ Admin
      // ============================
      user.isAdmin = Number(user.role_id) === 909;

      // สร้าง Session Token
      const token = generateToken();

      // TODO:
      // หากในอนาคตต้องการระบบ Session จริง
      // ให้บันทึก token ลงฐานข้อมูลที่นี่

      const response = NextResponse.json({
        success: true,
        user,
      });

      // ============================
      // Cookie เดิม
      // ============================
      response.cookies.set({
        name: "session_token",
        value: token,
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      // ============================
      // Cookie สำหรับตรวจสอบสิทธิ์
      // ============================
      response.cookies.set({
        name: "role_id",
        value: String(user.role_id),
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      response.cookies.set({
        name: "is_admin",
        value: user.isAdmin ? "true" : "false",
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      return response;

    } finally {
      conn.release();
    }

  } catch (error) {
    console.error("Login API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "เกิดข้อผิดพลาดจากระบบ",
      },
      {
        status: 500,
      }
    );
  }
}