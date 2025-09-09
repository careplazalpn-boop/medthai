import fetch from "node-fetch";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import cron from "node-cron";

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

// ----------------- Clean old off_date -----------------
async function cleanOldDates() {
  try {
    const today = getTodayTH();
    console.log(`Starting cleanOldDates job... Today: ${today}`);

    const [rows] = await pool.query("SELECT id, off_date FROM therapist");

    for (const row of rows) {
      if (!row.off_date || row.off_date.toLowerCase() === "null") continue;

      const dates = row.off_date.split(",").map(d => d.trim());
      const newDates = dates.filter(d => d >= today);

      if (newDates.join(",") !== row.off_date) {
        await pool.query("UPDATE therapist SET off_date = ? WHERE id = ?", [newDates.join(", "), row.id]);
        console.log(`[therapist:${row.id}] off_date updated: ${newDates.join(", ")}`);
      }
    }
    console.log("cleanOldDates finished!\n");
  } catch (err) {
    console.error("Error cleaning old dates:", err);
  }
}

// ----------------- Clean old disabled_slots -----------------
async function cleanOldDisabledSlots() {
  try {
    const today = getTodayTH();
    console.log(`Starting cleanOldDisabledSlots job... Today: ${today}`);

    const [rows] = await pool.query("SELECT id, disabled_slots FROM therapist");

    for (const row of rows) {
      if (!row.disabled_slots || row.disabled_slots.toLowerCase() === "null") continue;

      const slots = row.disabled_slots.split(",").map(d => d.trim());
      const newSlots = slots.filter(s => {
        const datePart = s.split("|")[0]; // YYYY-MM-DD|HH.MM-HH.MM หรือ YYYY-MM-DD
        return datePart >= today;
      });

      if (newSlots.join(",") !== row.disabled_slots) {
        await pool.query("UPDATE therapist SET disabled_slots = ? WHERE id = ?", [newSlots.join(","), row.id]);
        console.log(`[therapist:${row.id}] disabled_slots updated: ${newSlots.join(", ")}`);
      }
    }
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

async function callApi(slotLabel) {
  try {
    await new Promise(res => setTimeout(res, 2000));
    const res = await fetch(API_URL);
    const data = await res.json();
    console.log(`[${new Date().toLocaleString("en-CA", { timeZone: "Asia/Bangkok" })}] called /api/all-bookings for slot ${slotLabel}`);
  } catch (err) {
    console.error(`[${new Date().toLocaleString("en-CA", { timeZone: "Asia/Bangkok" })}] Error calling /api/all-bookings`, err);
  }
}

async function getTimeSlotsFromDB() {
  try {
    const [rows] = await pool.query("SELECT slot FROM time_slot ORDER BY id ASC");
    return rows.map(r => r.slot.split("-"));
  } catch (err) {
    console.error("Error fetching time slots from DB:", err);
    return [];
  }
}

async function checkTime() {
  const slotTimes = await getTimeSlotsFromDB();
  if (slotTimes.length === 0) return;

  const slotMinutes = slotTimes.map(([start, end]) => [
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
    const slotLabel = `${slotTimes[idx][0]}-${slotTimes[idx][1]}`;
    if (calledSlots.has(slotLabel)) return;

    if (nowM >= startM && nowM <= endM) {
      calledSlots.add(slotLabel);
      callApi(slotLabel);
    }
  });
}

// ----------------- Run -----------------
setInterval(checkTime, 1000);
checkTime();
cleanOldDates();
cleanOldDisabledSlots();
