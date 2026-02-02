import mysql from "mysql2/promise";
import dotenv from "dotenv";
import iconv from "iconv-lite";
import fs from "fs";
import cron from "node-cron";

dotenv.config({ path: ".env.local" });

const LOG_FILE = "sync-db-ptsimage.log";
const ERROR_LOG_FILE = "sync-db-ptsimage-error.log";
let isSyncing = false;

// 🔹 สร้าง Connection Pools (ย้ายออกด้านนอกเพื่อความเสถียรและลดสถานะ Sleep)
const poolConfig = (dbPrefix, limit) => ({
  host: process.env[`${dbPrefix}_HOST`],
  user: process.env[`${dbPrefix}_USER`],
  password: process.env[`${dbPrefix}_PASSWORD`],
  database: process.env[`${dbPrefix}_NAME`],
  connectionLimit: limit,
  charset: "BINARY",
  waitForConnections: true,
  connectTimeout: 60000, // รูปภาพต้องการเวลาเชื่อมต่อนานกว่าปกติ
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

    // 1. ดึง HN+Image ล่าสุดจากปลายทาง (Logic เดิม)
    const [maxRow] = await db3Pool.execute(
      `SELECT hn, image_name FROM patient_image ORDER BY hn DESC, image_name DESC LIMIT 1`
    );
    const lastHN = maxRow[0]?.hn || "0";
    const lastImageName = maxRow[0]?.image_name || "";

    logPts(`Last synced: HN=${lastHN}, image_name=${lastImageName}`);

    // 2. ดึงข้อมูลใหม่จาก DB1 (คง LIMIT ไว้ที่ 200 ตามเดิม เพราะ RAM 50G รับไหวสบายมาก)
    const [images] = await db1Pool.execute(
      `SELECT hn, image_name, image, width, height, capture_date, hos_guid, hos_guid_ext
       FROM patient_image
       WHERE (hn > ? OR (hn = ? AND image_name > ?))
       ORDER BY hn ASC, image_name ASC LIMIT 200`,
      [lastHN, lastHN, lastImageName]
    );

    if (images.length === 0) {
      logPts("✅ ไม่มีข้อมูลใหม่");
    } else {
      logPts(`Found ${images.length} new images to sync`);

      // 3. Batch Processing (ใช้ batchSize 50 ตามของเดิมที่คุณตั้งไว้)
      const batchSize = 50;
      for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);

        const valuesArray = batch.map((row) => [
          tis620ToUtf8(row.hn),
          tis620ToUtf8(row.image_name),
          row.image, // BLOB รูปภาพ
          row.width || null,
          row.height || null,
          row.capture_date || null,
          tis620ToUtf8(row.hos_guid),
          tis620ToUtf8(row.hos_guid_ext),
        ]);

        const placeholders = batch.map(() => "(?,?,?,?,?,?,?,?)").join(",");
        const insertQuery = `
          INSERT INTO patient_image 
          (hn, image_name, image, width, height, capture_date, hos_guid, hos_guid_ext)
          VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
            image=VALUES(image),
            width=VALUES(width),
            height=VALUES(height),
            capture_date=VALUES(capture_date),
            hos_guid=VALUES(hos_guid),
            hos_guid_ext=VALUES(hos_guid_ext)`;

        await db3Pool.execute(insertQuery, valuesArray.flat());
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
console.log("Service Started: sync-db-ptsimage.js (Optimized Pool Mode)");
runSync();
cron.schedule("0 0,12 * * *", runSync);

setInterval(() => {}, 1 << 30);