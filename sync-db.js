import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import cron from "node-cron";

dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logPath = join(__dirname, "sync.log");

// 🔹 ฟังก์ชันบันทึก log พร้อมหมวด
function log(msg, type = "INFO") {
  const t = new Date().toISOString();
  const line = `[${t}] [${type}] ${msg}\n`;
  fs.appendFileSync(logPath, line);
  console.log(line.trim());
}

// 🔹 สร้าง Connection Pool ทั้งสองฝั่ง
const pool1 = mysql.createPool({
  host: process.env.DB1_HOST,
  user: process.env.DB1_USER,
  password: process.env.DB1_PASSWORD,
  database: process.env.DB1_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const pool2 = mysql.createPool({
  host: process.env.DB2_HOST,
  user: process.env.DB2_USER,
  password: process.env.DB2_PASSWORD,
  database: process.env.DB2_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

log("✅ Connection pools created for both databases.");

// 🔹 ตรวจสอบว่าเชื่อมต่อได้จริง
async function testConnections() {
  try {
    await pool1.query("SELECT 1");
    await pool2.query("SELECT 1");
    log("✅ Connected to both databases successfully.");
  } catch (err) {
    log(`❌ Connection test failed: ${err.message}`, "DB-CONNECT");
    process.exit(1);
  }
}

// 🔹 อ่านค่า HN ล่าสุดจาก med_user
async function getLastHN() {
  try {
    const [rows] = await pool2.query(`
      SELECT MAX(CAST(hn AS UNSIGNED)) AS lastHN
      FROM med_user
      WHERE hn NOT LIKE '999%'
    `);
    const lastHN = rows[0]?.lastHN || 0;
    log(`🧮 HN ล่าสุดใน med_user (ไม่รวม test) = ${lastHN}`);
    return lastHN;
  } catch (err) {
    log(`❌ [DB2 ERROR] อ่านค่า HN ล่าสุดล้มเหลว: ${err.message}`, "DB2");
    return 0;
  }
}

// 🔹 ดึงและ sync ข้อมูลจาก patient → med_user
async function syncPatients() {
  const jobStart = new Date().toISOString();
  log(`🚀 เริ่ม sync ข้อมูล (เวลา: ${jobStart})`);

  try {
    const lastHN = await getLastHN();

    const [patients] = await pool1.query(
      `
      SELECT hn, pname, fname, lname, deathday, hometel, informname, worktel, last_update, death, mobile_phone_number
      FROM patient
      WHERE CAST(hn AS UNSIGNED) > ?
        AND hn NOT LIKE '999%'
      ORDER BY CAST(hn AS UNSIGNED) ASC
    `,
      [lastHN]
    );

    if (patients.length === 0) {
      log("✅ ไม่มีข้อมูลใหม่");
      return;
    }

    log(`📦 พบข้อมูลใหม่ ${patients.length} รายการ (ตั้งแต่ HN > ${lastHN})`);

    for (const p of patients) {
      const name = `${p.pname}${p.fname} ${p.lname}`;
      try {
        await pool2.query(
          `
          INSERT INTO med_user
            (hn, name, pname, fname, lname, deathday, hometel, informname, worktel, last_update, death, mobile_phone_number)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name=VALUES(name),
            pname=VALUES(pname),
            fname=VALUES(fname),
            lname=VALUES(lname),
            deathday=VALUES(deathday),
            hometel=VALUES(hometel),
            informname=VALUES(informname),
            worktel=VALUES(worktel),
            last_update=VALUES(last_update),
            death=VALUES(death),
            mobile_phone_number=VALUES(mobile_phone_number)
        `,
          [
            p.hn,
            name,
            p.pname,
            p.fname,
            p.lname,
            p.deathday,
            p.hometel,
            p.informname,
            p.worktel,
            p.last_update,
            p.death,
            p.mobile_phone_number,
          ]
        );
      } catch (err) {
        log(`❌ [DB2 INSERT ERROR] HN ${p.hn}: ${err.message}`, "DB2");
      }
    }

    log(`✅ Sync ข้อมูลใหม่เรียบร้อย (${patients.length} รายการ)`);
  } catch (err) {
    log(`❌ [SYNC ERROR] เกิดข้อผิดพลาดระหว่าง sync: ${err.message}`, "SYNC");
  }
}

// 🔹 เริ่มต้นระบบ
await testConnections();
await syncPatients();

// 🔹 ตั้ง cron ทุก 30 นาที
cron.schedule("*/30 * * * *", async () => {
  await syncPatients();
});

// 🔹 cleanup เมื่อปิด process
process.on("SIGINT", async () => {
  log("🛑 Received SIGINT, closing pools...");
  await pool1.end();
  await pool2.end();
  log("🔒 ปิดการเชื่อมต่อเรียบร้อย");
  process.exit(0);
});
