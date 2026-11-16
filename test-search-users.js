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
  console.log("  message  :", e?.sqlMessage || e?.message);
};

const showSession = async (conn, label) => {
  const [r] = await conn.query(
    "SELECT @@character_set_client AS cs_client, @@character_set_connection AS cs_conn, @@character_set_results AS cs_res, @@collation_connection AS coll_conn"
  );
  console.log(`  [${label}]`, r[0]);
};

const LIKE_SQL = (expr) => `SELECT COUNT(*) AS c FROM med_user WHERE ${expr} LIKE '%สมชาย%' LIMIT 1`;

(async () => {
  // 1) connect + ดู session collation จริง
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query("SELECT 1 AS ok, @@version AS ver");
    console.log("✅ Connected:", rows[0]);
    await showSession(conn, "after connect (charset=TIS620)");
  } catch (e) {
    showErr("connect", e);
    process.exit(1);
  }

  // 2) collation id 18 ในมุมมอง server คืออะไร + มี tis620 ไหม
  try {
    const [c] = await conn.query(
      "SELECT Id, Collation_name, Character_set_name FROM information_schema.COLLATIONS WHERE Id = 18 OR Collation_name LIKE '%tis620%'"
    );
    console.log("\nCollation id=18 / tis620:", JSON.stringify(c));
  } catch (e) { showErr("collation-check", e); }

  // 3) LIKE แบบเดิม (น่าจะ error 1267)
  try {
    await conn.query(LIKE_SQL("CONCAT(pname, fname, ' ', lname)"));
    console.log("\n✅ LIKE ตรง ๆ ผ่าน");
  } catch (e) { showErr("like-direct", e); }

  // 4) SET NAMES tis620 แล้วลองใหม่ (connection เดียวกัน)
  try {
    await conn.query("SET NAMES tis620");
    await showSession(conn, "after SET NAMES tis620");
    await conn.query(LIKE_SQL("CONCAT(pname, fname, ' ', lname)"));
    console.log("✅ LIKE หลัง SET NAMES tis620 ผ่าน");
  } catch (e) { showErr("like-after-set-names", e); }

  // 5) CONVERT column side เป็น utf8mb4 (ไม่ต้องพึ่ง connection charset)
  try {
    await conn.query("SET NAMES utf8mb4");
    await showSession(conn, "after SET NAMES utf8mb4");
    const [r] = await conn.query(
      `SELECT COUNT(*) AS c FROM med_user
       WHERE CONVERT(CONCAT(pname, fname, ' ', lname) USING utf8mb4) COLLATE utf8mb4_general_ci LIKE '%สมชาย%'`
    );
    console.log("✅ LIKE แบบ CONVERT+COLLATE ผ่าน:", r[0]);
  } catch (e) { showErr("like-convert-collate", e); }

  // 6) CONVERT โดยไม่ใส่ COLLATE
  try {
    const [r] = await conn.query(
      `SELECT COUNT(*) AS c FROM med_user
       WHERE CONVERT(CONCAT(pname, fname, ' ', lname) USING utf8mb4) LIKE '%สมชาย%'`
    );
    console.log("✅ LIKE CONVERT (no collate) ผ่าน:", r[0]);
  } catch (e) { showErr("like-convert-nocollate", e); }

  conn.release();
  await pool.end();
})().catch(e => { showErr("fatal", e); process.exit(1); });
