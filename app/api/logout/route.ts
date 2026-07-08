import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });

  // รายชื่อ Cookie ทั้งหมดที่ระบบมีการใช้งาน ให้ลบออกให้หมด
  const cookiesToDelete = ["session_token", "role_id", "is_admin", "user_id"];

  cookiesToDelete.forEach((name) => {
    response.cookies.set({
      name: name,
      value: "",
      maxAge: 0,
      path: "/",
    });
  });

  return response;
}