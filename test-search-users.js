// ทดสอบการเชื่อมต่อ DB + query ค้นหาคนไข้ แบบเดียวกับ /api/search-users
// รันบน server: node test-search-users.js
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: ".env.local" });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: "TIS620",
  waitForConnections: true,
  connectionLimit: 5,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 20000,
});

const showErr = (label, e) => {
  console.log(`\n❌ [${label}]`);
  console.log("  code     :", e?.code);
  console.log("  errno    :", e?.errno);
  console.log("  sqlState :", e?.sqlState);
  console.log("  message  :", e?.sqlMessage || e?.message);
  if (e?.sql) console.log("  sql      :", e.sql.slice(0, 300));
};

(async () => {
  // 1) ทดสอบ connect
  try {
    const [rows] = await pool.query("SELECT 1 AS ok, @@version AS ver, @@character_set_database AS db_charset");
    console.log("✅ Connected:", rows[0]);
  } catch (e) {
    showErr("connect", e);
    process.exit(1);
  }

  // 2) เช็ค collation ของแต่ละตาราง
  try {
    const [cols] = await pool.query(`
      SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('med_user','new_user')
        AND COLLATION_NAME IS NOT NULL
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `, [process.env.DB_NAME]);
    const byTable = {};
    cols.forEach(c => { (byTable[c.TABLE_NAME] ||= []).push(`${c.COLUMN_NAME}:${c.COLLATION_NAME}`); });
    console.log("\nCollations:");
    Object.entries(byTable).forEach(([t, cs]) => console.log(`  ${t}: ${[...new Set(cs)].join(", ")}`));
  } catch (e) {
    showErr("collation-check", e);
  }

  // 3) จำลอง query เดิม (UNION) — ถ้า error 1267 = ต้นเหตุ
  try {
    const [r] = await pool.query(`
      SELECT hn, CONCAT(pname, fname, ' ', lname) AS name, NULL AS id_card_number, mobile_phone_number AS phone
      FROM med_user WHERE CONCAT(pname, fname, ' ', lname) LIKE '%สมชาย%' LIMIT 100
      UNION ALL
      SELECT NULL AS hn, name, id_card_number, mobile_phone_number AS phone
      FROM new_user WHERE name LIKE '%สมชาย%' LIMIT 100
    `);
    console.log(`\n✅ UNION query OK — ${r.length} rows`);
  } catch (e) {
    showErr("union-query", e);
  }

  // 4) query แยก (แบบที่แก้ใหม่)
  try {
    const [r1] = await pool.query(
      `SELECT hn, CONCAT(pname, fname, ' ', lname) AS name, NULL AS id_card_number, mobile_phone_number AS phone
       FROM med_user WHERE CONCAT(pname, fname, ' ', lname) LIKE '%สมชาย%' LIMIT 100`
    );
    const [r2] = await pool.query(
      `SELECT NULL AS hn, name, id_card_number, mobile_phone_number AS phone
       FROM new_user WHERE name LIKE '%สมชาย%' LIMIT 100`
    );
    console.log(`\n✅ Split queries OK — med_user: ${r1.length}, new_user: ${r2.length}`);
  } catch (e) {
    showErr("split-query", e);
  }

  // 5) HN search
  try {
    const [r] = await pool.query(
      `SELECT hn, CONCAT(pname, fname, ' ', lname) AS name, NULL AS id_card_number, mobile_phone_number AS phone
       FROM med_user WHERE hn = 'TESTHN123' LIMIT 100`
    );
    console.log(`\n✅ HN query OK — ${r.length} rows`);
  } catch (e) {
    showErr("hn-query", e);
  }

  await pool.end();
})().catch(e => { showErr("fatal", e); process.exit(1); });
