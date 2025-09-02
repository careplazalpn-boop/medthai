import fetch from "node-fetch";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import cron from "node-cron";

dotenv.config();

const API_URL = process.env.API_URL || "http://127.0.0.1:3000/api/all-bookings"; 

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

// ----------------- Background Job: Clean old off_dates -----------------
function getTodayTH() {
  const nowTH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const y = nowTH.getFullYear();
  const m = String(nowTH.getMonth() + 1).padStart(2, "0");
  const d = String(nowTH.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function cleanOldDates() {
  try {
    const today = getTodayTH(); // yyyy-mm-dd
    console.log(`[debug] Starting cleanOldDates job...`);
    console.log(`[debug] Today (TH): ${today}`);

    const [rows] = await pool.query("SELECT id, off_date FROM therapist");

    for (const row of rows) {
      if (!row.off_date || row.off_date.toLowerCase() === "null") continue;

      const dates = row.off_date.split(",").map(d => d.trim());
      const newDates = dates.filter(d => d >= today);

      console.log();
      console.log(`[therapist:${row.id}] Raw off_date: "${row.off_date}"`);
      console.log(`[therapist:${row.id}] Filtered dates:`, newDates);

      if (newDates.join(",") !== row.off_date) {
        await pool.query("UPDATE therapist SET off_date = ? WHERE id = ?", [
          newDates.join(","),
          row.id,
        ]);
        console.log(`[therapist:${row.id}] DB updated successfully!`);
      } else {
        console.log(`[therapist:${row.id}] Dates unchanged, no update needed`);
      }
    }
    console.log();
    console.log(`[debug] cleanOldDates job finished successfully!`);
  } catch (err) {
    console.error("Error cleaning old dates:", err);
  }
  console.log();
}

// ตั้ง Cron Job รันทุกวันตอนเที่ยงคืนไทย
cron.schedule(
  "0 0 * * *",
  () => {
    console.log("Running scheduled job: cleanOldDates (Bangkok Time)");
    cleanOldDates();
  },
  {
    timezone: "Asia/Bangkok"
  }
);

// ----------------- API Slot Checker -----------------

let calledSlots = new Set();
let todayDate = getTodayTH();

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
    console.log(`[${new Date().toLocaleString("en-CA", { timeZone: "Asia/Bangkok" })}] Called /api/all-bookings for slot ${slotLabel} - success: ${data.success}`);
  } catch (err) {
    console.error(`[${new Date().toLocaleString("en-CA", { timeZone: "Asia/Bangkok" })}] Error calling /api/all-bookings`, err);
  }
}

// ดึงเวลาช่วงจาก DB
async function getTimeSlotsFromDB() {
  try {
    const [rows] = await pool.query("SELECT slot FROM time_slot ORDER BY id ASC");
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
  const todayTH = getTodayTH();

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

// ----------------- รัน cleanOldDates ตอนเริ่มด้วย เผื่อ process เริ่มใหม่ -----------------
cleanOldDates();
