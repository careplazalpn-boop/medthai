import mysql from "mysql2/promise";
import fetch from "node-fetch";

// ตั้งค่า DB
const pool = mysql.createPool({
  host: "lmwcc.synology.me",
  user: "medthai",
  password: "I4FEtUu*-uB-hAK0",
  database: "medthai",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// URL API update therapist status
const API_URL = "http://localhost:3000/api/update-therapist-status";

// polling interval
const INTERVAL_MS = 5000; // ตรวจสอบทุก 5 วินาที

// flag เก็บสถานะเรียก API
let apiCalled = false;

// ฟังก์ชันเช็คว่ามีหมออยู่ในคิวหรือไม่
async function checkQueueAndUpdate() {
  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        "SELECT id FROM bookings WHERE status = 'อยู่ในคิว' LIMIT 1"
      );

      if (rows.length > 0) {
        if (!apiCalled) { // ถ้ายังไม่เคยเรียก
          console.log("พบหมอที่อยู่ในคิว, เรียก API update-therapist-status...");
          try {
            const res = await fetch(API_URL, { method: "PATCH" });
            const data = await res.json();
            console.log("ผลลัพธ์:", data);
            apiCalled = true; // ตั้ง flag ว่าเรียกแล้ว
          } catch (err) {
            console.error("เกิดข้อผิดพลาดในการเรียก API:", err.message);
          }
        } else {
          console.log("API ถูกเรียกไปแล้ว, รอ booking ใหม่");
        }
      } else {
        if (apiCalled) {
          console.log("ไม่มีหมออยู่ในคิว, reset flag");
        }
        apiCalled = false; // ไม่มี booking อยู่ในคิว → reset flag
      }
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("Database error:", err.message);
  }
}

// ฟังก์ชันเช็คว่า Next.js server พร้อมก่อน
async function waitForServer(url, timeout = 1000) {
  while (true) {
    try {
      const res = await fetch(url);
      if (res.ok) break;
    } catch (err) {
      console.log("รอ Next.js server พร้อม...");
    }
    await new Promise(r => setTimeout(r, timeout));
  }
}

// เริ่ม polling
(async () => {
  console.log("เริ่ม polling...");
  await waitForServer("http://localhost:3000"); // รอ server พร้อม
  console.log("Next.js server พร้อมแล้ว");

  // เรียกครั้งแรก
  checkQueueAndUpdate();

  // ตั้ง interval
  setInterval(checkQueueAndUpdate, INTERVAL_MS);
})();
