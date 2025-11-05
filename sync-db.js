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

// ===== Logger =====
const log = (level, msg, err) => {
  const t = new Date().toISOString();
  const line = `[${t}] [${level}] [PID:${process.pid}] ${msg}${
    err ? "\n" + (err.stack || err.message || err) : ""
  }\n`;
  fs.appendFileSync(logPath, line);
  console.log(line);
};

// ===== Database Pools =====
let db1, db2;

async function createPools() {
  db1 = mysql.createPool({
    host: process.env.DB1_HOST,
    user: process.env.DB1_USER,
    password: process.env.DB1_PASSWORD,
    database: process.env.DB1_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 10000,
    idleTimeout: 60000, // 1 นาที
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });

  db2 = mysql.createPool({
    host: process.env.DB2_HOST,
    user: process.env.DB2_USER,
    password: process.env.DB2_PASSWORD,
    database: process.env.DB2_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 10000,
    idleTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });

  await db1.query("SELECT 1");
  await db2.query("SELECT 1");
  log("INFO", "✅ Connection pools created & tested for both databases");
}

// ===== ตรวจ connection ก่อนใช้ =====
async function ensureConnection(pool, name) {
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    if (err.message.includes("closed") || err.message.includes("lost")) {
      log("WARN", `⚠️ ${name} connection appears closed. Recreating pool...`);
      await createPools();
    } else {
      log("ERROR", `❌ ${name} connection test failed`, err);
      throw err;
    }
  }
}

// ===== ดึง HN ล่าสุด =====
async function getLastHN() {
  try {
    await ensureConnection(db2, "DB2");
    const [rows] = await db2.query(
      "SELECT MAX(CAST(hn AS UNSIGNED)) AS lastHN FROM med_user WHERE hn NOT LIKE '999%'"
    );
    const lastHN = rows[0]?.lastHN || 0;
    log("INFO", `🧮 HN ล่าสุดใน med_user (ไม่รวม test) = ${lastHN}`);
    return lastHN;
  } catch (err) {
    log("ERROR", "getLastHN()", err);
    throw err;
  }
}

// ===== ฟังก์ชัน Sync =====
async function syncPatients() {
  try {
    log("INFO", `🚀 เริ่ม sync ข้อมูล (${new Date().toISOString()})`);

    await ensureConnection(db1, "DB1");
    await ensureConnection(db2, "DB2");

    const lastHN = await getLastHN();
    const [patients] = await db1.query(
      `SELECT hn, pname, fname, lname, deathday, hometel, informname, worktel, last_update, death, mobile_phone_number
       FROM patient
       WHERE CAST(hn AS UNSIGNED) > ?
         AND hn NOT LIKE '999%'
       ORDER BY CAST(hn AS UNSIGNED) ASC`,
      [lastHN]
    );

    if (!patients.length) {
      log("INFO", "✅ ไม่มีข้อมูลใหม่");
      return;
    }

    log("INFO", `📦 พบข้อมูลใหม่ ${patients.length} รายการ (ตั้งแต่ HN > ${lastHN})`);

    for (const p of patients) {
      const name = `${p.pname}${p.fname} ${p.lname}`;
      await db2.query(
        `INSERT INTO med_user
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
    }

    log("INFO", `✅ Sync ข้อมูลใหม่เรียบร้อย (${patients.length} รายการ)`);
  } catch (err) {
    log("ERROR", "syncPatients()", err);
  }
}

// ===== Init =====
await createPools();
await syncPatients();

// ===== Schedule Cron =====
cron.schedule("*/30 * * * *", async () => {
  try {
    await syncPatients();
  } catch (err) {
    log("ERROR", "Cron job error", err);
  }
});

// ===== Graceful Shutdown =====
process.on("SIGINT", async () => {
  log("INFO", "🛑 Received SIGINT, closing pools...");
  await db1.end();
  await db2.end();
  log("INFO", "🔒 ปิดการเชื่อมต่อเรียบร้อย");
  process.exit(0);
});
