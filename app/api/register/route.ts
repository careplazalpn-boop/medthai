import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const db = await mysql.createConnection({
  host: "35.240.229.188",
  user: "dev",
  password: "4Bh4gEh.kV7PJ{91",
  database: "massage",
});

export async function POST(req: Request) {
  try {
    const { name, phone, email, password } = await req.json();

    if (!name || !phone || !email || !password) {
      return NextResponse.json(
        { success: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const [exist] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (Array.isArray(exist) && exist.length > 0) {
      return NextResponse.json(
        { success: false, error: "มีอีเมลนี้ในระบบอยู่แล้ว" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)",
      [name, phone, email, hashedPassword, "user"]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดบางอย่าง" },
      { status: 500 }
    );
  }
}
