import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import cron from "node-cron";

// โหลด config
dotenv.config({ path: ".env.local" });

const LOG_FILE = "sync-pts.log";
const ERROR_LOG_FILE = "sync-pts-error.log";
let isSyncing = false;

// 🔹 1. แก้ไข Connection Pool ต้นทาง (DB1)
// เปลี่ยนจาก BINARY -> TIS620 เพื่อให้ Driver อ่านภาษาไทยถูกต้องอัตโนมัติ
const db1Pool = mysql.createPool({
  host: process.env.DB1_HOST,
  user: process.env.DB1_USER,
  password: process.env.DB1_PASSWORD,
  database: process.env.DB1_NAME,
  charset: "TIS620", // ✅ แก้จุดนี้: อ่านไทยได้เลย ไม่ต้อง decode เอง
  connectionLimit: 3,
  connectTimeout: 20000,
  enableKeepAlive: true
});

// 🔹 2. แก้ไข Connection Pool ปลายทาง (DB3)
// กำหนด charset ให้ชัดเจน (ใช้ TIS620 หรือ utf8mb4 ตาม Database ปลายทาง)
const db3Pool = mysql.createPool({
  host: process.env.DB3_HOST,
  user: process.env.DB3_USER,
  password: process.env.DB3_PASSWORD,
  database: process.env.DB3_NAME,
  charset: "TIS620", // ✅ แนะนำ TIS620 เพื่อความชัวร์ หรือใช้ utf8mb4 ก็ได้ถ้าปลายทางรองรับ
  connectionLimit: 3,
  connectTimeout: 20000,
  enableKeepAlive: true
});

function logPts(message) {
  console.log(`[${new Date().toISOString()}] [INFO] ${message}`);
}

function logPtsError(message) {
  const time = new Date().toISOString();
  try {
    fs.appendFileSync(ERROR_LOG_FILE, `[${time}] ${message}\n`);
  } catch (e) { /* ignore */ }
  console.error(`[ERROR] ${message}`);
}

// ฟังก์ชันจัดรูปแบบวันที่ (คงเดิม)
function formatDateTimeToMySQL(input) {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
}

// แปลงค่าพิกัดจาก house (varchar) ให้เป็นตัวเลข ถ้าแปลงไม่ได้หรือไม่ใช่ตัวเลขจริงจะคืนค่า null
function toCoordinateOrNull(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

async function runSync() {
  if (isSyncing) {
    logPts("[WARN] งานรอบเก่ายังไม่เสร็จ ข้ามรอบนี้ไป...");
    return;
  }

  isSyncing = true;
  try {
    logPts("=== Start Sync DB1 → DB3 (Fixed Encoding TIS620) ===");

    // 1. หาเวลาล่าสุดจากปลายทาง
    const [maxDateRow] = await db3Pool.execute(`SELECT MAX(last_update) AS last_sync FROM patient`);
    let lastSyncTime = maxDateRow[0].last_sync ? formatDateTimeToMySQL(maxDateRow[0].last_sync) : "2000-01-01 00:00:00";

    logPts(`Checking updates after: ${lastSyncTime}`);

    // 2. ดึงข้อมูลจากต้นทาง (DB1)
    // ไม่ต้องแก้ SQL Query ใดๆ ดึงมาตามปกติ
    const [patients] = await db1Pool.execute(
      `SELECT p.hn, p.pname, p.fname, p.lname, p.citizenship, p.birthday,
              p.addrpart, p.road, p.moopart, p.tmbpart, p.amppart, p.chwpart,
              per.village_id, p.po_code, ta.full_name AS ta_full_name, p.nationality,
              p.bloodgrp, p.informname, p.cid, p.death, p.mobile_phone_number, 
              p.hometel, p.worktel, p.last_update
       FROM patient p
       LEFT JOIN person per ON p.cid = per.cid
       LEFT JOIN thaiaddress ta ON p.chwpart = ta.chwpart AND p.tmbpart = ta.tmbpart AND p.amppart = ta.amppart
       WHERE p.last_update > ? AND p.hn NOT LIKE '9999%'
       ORDER BY p.last_update ASC LIMIT 2000`, 
      [lastSyncTime]
    );

    if (patients.length === 0) {
      logPts("✅ ข้อมูลเป็นปัจจุบัน (No Updates)");
    } else {
      logPts(`Found ${patients.length} rows to sync/update`);

      const batchSize = 100;
      for (let i = 0; i < patients.length; i += batchSize) {
        const batch = patients.slice(i, i + batchSize);
        const valuesArray = [];

        for (const row of batch) {
          // --- Logic เดิม: จัดการค่า Null และต่อ String ที่อยู่ ---
          // ไม่ต้องใช้ tis620ToUtf8() แล้ว เพราะ row.xxx เป็น String ภาษาไทยถูกต้องแล้ว
          
          const addrpart = row.addrpart || "";
          const road = row.road || "";
          const moopart = row.moopart || "";
          const ta_full_name = row.ta_full_name || "";
          const pname = row.pname || "";
          const fname = row.fname || "";
          const lname = row.lname || "";
          const informname = row.informname || "";

          // คง Logic การต่อ String แบบเดิมเป๊ะๆ
          // `${decoded.addrpart} ถ.${decoded.road} ม.${decoded.moopart} ${decoded.ta_full_name}`
          const address_full = `${addrpart} ถ.${road} ม.${moopart} ${ta_full_name}`.trim();

          valuesArray.push(
            row.hn, pname, fname, lname, row.citizenship, 
            row.birthday ? new Date(row.birthday).toISOString().split('T')[0] : null,
            addrpart, road, moopart, row.tmbpart, row.amppart, row.chwpart,
            row.village_id || "", row.po_code, address_full, row.nationality, row.bloodgrp,
            informname, row.cid, row.death, row.mobile_phone_number, row.hometel, row.worktel,
            formatDateTimeToMySQL(row.last_update)
          );
        }

        const placeholders = batch.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
        const insertQuery = `
          INSERT INTO patient (
            hn, pname, fname, lname, citizenship, birthday, addrpart, road, moopart, tmbpart, amppart, chwpart,
            village_id, po_code, address_full, nationality, bloodgrp, informname, cid, death, 
            mobile_phone_number, hometel, worktel, last_update
          ) VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
            pname=VALUES(pname), fname=VALUES(fname), lname=VALUES(lname), citizenship=VALUES(citizenship),
            birthday=VALUES(birthday), addrpart=VALUES(addrpart), road=VALUES(road), moopart=VALUES(moopart),
            tmbpart=VALUES(tmbpart), amppart=VALUES(amppart), chwpart=VALUES(chwpart), village_id=VALUES(village_id),
            po_code=VALUES(po_code), address_full=VALUES(address_full), nationality=VALUES(nationality),
            bloodgrp=VALUES(bloodgrp), informname=VALUES(informname), cid=VALUES(cid), death=VALUES(death),
            mobile_phone_number=VALUES(mobile_phone_number), hometel=VALUES(hometel), worktel=VALUES(worktel),
            last_update=VALUES(last_update)`;

        await db3Pool.execute(insertQuery, valuesArray);
      }
      logPts("=== Sync Completed ===");
    }

    // 🔹 ต่อท้าย sync patient หลัก: sync พิกัดบ้าน (house -> patient.home_latitude/home_longitude)
    await syncHomeCoordinates();
  } catch (err) {
    logPtsError(`General error: ${err.message}`);
  } finally {
    isSyncing = false;
  }
}

// 🔹 3. Sync พิกัดบ้าน (home_latitude / home_longitude) จาก house (DB1) -> patient (DB3)
// เงื่อนไข:
//   1) patient.tmbpart = '01' AND patient.amppart = '01' AND patient.chwpart = '51' เท่านั้น
//   2) จับคู่ patient.village_id (ผ่าน person.village_id) = house.village_id
//      AND patient.addrpart = house.address AND patient.road = house.road
//   3) อัปเดตเฉพาะแถวที่ home_latitude/home_longitude ใน DB3 ยังเป็น NULL หรือค่าต่างจาก house เท่านั้น
//      (เช็คในเงื่อนไข WHERE ของคำสั่ง UPDATE โดยตรง ไม่ต้อง SELECT มาเทียบก่อน)
const GEO_TARGET = { tmbpart: "01", amppart: "01", chwpart: "51" };

async function syncHomeCoordinates() {
  logPts("=== Start Sync Home Coordinates (house -> patient.home_latitude/home_longitude) ===");
  try {
    // ดึงคู่ hn + พิกัดบ้านจากฝั่งต้นทาง (DB1) ตามเงื่อนไขที่กำหนด
    const [rows] = await db1Pool.execute(
      `SELECT p.hn, h.latitude AS house_lat, h.longitude AS house_lng
       FROM patient p
       INNER JOIN person per ON p.cid = per.cid
       INNER JOIN house h
         ON h.village_id = per.village_id
        AND h.address = p.addrpart
        AND h.road = p.road
       WHERE p.tmbpart = ?
         AND p.amppart = ?
         AND p.chwpart = ?
         AND h.latitude IS NOT NULL AND h.latitude <> ''
         AND h.longitude IS NOT NULL AND h.longitude <> ''`,
      [GEO_TARGET.tmbpart, GEO_TARGET.amppart, GEO_TARGET.chwpart]
    );

    if (rows.length === 0) {
      logPts("Home coordinates: ไม่พบข้อมูลที่ตรงเงื่อนไข");
      return;
    }

    logPts(`Home coordinates: พบ ${rows.length} แถวที่เข้าเงื่อนไข กำลังตรวจสอบ/อัปเดต...`);

    let updatedCount = 0;
    let skippedInvalidCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      const lat = toCoordinateOrNull(row.house_lat);
      const lng = toCoordinateOrNull(row.house_lng);

      // ข้ามแถวที่ house.latitude/longitude ไม่ใช่ตัวเลขที่ใช้ได้
      if (lat === null || lng === null) {
        skippedInvalidCount++;
        continue;
      }

      try {
        // อัปเดตเฉพาะกรณี home_latitude/home_longitude ยังเป็น NULL หรือค่าต่างจาก house เท่านั้น
        const [result] = await db3Pool.execute(
          `UPDATE patient
           SET home_latitude = ?, home_longitude = ?
           WHERE hn = ?
             AND (
               home_latitude IS NULL OR home_latitude <> ?
               OR home_longitude IS NULL OR home_longitude <> ?
             )`,
          [lat, lng, row.hn, lat, lng]
        );

        if (result.affectedRows > 0) updatedCount++;
      } catch (rowErr) {
        // กันพังทั้ง batch เช่นกรณีค่าพิกัดเกิน range ของ decimal(10,8) (เกิน 2 หลักหน้าจุด)
        errorCount++;
        logPtsError(`Home coordinates: อัปเดต hn=${row.hn} ไม่สำเร็จ (${rowErr.message})`);
      }
    }

    logPts(
      `Home coordinates: อัปเดตจริง ${updatedCount} แถว` +
      (skippedInvalidCount ? `, ข้ามค่าพิกัดไม่ถูกต้อง ${skippedInvalidCount} แถว` : "") +
      (errorCount ? `, ผิดพลาด ${errorCount} แถว (ดู sync-pts-error.log)` : "")
    );
  } catch (err) {
    logPtsError(`Home coordinates sync error: ${err.message}`);
  }
}

cron.schedule("0 */4 * * *", runSync);
runSync();
setInterval(() => {}, 1 << 30);