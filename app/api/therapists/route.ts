import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../dbconnection/db";

export async function GET() {
  try {
    // อ่าน Cookie
    const cookieStore = await cookies();

    const roleId = cookieStore.get("role_id")?.value ?? "";
    const isAdminCookie = cookieStore.get("is_admin")?.value ?? "false";

    const isAdmin =
      roleId === "909" || isAdminCookie.toLowerCase() === "true";

    let query = "";

    if (isAdmin) {
      query = `
        SELECT
          id,
          name,
          CONCAT_WS(' ', fname, lname) AS shortname,
          therapist_type,
          status
        FROM therapist
        WHERE status = 0
        ORDER BY id ASC
      `;
    } else {
      query = `
        SELECT
          id,
          name,
          CONCAT_WS(' ', fname, lname) AS shortname,
          therapist_type,
          status
        FROM therapist
        WHERE status = 0
          AND therapist_type = 0
        ORDER BY id ASC
      `;
    }

    const [rows] = await pool.query(query);

    return NextResponse.json({
      success: true,
      therapists: rows,
    });

  } catch (error) {
    console.error("Failed to fetch therapists:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch therapists",
      },
      {
        status: 500,
      }
    );
  }
}