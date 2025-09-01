import fetch from "node-fetch";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const API_URL = process.env.API_URL || "http://lmwcc.synology.me:3000/api/all-bookings"; 

// สร้าง connection pool ของ MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || "lmwcc.synology.me",
  user: process.env.DB_USER || "medthai",
  password: process.env.DB_PASS || "I4FEtUu*-uB-hAK0",
  database: process.env.DB_NAME || "medthai",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// เก็บ slot ที่เรียกไปแล้ววันนี้
let calledSlots = new Set();
let todayDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

// แปลงเวลาปัจจุบันของไทยเป็นนาทีของวัน
function getMinutesNowTH() {
  const now = new Date();
  const nowTH = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return nowTH.getHours() * 60 + nowTH.getMinutes();
}

// เรียก API
async function callApi(slotLabel) {
  try {
    await new Promise(res => setTimeout(res, 2000)); // รอ 2 วินาที
    const res = await fetch(API_URL);
    const data = await res.json();
    console.log(`[${new Date().toLocaleString()}] Called /api/all-bookings for slot ${slotLabel} - success: ${data.success}`);
  } catch (err) {
    console.error(`[${new Date().toLocaleString()}] Error calling /api/all-bookings`, err);
  }
}

// ดึงเวลาช่วงจาก DB
async function getTimeSlotsFromDB() {
  try {
    const [rows] = await pool.query("SELECT slot FROM time_slot ORDER BY id ASC");
    // rows = [{ slot: "08:00-09:30" }, ...]
    return rows.map(r => r.slot.split("-")); // [["08:00","09:30"], ...]
  } catch (err) {
    console.error("Error fetching time slots from DB:", err);
    return [];
  }
}

// ตรวจเวลาปัจจุบันกับแต่ละ slot
async function checkTime() {
  const slotTimes = await getTimeSlotsFromDB();
  if (slotTimes.length === 0) return;

  const slotMinutes = slotTimes.map(([start, end]) => [
    parseInt(start.split(":")[0]) * 60 + parseInt(start.split(":")[1]),
    parseInt(end.split(":")[0]) * 60 + parseInt(end.split(":")[1])
  ]);

  const nowM = getMinutesNowTH();
  const todayTH = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  // รีเซ็ต slot เรียกทุกวันใหม่
  if (todayTH !== todayDate) {
    todayDate = todayTH;
    calledSlots.clear();
  }

  slotMinutes.forEach(([startM, endM], idx) => {
    const slotLabel = `${slotTimes[idx][0]}-${slotTimes[idx][1]}`;
    if (nowM >= startM && nowM < endM && !calledSlots.has(slotLabel)) {
      calledSlots.add(slotLabel);
      callApi(slotLabel);
    }
  });
}

// ตรวจทุก 1 วินาที
setInterval(checkTime, 1000);

// เรียกทันทีตอนเริ่ม
checkTime();
