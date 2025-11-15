import mysql from "mysql2/promise";
import dotenv from "dotenv";
import iconv from "iconv-lite";
import fs from "fs";

dotenv.config({ path: ".env.local" });

// ----------------------
// Logging
// ----------------------
function logPts(message) {
  const time = new Date().toISOString();
  fs.appendFileSync("sync-pts.log", `[${time}] ${message}\n`);
  console.log(`[INFO] ${message}`);
}

function logPtsError(message) {
  const time = new Date().toISOString();
  fs.appendFileSync("sync-pts-error.log", `[${time}] ${message}\n`);
  console.error(`[ERROR] ${message}`);
}

// ----------------------
// TIS620 -> UTF8
// ----------------------
function tis620ToUtf8(input) {
  if (!input) return "";
  try {
    if (Buffer.isBuffer(input)) {
      return iconv.decode(input, "tis620");
    }
    if (typeof input === "string") {
      return iconv.decode(Buffer.from(input, "binary"), "tis620");
    }
    return String(input);
  } catch (e) {
    console.error("decode error:", e, input);
    return String(input);
  }
}

function formatDateToMySQL(input) {
  if (!input) return null; // ให้เป็น NULL ถ้าไม่มีค่า
  let d;

  if (input instanceof Date) {
    d = input;
  } else {
    // ถ้าเป็น string จาก DB1 (decode TIS-620 แล้ว)
    d = new Date(input);
  }

  if (isNaN(d.getTime())) return null; // ถ้าไม่ใช่วัน valid ให้เป็น NULL

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}
// ----------------------
// Main Sync
// ----------------------
async function main() {
  console.log("Running sync-db-pts.js ...");
  logPts("=== Start Sync DB1 → DB3 (patient) ===");

  // DB1 TIS-620
  const db1 = await mysql.createConnection({
    host: process.env.DB1_HOST,
    user: process.env.DB1_USER,
    password: process.env.DB1_PASSWORD,
    database: process.env.DB1_NAME,
    charset: "BINARY", // อ่านเป็น raw binary
  });
  await db1.execute("SET NAMES binary");

  // DB3 UTF-8
  const db3 = await mysql.createConnection({
    host: process.env.DB3_HOST,
    user: process.env.DB3_USER,
    password: process.env.DB3_PASSWORD,
    database: process.env.DB3_NAME,
    charset: "utf8mb4",
  });
  await db3.execute("SET NAMES utf8mb4");

  try {
    // ดึง HN ล่าสุดใน DB3
    const [maxHNRow] = await db3.execute(
      `SELECT MAX(hn) AS max_hn FROM patient WHERE hn NOT LIKE '9999%'`
    );
    const currentMaxHN = maxHNRow[0].max_hn || "0";
    logPts(`Current Max HN in DB3 = ${currentMaxHN}`);

    // ดึงข้อมูลจาก DB1 แบบ raw, ไม่ CONCAT ใน SQL
    const [patients] = await db1.execute(
      `
      SELECT 
        p.hn, p.pname, p.fname, p.lname, p.citizenship, p.birthday,
        p.addrpart, p.road, p.moopart, p.tmbpart, p.amppart, p.chwpart,
        per.village_id, p.po_code, ta.full_name AS ta_full_name, p.nationality,
        p.bloodgrp, p.informname, p.cid, p.death, p.mobile_phone_number, 
        p.hometel, p.worktel, p.last_update
      FROM patient p
      LEFT JOIN person per ON p.cid = per.cid
      LEFT JOIN thaiaddress ta 
        ON p.chwpart = ta.chwpart 
       AND p.tmbpart = ta.tmbpart 
       AND p.amppart = ta.amppart
      WHERE p.hn > ? 
        AND p.hn NOT LIKE '9999%'
      ORDER BY p.hn ASC LIMIT 2000
      `,
      [currentMaxHN]
    );

    logPts(`Found ${patients.length} new rows to sync`);

    // Batch Insert
    const batchSize = 50;
    for (let i = 0; i < patients.length; i += batchSize) {
      const batch = patients.slice(i, i + batchSize);

      const valuesArray = batch.map((row) => {
        // แปลงทุก column TIS-620 -> UTF-8
        Object.keys(row).forEach((k) => {
          row[k] = tis620ToUtf8(row[k]);
        });

        // ทำ CONCAT ใน JavaScript หลัง decode
        const address_full = `${row.addrpart} ถ.${row.road} ม.${row.moopart} ${row.ta_full_name}`.trim();

        return [
          row.hn, row.pname, row.fname, row.lname, row.citizenship, formatDateToMySQL(row.birthday),
          row.addrpart, row.road, row.moopart, row.tmbpart, row.amppart, row.chwpart,
          row.village_id || "", row.po_code, address_full, row.nationality, row.bloodgrp,
          row.informname, row.cid, row.death, row.mobile_phone_number, row.hometel, row.worktel,
          "", // comment
          row.last_update ? formatDateToMySQL(row.last_update) : null
        ];
      });

      try {
        // สร้าง placeholders สำหรับ batch
        const placeholders = valuesArray
          .map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
          .join(",");

        const insertQuery = `
          INSERT INTO patient (
            hn, pname, fname, lname, citizenship, birthday,
            addrpart, road, moopart, tmbpart, amppart, chwpart,
            village_id, po_code, address_full, nationality, bloodgrp,
            informname, cid, death, mobile_phone_number, hometel, worktel, 
            comment, last_update
          )
          VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
            pname=VALUES(pname),
            fname=VALUES(fname),
            lname=VALUES(lname),
            citizenship=VALUES(citizenship),
            birthday=VALUES(birthday),
            addrpart=VALUES(addrpart),
            road=VALUES(road),
            moopart=VALUES(moopart),
            tmbpart=VALUES(tmbpart),
            amppart=VALUES(amppart),
            chwpart=VALUES(chwpart),
            village_id=VALUES(village_id),
            po_code=VALUES(po_code),
            address_full=VALUES(address_full),
            nationality=VALUES(nationality),
            bloodgrp=VALUES(bloodgrp),
            informname=VALUES(informname),
            cid=VALUES(cid),
            death=VALUES(death),
            mobile_phone_number=VALUES(mobile_phone_number),
            hometel=VALUES(hometel),
            worktel=VALUES(worktel),
            comment=VALUES(comment),
            last_update=VALUES(last_update)
        `;

        await db3.execute(insertQuery, valuesArray.flat());
        batch.forEach((r) => logPts(`Synced HN = ${r.hn}`));
      } catch (err) {
        logPtsError(`Error batch insert starting HN ${batch[0].hn}: ${err.message}`);
      }
    }

    logPts("=== Sync Completed ===");
  } catch (err) {
    logPtsError(`General error: ${err.message}`);
  } finally {
    await db1.end();
    await db3.end();
  }
}

// Run
main().catch((err) => logPtsError(`Unexpected error: ${err.message}`));
