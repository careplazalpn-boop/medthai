import mysql from "mysql2/promise";
import dotenv from "dotenv";

// โหลด config จาก .env.local
dotenv.config({ path: ".env.local" });

// 🔹 Config Pools
const db1Pool = mysql.createPool({
  host: process.env.DB1_HOST,
  user: process.env.DB1_USER,
  password: process.env.DB1_PASSWORD,
  database: process.env.DB1_NAME,
  charset: "UTF8MB4_GENERAL_CI",
  connectionLimit: 5,
  connectTimeout: 20000
});

const db3Pool = mysql.createPool({
  host: process.env.DB3_HOST,
  user: process.env.DB3_USER,
  password: process.env.DB3_PASSWORD,
  database: process.env.DB3_NAME,
  charset: "UTF8MB4_GENERAL_CI",
  connectionLimit: 5,
  connectTimeout: 20000
});

/**
 * ฟังก์ชันตรวจสอบภาษาต่างดาว
 * ตรวจสอบว่ามีตัวอักษรที่ไม่อยู่ในกลุ่ม ภาษาไทย (U+0E00-U+0E7F), ภาษาอังกฤษ, ตัวเลข และสัญลักษณ์พื้นฐานหรือไม่
 */
function isAlienLanguage(text) {
  if (!text) return false;
  // Regex: อนุญาตเฉพาะ ก-ฮ, สระ, วรรณยุกต์, A-Z, a-z, 0-9, ช่องว่าง, จุด, ขีด
  // ถ้ามีอักขระอื่นนอกเหนือจากนี้ (เช่น Ã, Â, Ê หรือสัญลักษณ์แปลกๆ) จะถือว่าเป็นภาษาต่างดาว
  const cleanPattern = /^[a-zA-Z0-9\u0E00-\u0E7F\s.\-()]+$/;
  return !cleanPattern.test(text);
}

function safeTruncate(str, maxLength) {
  if (!str) return "";
  const s = String(str);
  return s.length > maxLength ? s.substring(0, maxLength) : s;
}

function formatDateTimeToMySQL(input) {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function runMissingSync() {
  try {
    log("🚀 เริ่มต้นกระบวนการตรวจสอบ HN ที่ตกหล่นและภาษาต่างดาว...");

    // 1. ดึง HN ทั้งหมดจากต้นทาง (DB1)
    log("📥 กำลังดึงรายชื่อ HN ทั้งหมดจาก DB1 (Source)...");
    const [rows1] = await db1Pool.execute("SELECT hn FROM patient WHERE hn NOT LIKE '9999%'");
    const hn1Set = new Set(rows1.map(r => r.hn));
    log(`✅ DB1 มีจำนวน: ${rows1.length} รายการ`);

    // 2. ดึง HN พร้อมชื่อ-นามสกุล จากปลายทาง (DB3) เพื่อเช็คความถูกต้อง
    log("📥 กำลังดึงข้อมูลจาก DB3 (Destination) เพื่อตรวจสอบคุณภาพข้อมูล...");
    const [rows3] = await db3Pool.execute("SELECT hn, fname, lname FROM patient");
    
    // เก็บข้อมูล DB3 ลงใน Map เพื่อความรวดเร็วในการค้นหา
    const db3Map = new Map();
    rows3.forEach(r => db3Map.set(r.hn, { fname: r.fname, lname: r.lname }));
    log(`✅ DB3 มีจำนวน: ${rows3.length} รายการ`);

    // 3. วิเคราะห์หา HN ที่ต้อง Sync (หายไป OR ภาษาต่างดาว)
    const targetHNs = [...hn1Set].filter(hn => {
      // กรณีที่ 1: ไม่มี HN นี้ในปลายทาง
      if (!db3Map.has(hn)) return true;

      // กรณีที่ 2: มี HN แล้ว แต่ชื่อหรือนามสกุลเป็นภาษาต่างดาว
      const record = db3Map.get(hn);
      if (isAlienLanguage(record.fname) || isAlienLanguage(record.lname)) {
        return true; 
      }

      return false;
    });
    
    if (targetHNs.length === 0) {
      log("🎉 ข้อมูลครบถ้วนและถูกต้อง (ไม่พบภาษาต่างดาว) ไม่ต้อง Sync เพิ่ม");
      process.exit(0);
    }

    log(`⚠️ พบข้อมูลที่ต้องแก้ไข/Sync จำนวน: ${targetHNs.length} รายการ`);
    log("🔄 กำลังเริ่มแก้ไขข้อมูล...");

    // 4. ทยอย Sync ทีละ Batch
    const BATCH_SIZE = 100;
    let syncedCount = 0;

    for (let i = 0; i < targetHNs.length; i += BATCH_SIZE) {
      const hnBatch = targetHNs.slice(i, i + BATCH_SIZE);
      const placeholdersIn = hnBatch.map(() => '?').join(',');
      
      const [patients] = await db1Pool.execute(
        `SELECT p.hn, p.pname, p.fname, p.lname, p.citizenship, p.birthday,
                p.addrpart, p.road, p.moopart, p.tmbpart, p.amppart, p.chwpart,
                per.village_id, p.po_code, ta.full_name AS ta_full_name, p.nationality,
                p.bloodgrp, p.informname, p.cid, p.death, p.mobile_phone_number, 
                p.hometel, p.worktel, p.last_update
         FROM patient p
         LEFT JOIN person per ON p.cid = per.cid
         LEFT JOIN thaiaddress ta ON p.chwpart = ta.chwpart AND p.tmbpart = ta.tmbpart AND p.amppart = ta.amppart
         WHERE p.hn IN (${placeholdersIn})`,
        hnBatch
      );

      if (patients.length > 0) {
        const valuesArray = [];
        for (const row of patients) {
            const addrpart = row.addrpart || "";
            const road = row.road ? `ถ.${row.road}` : "";
            const moopart = row.moopart ? `ม.${row.moopart}` : "";
            const ta_full_name = row.ta_full_name || "";
            const address_full = `${addrpart} ${road} ${moopart} ${ta_full_name}`.replace(/\s+/g, ' ').trim();

            valuesArray.push(
              row.hn, row.pname, row.fname, row.lname, row.citizenship, 
              row.birthday ? new Date(row.birthday).toISOString().split('T')[0] : null,
              row.addrpart, row.road, row.moopart, row.tmbpart, row.amppart, row.chwpart,
              row.village_id || "", row.po_code, 
              safeTruncate(address_full, 200),
              row.nationality, row.bloodgrp,
              safeTruncate(row.informname, 100),
              row.cid, row.death, row.mobile_phone_number, row.hometel, row.worktel,
              formatDateTimeToMySQL(row.last_update)
            );
        }

        const placeholdersVal = patients.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
        const insertQuery = `
            INSERT INTO patient (
              hn, pname, fname, lname, citizenship, birthday, addrpart, road, moopart, tmbpart, amppart, chwpart,
              village_id, po_code, address_full, nationality, bloodgrp, informname, cid, death, 
              mobile_phone_number, hometel, worktel, last_update
            ) VALUES ${placeholdersVal}
            ON DUPLICATE KEY UPDATE
              pname=VALUES(pname), 
              fname=VALUES(fname), 
              lname=VALUES(lname),
              informname=VALUES(informname),
              address_full=VALUES(address_full),
              mobile_phone_number=VALUES(mobile_phone_number),
              last_update=VALUES(last_update)`;

        await db3Pool.execute(insertQuery, valuesArray);
        syncedCount += patients.length;
        process.stdout.write(`\r⏳ ดำเนินการไปแล้ว: ${syncedCount} / ${targetHNs.length}`);
      }
    }

    console.log("\n");
    log("✅ เสร็จสิ้นกระบวนการ! ข้อมูลที่เคยเป็นภาษาต่างดาวได้รับการแก้ไขแล้ว");
    process.exit(0);

  } catch (err) {
    console.error("\n❌ เกิดข้อผิดพลาด:", err);
    process.exit(1);
  }
}

runMissingSync();
