import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import cron from "node-cron";

dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logPath = join(__dirname, "sync.log");

// 🔹 ฟังก์ชันบันทึก log
const log = (msg) => {
  const t = new Date().toISOString();
  fs.appendFileSync(logPath, `[${t}] ${msg}\n`);
  console.log(msg);
};

// 🔹 เชื่อมต่อฐานข้อมูล
const db1 = await mysql.createConnection({
  host: process.env.DB1_HOST,
  user: process.env.DB1_USER,
  password: process.env.DB1_PASSWORD,
  database: process.env.DB1_NAME,
});

const db2 = await mysql.createConnection({
  host: process.env.DB2_HOST,
  user: process.env.DB2_USER,
  password: process.env.DB2_PASSWORD,
  database: process.env.DB2_NAME,
});

log("✅ Connected to both databases");

// 🔹 อ่านค่า HN สูงสุดจาก med_user (เป็น VARCHAR → แปลงเป็นตัวเลข)
async function getLastHN() {
    const [rows] = await db2.query(
  "SELECT MAX(CAST(hn AS UNSIGNED)) AS lastHN FROM med_user WHERE hn NOT LIKE '999%'"
);
const lastHN = rows[0]?.lastHN || 0;
log(`🧮 HN ล่าสุดใน med_user (ไม่รวม test) = ${lastHN}`);

}

// 🔹 Sync ข้อมูลเฉพาะ HN ใหม่กว่า
async function syncPatients() {
  const lastHN = await getLastHN();

  // ดึงเฉพาะ HN ที่มากกว่า lastHN (แปลงเป็นตัวเลขก่อนเปรียบเทียบ)
  const [patients] = await db1.query(
    `SELECT hn, pname, fname, lname, deathday, hometel, informname, worktel, last_update, death, mobile_phone_number
     FROM patient
     WHERE CAST(hn AS UNSIGNED) > ?
       AND hn NOT LIKE '999%'       -- ❌ ละเว้น HN ทดสอบที่ขึ้นต้นด้วย 999
     ORDER BY CAST(hn AS UNSIGNED) ASC`,
    [lastHN]
  );

  
  if (patients.length === 0) {
    log("✅ ไม่มีข้อมูลใหม่");
    return;
  }

  log(`พบข้อมูลใหม่ ${patients.length} รายการ (ตั้งแต่ HN > ${lastHN})`);

  // loop insert ข้อมูลใหม่
  for (const p of patients) {
    const name = `${p.pname}${p.fname} ${p.lname}`;
    await db2.query(
      `INSERT INTO med_user
        (hn, name, pname, fname, lname, deathday, hometel, informname, worktel, last_update, death, mobile_phone_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        name=VALUES(name),
        pname=VALUES(pname),
        fname=VALUES(fname),
        lname=VALUES(lname),
        deathday=VALUES(deathday),
        hometel=VALUES(hometel),
        informname=VALUES(informname),
        worktel=VALUES(worktel),
        last_update=VALUES(last_update),
        death=VALUES(death),
        mobile_phone_number=VALUES(mobile_phone_number)
      `,
      [
        p.hn,
        name,
        p.pname,
        p.fname,
        p.lname,
        p.deathday,
        p.hometel,
        p.informname,
        p.worktel,
        p.last_update,
        p.death,
        p.mobile_phone_number,
      ]
    );
  }

  log(`✅ Sync ข้อมูลใหม่เรียบร้อย (${patients.length} รายการ)`);
}

// 🔹 รันทันที 1 รอบ
await syncPatients();

// 🔹 ตั้งเวลาให้รันอัตโนมัติทุก 30 นาที
cron.schedule("*/30 * * * *", syncPatients);

// 🔹 ปิดการเชื่อมต่อเมื่อหยุด script
process.on("exit", () => {
  db1.end();
  db2.end();
  log("🔒 ปิดการเชื่อมต่อเรียบร้อย");
});
