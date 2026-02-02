import mysql from "mysql2/promise";
import dotenv from "dotenv";

// โหลด config
dotenv.config({ path: ".env.local" });

// 🔹 Config Pools
const db1Pool = mysql.createPool({
  host: process.env.DB1_HOST,
  user: process.env.DB1_USER,
  password: process.env.DB1_PASSWORD,
  database: process.env.DB1_NAME,
  charset: "TIS620",
  connectionLimit: 5,
  connectTimeout: 20000
});

// 🔹 Config DB4 (ใช้ค่าจาก DB3 ตามที่คุณระบุมา)
const db4Pool = mysql.createPool({
  host: process.env.DB4_HOST,
  user: process.env.DB4_USER,
  password: process.env.DB4_PASSWORD,
  database: process.env.DB4_NAME,
  charset: "TIS620",
  connectionLimit: 5,
  connectTimeout: 20000
});

// Helper: Format วันที่
function formatDateTimeToMySQL(input) {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
}

// Helper: ตัดข้อความยาวเกิน (ป้องกัน Error Data too long)
function safeTruncate(str, maxLength) {
  if (!str) return "";
  if (str.length > maxLength) {
    return str.substring(0, maxLength);
  }
  return str;
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function runMissingSync() {
  try {
    log("🚀 เริ่มต้นกระบวนการตรวจสอบ HN ที่ตกหล่น...");

    // 1. ดึง HN ทั้งหมดจากต้นทาง (DB1)
    log("📥 กำลังดึงรายชื่อ HN ทั้งหมดจาก DB1 (Source)...");
    const [rows1] = await db1Pool.execute("SELECT hn FROM patient WHERE hn NOT LIKE '9999%'");
    const hn1Set = new Set(rows1.map(r => r.hn));
    log(`✅ DB1 มีจำนวน: ${rows1.length} รายการ`);

    // 2. ดึง HN ทั้งหมดจากปลายทาง (DB4)
    log("📥 กำลังดึงรายชื่อ HN ทั้งหมดจาก DB4 (Destination)...");
    // ✅ แก้ไข: ใช้ db4Pool (ตัวเล็ก) ให้ตรงกับที่ประกาศข้างบน
    const [rows3] = await db4Pool.execute("SELECT hn FROM patient");
    const hn3Set = new Set(rows3.map(r => r.hn));
    log(`✅ DB4 มีจำนวน: ${rows3.length} รายการ`);

    // 3. หา HN ที่ขาดหายไป (Diff)
    const missingHNs = [...hn1Set].filter(hn => !hn3Set.has(hn));
    
    if (missingHNs.length === 0) {
      log("🎉 เยี่ยมมาก! ข้อมูลครบถ้วนตรงกันแล้ว ไม่ต้อง Sync เพิ่ม");
      process.exit(0);
    }

    log(`⚠️ พบข้อมูลที่ตกหล่นจำนวน: ${missingHNs.length} รายการ`);
    log("🔄 กำลังเริ่ม Sync ข้อมูลที่หายไป...");

    // 4. ทยอย Sync ทีละ Batch
    const BATCH_SIZE = 100;
    let syncedCount = 0;

    for (let i = 0; i < missingHNs.length; i += BATCH_SIZE) {
      const hnBatch = missingHNs.slice(i, i + BATCH_SIZE);
      
      const placeholdersIn = hnBatch.map(() => '?').join(',');
      
      // ดึงข้อมูลเต็มจาก DB1
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
            const road = row.road || "";
            const moopart = row.moopart || "";
            const ta_full_name = row.ta_full_name || "";
            const address_full = `${addrpart} ถ.${road} ม.${moopart} ${ta_full_name}`.trim();

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

        // Insert ลง DB4
        const placeholdersVal = patients.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
        const insertQuery = `
            INSERT INTO patient (
              hn, pname, fname, lname, citizenship, birthday, addrpart, road, moopart, tmbpart, amppart, chwpart,
              village_id, po_code, address_full, nationality, bloodgrp, informname, cid, death, 
              mobile_phone_number, hometel, worktel, last_update
            ) VALUES ${placeholdersVal}
            ON DUPLICATE KEY UPDATE
              pname=VALUES(pname), fname=VALUES(fname), lname=VALUES(lname), 
              informname=VALUES(informname),
              last_update=VALUES(last_update)`; 

        // ✅ แก้ไข: ใช้ db4Pool (ตัวเล็ก)
        await db4Pool.execute(insertQuery, valuesArray);
        syncedCount += patients.length;
        process.stdout.write(`\r⏳ Sync ไปแล้ว: ${syncedCount} / ${missingHNs.length}`);
      }
    }

    console.log("\n");
    log("✅ เสร็จสิ้นกระบวนการ! Sync ครบถ้วนแล้ว");
    process.exit(0);

  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาด:", err);
    process.exit(1);
  }
}

runMissingSync();