import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const API_URL = process.env.API_URL || "http://127.0.0.1:3000/api/all-bookings";

// เวลาช่วง [start, end] ในรูปแบบ "HH:MM"
const timeSlots = [
  ["08:00", "09:30"],
  ["09:30", "11:00"],
  ["11:00", "12:30"],
  ["13:00", "14:30"],
  ["14:30", "16:00"],
  ["16:00", "17:30"]
];

// แปลง slot เป็นนาที
const slotMinutes = timeSlots.map(([start, end]) => [
  parseInt(start.split(":")[0]) * 60 + parseInt(start.split(":")[1]),
  parseInt(end.split(":")[0]) * 60 + parseInt(end.split(":")[1]),
]);

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

// ตรวจเวลาปัจจุบันกับแต่ละ slot
function checkTime() {
  const nowM = getMinutesNowTH();
  const todayTH = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  // รีเซ็ต slot เรียกทุกวันใหม่
  if (todayTH !== todayDate) {
    todayDate = todayTH;
    calledSlots.clear();
  }

  slotMinutes.forEach(([startM, endM], idx) => {
    const slotLabel = `${timeSlots[idx][0]}-${timeSlots[idx][1]}`;
    if (nowM >= startM && nowM < endM && !calledSlots.has(slotLabel)) {
      calledSlots.add(slotLabel);
      callApi(slotLabel);
    }
  });
}

setInterval(checkTime, 1000); // ทุก 1 วินาที

// เรียกทันทีตอนเริ่ม
checkTime();