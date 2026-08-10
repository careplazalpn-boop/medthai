import mysql from "mysql2/promise";
import dotenv from "dotenv";
import iconv from "iconv-lite";
import fs from "fs";
import cron from "node-cron";

dotenv.config({ path: ".env.local" });

const LOG_FILE = "sync-db-ptsimage.log";
const ERROR_LOG_FILE = "sync-db-ptsimage-error.log";
let isSyncing = false;

const poolConfig = (dbPrefix, limit) => ({
  host: process.env[`${dbPrefix}_HOST`],
  user: process.env[`${dbPrefix}_USER`],
  password: process.env[`${dbPrefix}_PASSWORD`],
  database: process.env[`${dbPrefix}_NAME`],
  connectionLimit: limit,
  charset: "BINARY",
  waitForConnections: true,
  connectTimeout: 60000,
  enableKeepAlive: true
});

const db1Pool = mysql.createPool(poolConfig('DB1', 5));
const db3Pool = mysql.createPool(poolConfig('DB3', 5));

function logPts(message) {
  const time = new Date().toISOString();
  console.log(`[${time}] [INFO] ${message}`);
}

function logPtsError(message) {
  const time = new Date().toISOString();
  fs.appendFileSync(ERROR_LOG_FILE, `[${time}] ${message}\n`);
  console.error(`[ERROR] ${message}`);
}

function tis620ToUtf8(input) {
  if (!input) return "";
  try {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "binary");
    return iconv.decode(buf, "tis620");
  } catch { return String(input); }
}

async function runSync() {
  if (isSyncing) {
    logPts("[WARN] งานรอบเก่ายังไม่เสร็จ ข้ามรอบนี้ไป...");
    return;
  }

  isSyncing = true;
  try {
    logPts("=== Start Sync DB1 → DB3 (patient_image) ===");

    // 1. ดึง Key (HN + image_name) ทั้งหมดจาก DB1
    const [rows1] = await db1Pool.execute("SELECT hn, image_name FROM patient_image");
    const set1 = new Set(rows1.map(r => `${tis620ToUtf8(r.hn)}|${tis620ToUtf8(r.image_name)}`));

    // 2. ดึง Key ทั้งหมดจาก DB3
    const [rows3] = await db3Pool.execute("SELECT hn, image_name FROM patient_image");
    const set3 = new Set(rows3.map(r => `${r.hn}|${r.image_name}`));

    // 3. หาภาพที่ตกหล่น (ไม่ว่าจะอยู่ HN ไหนก็ตาม)
    const missingKeys = [...set1].filter(key => !set3.has(key));

    if (missingKeys.length === 0) {
      logPts("✅ ไม่มีข้อมูลใหม่ (รูปภาพครบถ้วนตรงกัน)");
    } else {
      logPts(`⚠️ พบรูปภาพที่ตกหล่นจำนวน: ${missingKeys.length} รูป`);

      // 4. ทยอย Sync ทีละ Batch (จำกัดที่ 15 รูปต่อรอบป้องกัน Packet ล้น)
      const BATCH_SIZE = 15;
      let syncedCount = 0;

      for (let i = 0; i < missingKeys.length; i += BATCH_SIZE) {
        const batchKeys = missingKeys.slice(i, i + BATCH_SIZE);

        const keyObjects = batchKeys.map(k => {
          const [hn, imgName] = k.split('|');
          return { hn, image_name: imgName };
        });

        const placeholders = keyObjects.map(() => "(?,?)").join(",");
        const queryParams = keyObjects.flatMap(k => [k.hn, k.image_name]);

        // ดึง BLOB จาก DB1
        const [images] = await db1Pool.execute(
          `SELECT hn, image_name, image, width, height, capture_date, hos_guid, hos_guid_ext
           FROM patient_image
           WHERE (hn, image_name) IN (${placeholders})`,
          queryParams
        );

        if (images.length > 0) {
          const valuesArray = images.map((row) => [
            tis620ToUtf8(row.hn),
            tis620ToUtf8(row.image_name),
            row.image, // BLOB
            row.width || null,
            row.height || null,
            row.capture_date || null,
            tis620ToUtf8(row.hos_guid),
            tis620ToUtf8(row.hos_guid_ext),
          ]);

          const insertPlaceholders = images.map(() => "(?,?,?,?,?,?,?,?)").join(",");
          const insertQuery = `
            INSERT INTO patient_image 
            (hn, image_name, image, width, height, capture_date, hos_guid, hos_guid_ext)
            VALUES ${insertPlaceholders}
            ON DUPLICATE KEY UPDATE
              image=VALUES(image),
              width=VALUES(width),
              height=VALUES(height),
              capture_date=VALUES(capture_date),
              hos_guid=VALUES(hos_guid),
              hos_guid_ext=VALUES(hos_guid_ext)`;

          await db3Pool.execute(insertQuery, valuesArray.flat());
          syncedCount += images.length;
          logPts(`⏳ Sync รูปภาพไปแล้ว: ${syncedCount} / ${missingKeys.length}`);
        }
      }
      logPts("=== Sync Completed ===");
    }
  } catch (err) {
    logPtsError(`General error: ${err.message}`);
  } finally {
    isSyncing = false;
  }
}

// ----------------------
// Scheduler
// ----------------------
console.log("Service Started: sync-db-ptsimage.js (Full Diff Sync Mode)");
runSync();
cron.schedule("0 0,12 * * *", runSync);

setInterval(() => {}, 1 << 30);