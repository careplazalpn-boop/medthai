import dotenv from "dotenv";
import mysql from "mysql2/promise";
import cron from "node-cron";
import fetch from "node-fetch";
dotenv.config({ path: ".env.local" });

const API_URL = process.env.API_URL;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ----------------- Helper -----------------
function getTodayTH() {
  const nowTH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const y = nowTH.getFullYear();
  const m = String(nowTH.getMonth() + 1).padStart(2, "0");
  const d = String(nowTH.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMinutesNowTH() {
  const now = new Date();
  const nowTH = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return nowTH.getHours() * 60 + nowTH.getMinutes();
}

// ----------------- Clean old off_date (batch) -----------------
async function cleanOldDates() {
  try {
    const today = getTodayTH();
    console.log(`Starting cleanOldDates job... Today: ${today}`);

    // ดึงข้อมูลที่ต้อง update
    const [rows] = await pool.query(
      "SELECT id, off_date FROM therapist WHERE off_date IS NOT NULL AND off_date != 'null'"
    );

    if (rows.length === 0) return console.log("No off_date to update.");

    // สร้าง CASE WHEN สำหรับ batch update
    const cases = [];
    const ids = [];
    const values = [];
    rows.forEach(row => {
      const newDates = row.off_date
        .split(",")
        .map(d => d.trim())
        .filter(d => d >= today)
        .join(",");
      cases.push(`WHEN id = ? THEN ?`);
      ids.push(row.id);
      values.push(newDates);
    });

    const sql = `UPDATE therapist SET off_date = CASE ${cases.join(" ")} ELSE off_date END WHERE id IN (${ids.map(() => "?").join(",")})`;
    await pool.query(sql, [...ids.flatMap((id, i) => [id, values[i]]), ...ids]);

    console.log("cleanOldDates finished!\n");
  } catch (err) {
    console.error("Error cleaning old dates:", err);
  }
}

// ----------------- Clean old disabled_slots (batch) -----------------
async function cleanOldDisabledSlots() {
  try {
    const today = getTodayTH();
    console.log(`Starting cleanOldDisabledSlots job... Today: ${today}`);

    const [rows] = await pool.query(
      "SELECT id, disabled_slots FROM therapist WHERE disabled_slots IS NOT NULL AND disabled_slots != 'null'"
    );
    if (rows.length === 0) return console.log("No disabled_slots to update.");

    const cases = [];
    const ids = [];
    const values = [];

    rows.forEach(row => {
      const newSlots = row.disabled_slots
        .split(",")
        .map(s => s.trim())
        .filter(s => s.split("|")[0] >= today)
        .join(",");
      cases.push(`WHEN id = ? THEN ?`);
      ids.push(row.id);
      values.push(newSlots);
    });

    const sql = `UPDATE therapist SET disabled_slots = CASE ${cases.join(" ")} ELSE disabled_slots END WHERE id IN (${ids.map(() => "?").join(",")})`;
    await pool.query(sql, [...ids.flatMap((id, i) => [id, values[i]]), ...ids]);

    console.log("cleanOldDisabledSlots finished!\n");
  } catch (err) {
    console.error("Error cleaning old disabled_slots:", err);
  }
}

// ----------------- Cron Job -----------------
cron.schedule("0 0 * * *", () => {
  console.log("Running scheduled jobs (Bangkok Time)");
  cleanOldDates();
  cleanOldDisabledSlots();
}, { timezone: "Asia/Bangkok" });

// ----------------- API Slot Checker -----------------
let calledSlots = new Set();
let todayDate = getTodayTH();
let cachedSlots = [];

async function refreshTimeSlots() {
  try {
    const [rows] = await pool.query("SELECT slot FROM time_slot ORDER BY id ASC");
    cachedSlots = rows.map(r => r.slot.split("-"));
  } catch (err) {
    console.error("[refresh] Error fetching time slots:", err);
  }
}
refreshTimeSlots();
setInterval(refreshTimeSlots, 5 * 60 * 1000);

async function callApi(slotLabel) {
  try {
    const res = await fetch(API_URL);
    console.log("Status:", res.status);
    console.log(`[${new Date().toLocaleString("en-CA", { timeZone: "Asia/Bangkok" })}] called /api/all-bookings for slot ${slotLabel}`);
  } catch (err) {
    console.error(`[${new Date().toLocaleString("en-CA", { timeZone: "Asia/Bangkok" })}] Error calling /api/all-bookings`, err);
  }
}

async function checkTime() {
  if (cachedSlots.length === 0) return;

  const slotMinutes = cachedSlots.map(([start, end]) => [
    parseInt(start.split(":")[0]) * 60 + parseInt(start.split(":")[1]),
    parseInt(end.split(":")[0]) * 60 + parseInt(end.split(":")[1])
  ]);

  const nowM = getMinutesNowTH();
  const todayTH = getTodayTH();

  if (todayTH !== todayDate) {
    todayDate = todayTH;
    calledSlots.clear();
  }

  slotMinutes.forEach(([startM, endM], idx) => {
    const slotLabel = `${cachedSlots[idx][0]}-${cachedSlots[idx][1]}`;
    if (calledSlots.has(slotLabel)) return;

    if (nowM >= startM && nowM <= endM) {
      calledSlots.add(slotLabel);
      callApi(slotLabel);
    }
  });
}

// ----------------- Run -----------------
(async () => {
  await checkTime();
  await cleanOldDates();
  await cleanOldDisabledSlots();
})();

setInterval(checkTime, 5000);
