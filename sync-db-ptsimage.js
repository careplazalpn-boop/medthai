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
  fs.appendFileSync("sync-db-ptsimage.log", `[${time}] ${message}\n`);
}

function logPtsError(message) {
  const time = new Date().toISOString();
  fs.appendFileSync("sync-db-ptsimage-error.log", `[${time}] ${message}\n`);
}

// ----------------------
// TIS620 -> UTF8
// ----------------------
function tis620ToUtf8(input) {
  if (!input) return "";
  try {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "binary");
    return iconv.decode(buf, "tis620");
  } catch {
    return input.toString();
  }
}

// ----------------------
// Main Sync
// ----------------------
async function main() {
  console.log("Running sync-db-ptsimage.js ...");
  logPts("=== Start Sync DB1 → DB3 (patient_image) ===");

  // DB1 TIS620
  const db1 = await mysql.createConnection({
    host: process.env.DB1_HOST,
    user: process.env.DB1_USER,
    password: process.env.DB1_PASSWORD,
    database: process.env.DB1_NAME,
    charset: "BINARY", // อ่านเป็น raw binary
  });
  await db1.execute("SET NAMES binary");

  // DB3 UTF8
  const db3 = await mysql.createConnection({
    host: process.env.DB3_HOST,
    user: process.env.DB3_USER,
    password: process.env.DB3_PASSWORD,
    database: process.env.DB3_NAME,
    charset: "utf8mb4",
  });
  await db3.execute("SET NAMES utf8mb4");

  try {
    // ดึง HN+Image ล่าสุด
    const [maxRow] = await db3.execute(
      `SELECT hn, image_name FROM patient_image ORDER BY hn DESC, image_name DESC LIMIT 1`
    );
    const lastHN = maxRow[0]?.hn || "0";
    const lastImageName = maxRow[0]?.image_name || "";

    logPts(`Last synced: HN=${lastHN}, image_name=${lastImageName}`);

    // ดึงข้อมูลใหม่จาก DB1
    const [images] = await db1.execute(
      `SELECT hn, image_name, image, width, height, capture_date, hos_guid, hos_guid_ext
       FROM patient_image
       WHERE (hn > ? OR (hn = ? AND image_name > ?))
       ORDER BY hn ASC, image_name ASC`,
      [lastHN, lastHN, lastImageName]
    );

    logPts(`Found ${images.length} new images to sync`);

    const batchSize = 50;
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);

      const valuesArray = batch.map((row) => {
        return [
          tis620ToUtf8(row.hn),
          tis620ToUtf8(row.image_name),
          row.image,           // BLOB
          row.width || null,
          row.height || null,
          row.capture_date || null,
          tis620ToUtf8(row.hos_guid),
          tis620ToUtf8(row.hos_guid_ext),
        ];
      });

      try {
        const placeholders = valuesArray
          .map(() => "(?,?,?,?,?,?,?,?)")
          .join(",");

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
            hos_guid_ext=VALUES(hos_guid_ext)
        `;

        await db3.execute(insertQuery, valuesArray.flat());
        batch.forEach((r) => logPts(`Synced HN=${r.hn}, image_name=${r.image_name}`));
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
