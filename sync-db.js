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
  // fs.appendFileSync(logPath, line); // เปิดถ้าต้องการเก็บ log ลงไฟล์
  console.log(line.trim());
};

// 🔹 Pool DB1
const db1Pool = mysql.createPool({
  host: process.env.DB1_HOST,
  user: process.env.DB1_USER,
  password: process.env.DB1_PASSWORD,
  database: process.env.DB1_NAME,
  connectionLimit: 5,
  charset: "TIS620",
  connectTimeout: 20000,
  enableKeepAlive: true
});

// 🔹 Pool DB2
const db2Pool = mysql.createPool({
  host: process.env.DB2_HOST,
  user: process.env.DB2_USER,
  password: process.env.DB2_PASSWORD,
  database: process.env.DB2_NAME,
  connectionLimit: 5,
  charset: "TIS620",
  connectTimeout: 20000,
  enableKeepAlive: true
});

// 🔹 Helper: format datetime
function formatDateTime(dateInput) {
  if (!dateInput) return "2000-01-01 00:00:00";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "2000-01-01 00:00:00";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

// 🔹 Query helper
async function safeQuery(pool, sql, params, dbName = "DB") {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.execute(sql, params);
    return rows;
  } catch (err) {
    log(`⚠️ Query failed on ${dbName}: ${err.message}`, "ERROR");
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

// 🔹 อ่าน Last Update
async function getLastUpdate(db2Pool) {
  const rows = await safeQuery(
    db2Pool,
    "SELECT MAX(last_update) AS last_sync FROM med_user",
    [],
    "DB2"
  );

  const lastSync = rows[0]?.last_sync;
  const isStandardFormat = /^\d{4}-\d{2}-\d{2}/.test(lastSync);

  if (!lastSync || !isStandardFormat) {
    log(`⚠️ พบ format วันที่ผิดปกติหรือไม่มีข้อมูล (${lastSync})`);
    return "2000-01-01 00:00:00";
  }

  log(`✅ Checkpoint ล่าสุด: ${lastSync}`);
  return lastSync;
}

// 🔹 เช็คว่า med_user มี column is_manual หรือยัง
//    (is_manual=1 = คนไข้ที่เพิ่มเองผ่านระบบ /api/add-patient — ห้ามถูก full sync ลบ)
let isManualChecked = false;
let hasIsManualColumn = false;
async function checkIsManualColumn() {
  if (isManualChecked) return hasIsManualColumn;
  isManualChecked = true;
  try {
    const rows = await safeQuery(
      db2Pool,
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'med_user' AND COLUMN_NAME = 'is_manual'`,
      [process.env.DB2_NAME],
      "DB2"
    );
    hasIsManualColumn = Number(rows[0]?.c) > 0;
    if (!hasIsManualColumn) {
      log("⚠️ med_user ยังไม่มี column is_manual — จะ sync ปกติแต่ข้ามการลบข้อมูล", "WARN");
      log("   รันก่อน: ALTER TABLE med_user ADD COLUMN is_manual TINYINT(1) NOT NULL DEFAULT 0;", "WARN");
    }
  } catch (e) {
    log(`⚠️ check is_manual column failed: ${e.message}`, "WARN");
  }
  return hasIsManualColumn;
}

// 🔹 Helpers สำหรับ diff-then-write (full sync)
//    เทียบค่าที่ควรเป็น (จากต้นทาง) กับค่าจริงใน med_user — upsert เฉพาะ field ที่ต่างจริง
//    ลด write/binlog/lock มาก: รอบที่ไม่มีอะไรเปลี่ยนจะเขียนแทบไม่เลย
const isEmptyVal = (v) => v === null || v === undefined || v === "";
const normVal = (v) => (isEmptyVal(v) ? "" : String(v));

function dateOnlyStr(v) {
  if (isEmptyVal(v)) return "";
  if (v instanceof Date) return formatDateTime(v).split(" ")[0];
  return String(v).slice(0, 10);
}

// สร้างค่าที่ควรเป็นของ 1 record (รูปแบบเดียวกับที่จะ upsert)
function expectedValues(p) {
  return {
    name: `${p.pname || ""}${p.fname || ""} ${p.lname || ""}`.trim(),
    pname: p.pname,
    fname: p.fname,
    lname: p.lname,
    deathday: p.deathday ? formatDateTime(p.deathday).split(" ")[0] : null,
    hometel: p.hometel,
    informname: p.informname,
    worktel: p.worktel,
    last_update: formatDateTime(p.last_update),
    death: p.death,
    mobile_phone_number: p.mobile_phone_number,
  };
}

const DIFF_FIELDS = ["name", "pname", "fname", "lname", "hometel", "informname", "worktel", "death", "mobile_phone_number"];
function rowDiffers(ex, exp) {
  for (const f of DIFF_FIELDS) {
    if (normVal(ex[f]) !== normVal(exp[f])) return true;
  }
  // deathday เป็น DATE → เทียบเฉพาะส่วนวันที่ (DB อาจคืน Date object)
  // ⚠️ ไม่เทียบ last_update — เป็น metadata ของ sync ไม่ใช่ข้อมูลคนไข้
  //    ถ้าเทียบด้วย format คนละแบบจะทำให้ทุก row "ต่าง" แล้ว upsert ซ้ำทั้ง 60k ทุกรอบ
  return dateOnlyStr(ex.deathday) !== (exp.deathday || "");
}

function upsertParams(p) {
  const e = expectedValues(p);
  return [p.hn, e.name, e.pname, e.fname, e.lname, e.deathday, e.hometel,
          e.informname, e.worktel, e.last_update, e.death, e.mobile_phone_number];
}

const UPSERT_SQL = `
  INSERT INTO med_user
  (hn, name, pname, fname, lname, deathday, hometel,
   informname, worktel, last_update, death, mobile_phone_number)
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
`;

const CHUNK = 500;
// upsert เป็นชุดละ 500 + commit ทีละชุด → lock สั้น ไม่ต้องรอ transaction ยาว ๆ
async function applyUpserts(conn, patients) {
  for (let i = 0; i < patients.length; i += CHUNK) {
    const chunk = patients.slice(i, i + CHUNK);
    await conn.beginTransaction();
    try {
      for (const p of chunk) await conn.execute(UPSERT_SQL, upsertParams(p));
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    }
    if (patients.length > CHUNK) {
      log(`   ...upsert ${Math.min(i + CHUNK, patients.length)}/${patients.length}`);
    }
  }
}

async function applyDeletes(conn, hns) {
  for (let i = 0; i < hns.length; i += CHUNK) {
    const chunk = hns.slice(i, i + CHUNK);
    await conn.beginTransaction();
    try {
      await conn.query(
        `DELETE FROM med_user WHERE hn IN (${chunk.map(() => "?").join(",")})`,
        chunk
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    }
  }
}

// 🔹 Sync Logic
//    full=false → incremental (เฉพาะ last_update ใหม่กว่า checkpoint, สูงสุด 1000/รอบ)
//    full=true  → full sync (ทุก record) + ลบ record ใน med_user ที่ไม่มีในต้นทางแล้ว
//                 (เฉพาะ is_manual=0 — คนไข้ที่เพิ่มเองผ่านระบบจะไม่ถูกลบ)
//                 ใช้ diff-then-write: upsert เฉพาะ record ที่ต่างจริง
async function syncPatients(full = false) {
  try {
    log(`🚀 เริ่ม sync ข้อมูล (patient -> med_user)${full ? " [FULL]" : ""}`);

    const lastSyncTime = full ? "1970-01-01 00:00:00" : await getLastUpdate(db2Pool);
    if (!full) log(`🔍 ค้นหาข้อมูลที่มีการแก้ไขหลังเวลา: ${lastSyncTime}`);

    const patients = (await safeQuery(
      db1Pool,
      full
        ? `
        SELECT hn, pname, fname, lname, deathday, hometel, informname,
               worktel, last_update, death, mobile_phone_number
        FROM patient
        WHERE hn NOT LIKE '999%'
        ORDER BY last_update ASC
        `
        : `
        SELECT hn, pname, fname, lname, deathday, hometel, informname,
               worktel, last_update, death, mobile_phone_number
        FROM patient
        WHERE last_update > ?
          AND hn NOT LIKE '999%'
        ORDER BY last_update ASC
        LIMIT 1000
        `,
      full ? [] : [lastSyncTime],
      "DB1"
    )).filter(p => p.hn); // กัน record ที่ hn ว่างพังทั้ง chunk

    // ⚠️ full sync แต่ source ว่าง → ข้ามทั้งหมด (กันลบ med_user ทิ้งทั้งหมดกรณี DB1 มีปัญหา)
    if (patients.length === 0) {
      log(full ? "⚠️ FULL sync: ไม่พบข้อมูลต้นทาง — ข้าม (ไม่ลบอะไรทั้งสิ้น)" : "✅ ข้อมูลเป็นปัจจุบันแล้ว");
      return;
    }

    log(`📦 พบข้อมูลต้นทาง ${patients.length} รายการ`);

    const db2Conn = await db2Pool.getConnection();
    try {
      if (full) {
        // ---- FULL sync: เทียบกับ med_user ทั้งหมด แล้วเขียนเฉพาะที่ต่างจริง ----
        const hasManual = await checkIsManualColumn();
        const [existingRows] = await db2Conn.query(
          `SELECT hn, name, pname, fname, lname, deathday, hometel,
                  informname, worktel, death, mobile_phone_number${hasManual ? ", is_manual" : ""}
           FROM med_user`
        );
        const existingMap = new Map(existingRows.map(r => [r.hn, r]));

        const sourceHns = new Set();
        const changed = [];
        let inserted = 0, updated = 0, skipped = 0;
        for (const p of patients) {
          sourceHns.add(p.hn);
          const ex = existingMap.get(p.hn);
          if (!ex) {
            changed.push(p); inserted++;
          } else if (rowDiffers(ex, expectedValues(p))) {
            changed.push(p); updated++;
          } else {
            skipped++;
          }
        }

        // record ใน med_user ที่ไม่มีในต้นทาง → ลบ (เฉพาะเมื่อมี is_manual column
        // เพื่อให้คนไข้ที่เพิ่มเองผ่านระบบไม่ถูกลบ)
        const toDelete = hasManual
          ? existingRows
              .filter(r => r.hn && !r.is_manual && !sourceHns.has(r.hn))
              .map(r => r.hn)
          : [];

        log(`📊 full sync: ใหม่ ${inserted}, แก้ไข ${updated}, ไม่เปลี่ยน ${skipped}, ลบ ${toDelete.length}`);

        await applyUpserts(db2Conn, changed);
        await applyDeletes(db2Conn, toDelete);
        log(`✅ Full sync เสร็จ — upsert ${changed.length} รายการ, ลบ ${toDelete.length} รายการ`);
      } else {
        // ---- incremental: upsert ทุก record ที่ last_update ใหม่กว่า checkpoint ----
        await applyUpserts(db2Conn, patients);
        log(`✅ Sync สำเร็จ ${patients.length} รายการ`);
      }
    } finally {
      db2Conn.release();
    }
  } catch (err) {
    log(`❌ syncPatients error: ${err.message}`, "ERROR");
  }
}

// 🔹 เริ่ม Service
console.log("Service Started: sync-db.js (Native TIS620 + Smart Date)");

// ▶️ รันทันทีเมื่อ start (incremental)
syncPatients(false);

// ⏰ incremental: ทุก 1 ชั่วโมง — เก็บเฉพาะ record ที่ last_update เปลี่ยน
cron.schedule("0 * * * *", () => syncPatients(false), { timezone: "Asia/Bangkok" });

// ⏰ full sync: ทุก 6 ชั่วโมง — upsert ทุก record + ลบ record ที่หายไปจากต้นทาง
//    (กันกรณี last_update ต้นทางไม่ถูกอัปเดตตอนแก้ไข → ข้อมูลค้างไม่ sync)
cron.schedule("30 */6 * * *", () => syncPatients(true), { timezone: "Asia/Bangkok" });

// กัน process exit
setInterval(() => {}, 1 << 30);