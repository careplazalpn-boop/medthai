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

const log = (msg, level = "INFO") => {
  const t = new Date().toISOString();
  const line = `[${t}] [${level}] ${msg}\n`;
  fs.appendFileSync(logPath, line);
  console.log(line.trim());
};

// ✅ Connection pools (มี keep-alive)
const db1Pool = mysql.createPool({
  host: process.env.DB1_HOST,
  user: process.env.DB1_USER,
  password: process.env.DB1_PASSWORD,
  database: process.env.DB1_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

const db2Pool = mysql.createPool({
  host: process.env.DB2_HOST,
  user: process.env.DB2_USER,
  password: process.env.DB2_PASSWORD,
  database: process.env.DB2_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

log(`[PID: ${process.pid}] ✅ Connection pools created for both databases.`);

// 🔹 Test connection
async function testConnections() {
  try {
    const [r1] = await db1Pool.query("SELECT 1");
    const [r2] = await db2Pool.query("SELECT 1");
    log(`[PID: ${process.pid}] ✅ Connected to both databases successfully.`);
  } catch (err) {
    log(`[ERROR] ❌ Database connection test failed: ${err.message}`, "ERROR");
  }
}

// 🔹 Query helper (with reconnect)
async function safeQuery(pool, sql, params, dbName = "DB") {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    log(`[ERROR] ⚠️ Query failed on ${dbName}: ${err.message}`, "ERROR");
    if (err.message.includes("closed state") || err.message.includes("Lost connection")) {
      log(`[${dbName}] 🔄 Attempting to reconnect...`, "WARN");
      await pool.query("SELECT 1"); // force reconnect
    }
    throw err;
  }
}

// 🔹 อ่านค่า HN สูงสุด
async function getLastHN() {
  const rows = await safeQuery(
    db2Pool,
    "SELECT MAX(CAST(hn AS UNSIGNED)) AS lastHN FROM med_user WHERE hn NOT LIKE '999%'",
    [],
    "DB2"
  );
  const lastHN = rows[0]?.lastHN || 0;
  log(`🧮 HN ล่าสุดใน med_user (ไม่รวม test) = ${lastHN}`);
  return lastHN;
}

// 🔹 Sync ข้อมูล
async function syncPatients() {
  try {
    log(`🚀 เริ่ม sync ข้อมูล (เวลา: ${new Date().toISOString()})`);
    const lastHN = await getLastHN();

    const patients = await safeQuery(
      db1Pool,
      `SELECT hn, pname, fname, lname, deathday, hometel, informname, worktel, last_update, death, mobile_phone_number
       FROM patient
       WHERE CAST(hn AS UNSIGNED) > ?
         AND hn NOT LIKE '999%'
       ORDER BY CAST(hn AS UNSIGNED) ASC`,
      [lastHN],
      "DB1"
    );

    if (patients.length === 0) {
      log("✅ ไม่มีข้อมูลใหม่");
      return;
    }

    log(`📦 พบข้อมูลใหม่ ${patients.length} รายการ (ตั้งแต่ HN > ${lastHN})`);

    for (const p of patients) {
      const name = `${p.pname}${p.fname} ${p.lname}`;
      await safeQuery(
        db2Pool,
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
          mobile_phone_number=VALUES(mobile_phone_number)`,
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
        ],
        "DB2"
      );
    }

    log(`✅ Sync ข้อมูลใหม่เรียบร้อย (${patients.length} รายการ)`);
  } catch (err) {
    log(`[ERROR] ❌ เกิดข้อผิดพลาดใน syncPatients(): ${err.message}`, "ERROR");
  }
}

// 🔹 เริ่มทำงาน
await testConnections();
await syncPatients();
cron.schedule("*/30 * * * *", syncPatients);

process.on("SIGINT", async () => {
  log("🛑 Received SIGINT, closing pools...");
  await db1Pool.end();
  await db2Pool.end();
  log("🔒 ปิดการเชื่อมต่อเรียบร้อย");
  process.exit(0);
});

