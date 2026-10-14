import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
// นำ cron ออกชั่วคราว เพราะต้องการให้รันครั้งเดียวจบตามความต้องการ
// import cron from "node-cron";

// โหลด config
dotenv.config({ path: ".env.local" });

const LOG_FILE = "sync-pts-temp.log";
const ERROR_LOG_FILE = "sync-pts-temp-error.log";
let isSyncing = false;

// 🔹 1. Connection Pool ต้นทาง (DB1)
const db1Pool = mysql.createPool({
  host: process.env.DB1_HOST,
  user: process.env.DB1_USER,
  password: process.env.DB1_PASSWORD,
  database: process.env.DB1_NAME,
  charset: "TIS620", 
  connectionLimit: 3,
  connectTimeout: 20000,
  enableKeepAlive: true
});

// 🔹 2. Connection Pool ปลายทาง (DB3)
const db3Pool = mysql.createPool({
  host: process.env.DB3_HOST,
  user: process.env.DB3_USER,
  password: process.env.DB3_PASSWORD,
  database: process.env.DB3_NAME,
  charset: "TIS620", 
  connectionLimit: 3,
  connectTimeout: 20000,
  enableKeepAlive: true
});

function logPts(message) {
  const logMsg = `[${new Date().toISOString()}] [INFO] ${message}`;
  console.log(logMsg);
  try {
    fs.appendFileSync(LOG_FILE, `${logMsg}\n`);
  } catch (e) { /* ignore */ }
}

function logPtsError(message) {
  const time = new Date().toISOString();
  try {
    fs.appendFileSync(ERROR_LOG_FILE, `[${time}] ${message}\n`);
  } catch (e) { /* ignore */ }
  console.error(`[ERROR] ${message}`);
}

function formatDateTimeToMySQL(input) {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
}

function toCoordinateOrNull(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

// 🌟 ฟังก์ชันหลัก: Sync ทั้งหมด (Patient Data + Coordinates)
async function runFullSyncOnce() {
  if (isSyncing) {
    logPts("[WARN] ระบบกำลังทำงานอยู่ ไม่สามารถเริ่มใหม่ได้");
    return;
  }

  isSyncing = true;
  try {
    logPts("=== 🚀 เริ่มต้นการ Sync ข้อมูลผู้ป่วยและพิกัดบ้าน (รันครั้งเดียว) ===");

    // Step 1: Sync ข้อมูลผู้ป่วย (เพิ่ม sex และ pttype)
    await syncPatientDataAll();

    // Step 2: Sync พิกัดบ้าน
    await syncHomeCoordinatesAll();

    logPts("=== ✅ การ Sync ข้อมูลทั้งหมดเสร็จสมบูรณ์ ===");
  } catch (err) {
    logPtsError(`เกิดข้อผิดพลาดในการรัน Sync: ${err.message}`);
  } finally {
    isSyncing = false;
    process.exit(0); // 🌟 จบการทำงานเมื่อทำเสร็จ 1 รอบ
  }
}

// 🌟 ย่อย 1: ฟังก์ชันดึงข้อมูลผู้ป่วย "ทั้งหมด" (ไม่มีเงื่อนไข last_update)
async function syncPatientDataAll() {
  logPts(">> กำลังเริ่มดึงข้อมูลผู้ป่วยจาก DB1 (ทั้งหมด)...");
  
  try {
    // 🌟 ดึงข้อมูลมาทั้งหมดโดยไม่สนใจเวลา (ลบ WHERE p.last_update > ?)
    // เพิ่ม p.sex และ p.pttype เข้ามาในคำสั่ง SELECT
    const [patients] = await db1Pool.execute(
      `SELECT p.hn, p.pname, p.fname, p.lname, p.citizenship, p.birthday,
              p.addrpart, p.road, p.moopart, p.tmbpart, p.amppart, p.chwpart,
              per.village_id, p.po_code, ta.full_name AS ta_full_name, p.nationality,
              p.bloodgrp, p.informname, p.cid, p.death, p.mobile_phone_number, 
              p.hometel, p.worktel, p.last_update, 
              p.sex, p.pttype  -- 🌟 เพิ่ม 2 ฟิลด์นี้
       FROM patient p
       LEFT JOIN person per ON p.cid = per.cid
       LEFT JOIN thaiaddress ta ON p.chwpart = ta.chwpart AND p.tmbpart = ta.tmbpart AND p.amppart = ta.amppart
       WHERE p.hn NOT LIKE '9999%'
       ORDER BY p.hn ASC`
    );

    if (patients.length === 0) {
      logPts(">> ไม่มีข้อมูลผู้ป่วยให้ Sync");
      return;
    }

    logPts(`>> ดึงข้อมูลผู้ป่วยได้ทั้งหมด ${patients.length} รายการ. กำลังเปรียบเทียบและอัปเดต...`);

    const batchSize = 100;
    let updatedOrInsertedCount = 0;

    for (let i = 0; i < patients.length; i += batchSize) {
      const batch = patients.slice(i, i + batchSize);
      const valuesArray = [];

      for (const row of batch) {
        const addrpart = row.addrpart || "";
        const road = row.road || "";
        const moopart = row.moopart || "";
        const ta_full_name = row.ta_full_name || "";
        const pname = row.pname || "";
        const fname = row.fname || "";
        const lname = row.lname || "";
        const informname = row.informname || "";

        const address_full = `${addrpart} ถ.${road} ม.${moopart} ${ta_full_name}`.trim();

        // 🌟 เพิ่ม row.sex, row.pttype เข้าไปใน array (ต่อท้ายหรือแทรกในตำแหน่งที่ต้องการ)
        valuesArray.push(
          row.hn, pname, fname, lname, row.citizenship, 
          row.birthday ? new Date(row.birthday).toISOString().split('T')[0] : null,
          addrpart, road, moopart, row.tmbpart, row.amppart, row.chwpart,
          row.village_id || "", row.po_code, address_full, row.nationality, row.bloodgrp,
          informname, row.cid, row.death, row.mobile_phone_number, row.hometel, row.worktel,
          formatDateTimeToMySQL(row.last_update),
          row.sex || null, row.pttype || null // 🌟 เพิ่ม 2 ฟิลด์นี้
        );
      }

      // 🌟 สร้าง Placeholders ให้ครบตามจำนวนฟิลด์ใหม่ (26 ตัว)
      const placeholders = batch.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
      
      // 🌟 อัปเดตคำสั่ง INSERT และ ON DUPLICATE KEY UPDATE ให้รวม 2 ฟิลด์ใหม่
      const insertQuery = `
        INSERT INTO patient (
          hn, pname, fname, lname, citizenship, birthday, addrpart, road, moopart, tmbpart, amppart, chwpart,
          village_id, po_code, address_full, nationality, bloodgrp, informname, cid, death, 
          mobile_phone_number, hometel, worktel, last_update, sex, pttype
        ) VALUES ${placeholders}
        ON DUPLICATE KEY UPDATE
          pname=VALUES(pname), fname=VALUES(fname), lname=VALUES(lname), citizenship=VALUES(citizenship),
          birthday=VALUES(birthday), addrpart=VALUES(addrpart), road=VALUES(road), moopart=VALUES(moopart),
          tmbpart=VALUES(tmbpart), amppart=VALUES(amppart), chwpart=VALUES(chwpart), village_id=VALUES(village_id),
          po_code=VALUES(po_code), address_full=VALUES(address_full), nationality=VALUES(nationality),
          bloodgrp=VALUES(bloodgrp), informname=VALUES(informname), cid=VALUES(cid), death=VALUES(death),
          mobile_phone_number=VALUES(mobile_phone_number), hometel=VALUES(hometel), worktel=VALUES(worktel),
          last_update=VALUES(last_update), sex=VALUES(sex), pttype=VALUES(pttype)`;

      // ใช้ execute สำหรับ batch insert
      const [result] = await db3Pool.query(insertQuery, valuesArray); // 🌟 เปลี่ยนจาก execute เป็น query เมื่อใช้ตัวแปรแบบต่อ string ยาวๆ เพื่อป้องกันข้อจำกัดของ prepared statement ในบางกรณี
      updatedOrInsertedCount += (result.affectedRows > 0 ? batch.length : 0); // ประมาณการจำนวนแถวที่ได้รับผลกระทบ
    }
    
    logPts(`>> ประมวลผลและ Sync ข้อมูลผู้ป่วยสำเร็จ (ประมาณ ${patients.length} รายการที่ส่งเข้า DB3)`);

  } catch (err) {
    logPtsError(`>> ขัดข้องระหว่าง Sync ข้อมูลผู้ป่วย: ${err.message}`);
  }
}

// 🌟 ย่อย 2: ฟังก์ชันดึงพิกัดบ้าน "ทั้งหมด" (ไม่มีเงื่อนไขเทียบค่า)
const GEO_TARGET = { tmbpart: "01", amppart: "01", chwpart: "51" };

async function syncHomeCoordinatesAll() {
  logPts(">> กำลังเริ่มดึงข้อมูลพิกัดบ้านจาก DB1 (ทั้งหมดตามเงื่อนไขพื้นที่)...");
  try {
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
      logPts(">> ไม่พบข้อมูลพิกัดบ้านที่ตรงเงื่อนไขพื้นที่");
      return;
    }

    logPts(`>> พบพิกัดบ้านที่เข้าเงื่อนไขทั้งหมด ${rows.length} รายการ. กำลังบังคับอัปเดตไปที่ DB3...`);

    let updatedCount = 0;
    let skippedInvalidCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      const lat = toCoordinateOrNull(row.house_lat);
      const lng = toCoordinateOrNull(row.house_lng);

      if (lat === null || lng === null) {
        skippedInvalidCount++;
        continue;
      }

      try {
        // 🌟 บังคับอัปเดตพิกัดทั้งหมดของ hn นั้นๆ โดยไม่ต้องสนว่าของเดิมเป็นอะไร (ตามที่ต้องการให้ทำใหม่ทั้งหมด)
        const [result] = await db3Pool.execute(
          `UPDATE patient
           SET home_latitude = ?, home_longitude = ?
           WHERE hn = ?`,
          [lat, lng, row.hn]
        );

        if (result.affectedRows > 0) updatedCount++;
      } catch (rowErr) {
        errorCount++;
        logPtsError(`>> อัปเดตพิกัดบ้าน hn=${row.hn} ไม่สำเร็จ (${rowErr.message})`);
      }
    }

    logPts(
      `>> สรุปผล Sync พิกัดบ้าน: อัปเดตสำเร็จ ${updatedCount} แถว` +
      (skippedInvalidCount ? `, ข้ามพิกัดไม่ถูกต้อง ${skippedInvalidCount} แถว` : "") +
      (errorCount ? `, ผิดพลาด ${errorCount} แถว` : "")
    );
  } catch (err) {
    logPtsError(`>> ขัดข้องระหว่าง Sync พิกัดบ้าน: ${err.message}`);
  }
}
