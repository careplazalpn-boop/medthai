import mysql from "mysql2/promise";
import dotenv from "dotenv";

// โหลด config เดียวกับสคริปต์ sync หลัก
dotenv.config({ path: ".env.local" });

// สคริปต์ชั่วคราว (one-off): backfill RequestTransport.PatientLatitude/PatientLongitude
// จาก patient.home_latitude/home_longitude ภายใน DB3 เดียวกัน (ไม่ข้ามฐานข้อมูล)
// จับคู่ด้วย CID + HN พร้อมกันเพื่อความถูกต้อง (ตัด whitespace กันข้อมูลเพี้ยน)
//
// วิธีรัน: node backfill-request-transport-geo.js
// รันครั้งเดียวจบแล้ว process จะ exit เอง ไม่ต้องผูกกับ pm2

async function backfillRequestTransportGeo() {
  const pool = mysql.createPool({
    host: process.env.DB3_HOST,
    user: process.env.DB3_USER,
    password: process.env.DB3_PASSWORD,
    database: process.env.DB3_NAME,
    charset: "TIS620",
    connectionLimit: 3,
    connectTimeout: 20000,
  });

  const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
  const logError = (msg) => console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`);

  try {
    log("=== เริ่ม Backfill RequestTransport.PatientLatitude/PatientLongitude ===");

    // นับจำนวนแถวที่เข้าเงื่อนไขก่อน เพื่อ log ให้เห็นภาพรวมก่อนอัปเดตจริง
    const [[{ candidateCount }]] = await pool.query(
      `SELECT COUNT(*) AS candidateCount
       FROM RequestTransport rt
       INNER JOIN patient p
         ON TRIM(rt.CID) = TRIM(p.cid)
        AND TRIM(rt.PatientHN) = TRIM(p.hn)
       WHERE p.home_latitude IS NOT NULL
         AND p.home_longitude IS NOT NULL
         AND (rt.PatientLatitude IS NULL OR rt.PatientLongitude IS NULL)`
    );

    log(`พบ ${candidateCount} แถวที่เข้าเงื่อนไข (มี patient.home_latitude/longitude แต่ RequestTransport ยังไม่มีพิกัด)`);

    if (candidateCount === 0) {
      log("ไม่มีแถวที่ต้องอัปเดต จบการทำงาน");
      return;
    }

    // อัปเดตจริงในคำสั่งเดียว (JOIN UPDATE) เพราะอยู่ใน DB เดียวกัน ไม่ต้อง loop ทีละแถว
    const [result] = await pool.query(
      `UPDATE RequestTransport rt
       INNER JOIN patient p
         ON TRIM(rt.CID) = TRIM(p.cid)
        AND TRIM(rt.PatientHN) = TRIM(p.hn)
       SET rt.PatientLatitude = p.home_latitude,
           rt.PatientLongitude = p.home_longitude
       WHERE p.home_latitude IS NOT NULL
         AND p.home_longitude IS NOT NULL
         AND (rt.PatientLatitude IS NULL OR rt.PatientLongitude IS NULL)`
    );

    log(`อัปเดตสำเร็จ ${result.affectedRows} แถว`);
    log("=== จบการทำงาน Backfill ===");
  } catch (err) {
    logError(`Backfill ล้มเหลว: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

backfillRequestTransportGeo();
