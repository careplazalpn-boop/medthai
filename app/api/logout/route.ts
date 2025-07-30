// app/api/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: "session_token",
    value: "",
    maxAge: 0,
    path: "/",
  });
  return response;
}
