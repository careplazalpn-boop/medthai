import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import cron from "node-cron";

// โหลด .env
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

// ❌ ลบ const db1Pool และ db2Pool ที่อยู่ใน Global Scope ออก
// ❌ ลบ await testConnections(); ออก

// 🔹 Query helper (ใช้ Connection ที่มาจาก Pool)
async function safeQuery(pool, sql, params, dbName = "DB") {
  let conn; // ประกาศตัวแปร Connection
  try {
    conn = await pool.getConnection(); // 💡 ดึง Connection ใหม่ทุกครั้ง
    const [rows] = await conn.execute(sql, params); // ใช้ execute แทน query
    return rows;
  } catch (err) {
    log(`[ERROR] ⚠️ Query failed on ${dbName}: ${err.message}`, "ERROR");
    // ไม่ต้องพยายาม reconnect เพราะ Pool จะจัดการเอง เราแค่ throw error ออกไป
    throw err;
  } finally {
    if (conn) conn.release(); // 💡 คืน Connection สู่ Pool เสมอ
  }
}

// 🔹 อ่านค่า HN สูงสุด
async function getLastHN(db2Pool) { // รับ Pool เข้ามาเป็น Argument
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
  let db1Pool, db2Pool; // ประกาศตัวแปร Pool

  try {
    // 💡 สร้าง Pool ภายในฟังก์ชัน เพื่อป้องกัน Connection Closed State
    db1Pool = mysql.createPool({
      host: process.env.DB1_HOST,
      user: process.env.DB1_USER,
      password: process.env.DB1_PASSWORD,
      database: process.env.DB1_NAME,
      connectionLimit: 5,
    });
    
    db2Pool = mysql.createPool({
      host: process.env.DB2_HOST,
      user: process.env.DB2_USER,
      password: process.env.DB2_PASSWORD, // ใช้ DB2_PASSWORD ที่คุณระบุ
      database: process.env.DB2_NAME,
      connectionLimit: 5,
    });

    log(`🚀 เริ่ม sync ข้อมูล (เวลา: ${new Date().toISOString()})`);
    
    // ตรวจสอบการเชื่อมต่อ (ไม่จำเป็นต้องทำ testConnections แยก)
    await db1Pool.query("SELECT 1"); 
    await db2Pool.query("SELECT 1"); 
    log(`✅ Connected to both databases successfully.`);


    const lastHN = await getLastHN(db2Pool);

    const patients = await safeQuery(
      db1Pool, // 💡 ใช้ Pool ที่สร้างใหม่
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

    // ... (Loop Insert ใช้ db2Pool) ...
    for (const p of patients) {
      const name = `${p.pname || ''}${p.fname || ''} ${p.lname || ''}`.trim();

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
          p.hn, name, p.pname, p.fname, p.lname, p.deathday, p.hometel,
          p.informname, p.worktel, p.last_update, p.death, p.mobile_phone_number,
        ],
        "DB2"
      );
    }

    log(`✅ Sync ข้อมูลใหม่เรียบร้อย (${patients.length} รายการ)`);
  } catch (err) {
    log(`[ERROR] ❌ เกิดข้อผิดพลาดใน syncPatients(): ${err.message}`, "ERROR");
  } finally {
    // 💡 ปิด Pool ทั้งสองเมื่อจบงาน
    if (db1Pool) await db1Pool.end().catch(e => log(`Error closing DB1: ${e.message}`, "WARN"));
    if (db2Pool) await db2Pool.end().catch(e => log(`Error closing DB2: ${e.message}`, "WARN"));
    log("🔒 ปิดการเชื่อมต่อเรียบร้อย");
  }
}

// 🔹 เริ่มทำงานและตั้งเวลา
// 💡 เราเรียก syncPatients() โดยตรงแทน
syncPatients(); 
cron.schedule("*/30 * * * *", syncPatients);

// ❌ ลบ process.on("SIGINT", ...) ออกไป เพราะ Pool ถูกปิดแล้วใน Finally Block
// การจัดการ SIGINT อาจขัดแย้งกับการสร้าง/ทำลาย Pool ในทุก ๆ รอบ