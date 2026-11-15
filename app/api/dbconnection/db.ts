import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // ✅ charset: บังคับ tis620 — server CentOS (MariaDB 12.3) default เป็น tis620
  //    และไม่มี utf8mb4_general_ci → utf8mb4_general_ci ถูก fallback กลับ tis620 เงียบ ๆ
  //    ทำให้ภาษาไทยที่ส่งเป็น utf8 ถูกตีความผิดจนค้นหา med_user ไม่เจอ
  //    (PC ใช้ได้เพราะ MySQL default เป็น utf8mb4) — ตรงกับ sync scripts ที่ใช้ TIS620
  charset: 'TIS620',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // ✅ keepAlive: ป้องกัน connection ถูก firewall/LB ตัดตอน idle → ลด ECONNRESET
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

export default pool;