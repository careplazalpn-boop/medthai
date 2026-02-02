import mysql from "mysql2/promise";
import dotenv from "dotenv";

// โหลด config
dotenv.config({ path: ".env.local" });

// 🔹 Config Pools
// หมายเหตุ: รูปภาพมีขนาดใหญ่ ควรเพิ่ม timeout และ allowed packet ถ้าจำเป็น
const db1Pool = mysql.createPool({
  host: process.env.DB1_HOST,
  user: process.env.DB1_USER,
  password: process.env.DB1_PASSWORD,
  database: process.env.DB1_NAME,
  charset: "TIS620", // อ่านไทยถูกต้องอัตโนมัติ
  connectionLimit: 5,
  connectTimeout: 60000, // เพิ่มเวลา connect
  enableKeepAlive: true
});

// 🔹 Config DB4 (ปลายทาง)
const db4Pool = mysql.createPool({
  host: process.env.DB4_HOST,
  user: process.env.DB4_USER,
  password: process.env.DB4_PASSWORD,
  database: process.env.DB4_NAME,
  charset: "TIS620",
  connectionLimit: 5,
  connectTimeout: 60000,
  enableKeepAlive: true
});

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// Helper: Format วันที่
function formatDateTimeToMySQL(input) {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
}

async function runImageSync() {
  try {
    log("🚀 เริ่มต้นกระบวนการตรวจสอบรูปภาพ (patient_image) ที่ตกหล่น...");

    // 1. ดึง Key (HN + ImageName) ทั้งหมดจากต้นทาง
    log("📥 กำลังดึง Keys ทั้งหมดจาก DB1 (Source)...");
    const [rows1] = await db1Pool.execute("SELECT hn, image_name FROM patient_image");
    // สร้าง Set ของ "hn|image_name" เพื่อใช้เปรียบเทียบ
    const set1 = new Set(rows1.map(r => `${r.hn}|${r.image_name}`));
    log(`✅ DB1 มีรูปภาพจำนวน: ${rows1.length} รูป`);

    // 2. ดึง Key ทั้งหมดจากปลายทาง
    log("📥 กำลังดึง Keys ทั้งหมดจาก DB4 (Destination)...");
    const [rows4] = await db4Pool.execute("SELECT hn, image_name FROM patient_image");
    const set4 = new Set(rows4.map(r => `${r.hn}|${r.image_name}`));
    log(`✅ DB4 มีรูปภาพจำนวน: ${rows4.length} รูป`);

    // 3. หาภาพที่หายไป (Diff)
    // แปลง Set กลับมาเป็น Array ของ string "hn|image_name"
    const missingKeys = [...set1].filter(key => !set4.has(key));

    if (missingKeys.length === 0) {
      log("🎉 เยี่ยมมาก! รูปภาพครบถ้วนตรงกันแล้ว ไม่ต้อง Sync เพิ่ม");
      process.exit(0);
    }

    log(`⚠️ พบรูปภาพที่ตกหล่นจำนวน: ${missingKeys.length} รูป`);
    log("🔄 กำลังเริ่ม Sync รูปภาพที่หายไป...");

    // 4. ทยอย Sync ทีละ Batch
    // ⚠️ สำคัญ: รูปภาพมีขนาดใหญ่ (BLOB) ต้องใช้ Batch Size เล็กๆ (เช่น 10-20)
    const BATCH_SIZE = 10;
    let syncedCount = 0;

    for (let i = 0; i < missingKeys.length; i += BATCH_SIZE) {
      const batchKeys = missingKeys.slice(i, i + BATCH_SIZE);
      
      // แปลง key กลับเป็น object {hn, image_name} เพื่อเอาไป Query
      const keyObjects = batchKeys.map(k => {
        const [hn, imgName] = k.split('|');
        return { hn, image_name: imgName };
      });

      // สร้างเงื่อนไข WHERE (hn, image_name) IN ((A,B), (C,D))
      // MySQL รองรับ Row Constructor Comparison
      const placeholders = keyObjects.map(() => "(?,?)").join(",");
      const queryParams = keyObjects.flatMap(k => [k.hn, k.image_name]);

      // ดึงข้อมูลรูปภาพเต็ม (BLOB) จาก DB1
      const [images] = await db1Pool.execute(
        `SELECT hn, image_name, image, width, height, capture_date, hos_guid, hos_guid_ext
         FROM patient_image
         WHERE (hn, image_name) IN (${placeholders})`,
        queryParams
      );

      if (images.length > 0) {
        const valuesArray = [];
        for (const row of images) {
          valuesArray.push(
            row.hn,
            row.image_name,
            row.image, // BLOB
            row.width || null,
            row.height || null,
            formatDateTimeToMySQL(row.capture_date),
            row.hos_guid || null,
            row.hos_guid_ext || null
          );
        }

        // Insert ลง DB4
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
            hos_guid_ext=VALUES(hos_guid_ext)
        `;

        await db4Pool.execute(insertQuery, valuesArray);
        
        syncedCount += images.length;
        process.stdout.write(`\r⏳ Sync รูปภาพไปแล้ว: ${syncedCount} / ${missingKeys.length}`);
      }
    }

    console.log("\n");
    log("✅ เสร็จสิ้นกระบวนการ! Sync รูปภาพครบถ้วนแล้ว");
    process.exit(0);

  } catch (err) {
    console.error("\n❌ เกิดข้อผิดพลาด:", err);
    process.exit(1);
  }
}

// เริ่มทำงานทันที
runImageSync();