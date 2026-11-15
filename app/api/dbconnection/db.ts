import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // ✅ charset: บังคับ connection เป็น utf8mb4 — server CentOS default เป็น tis620
  //    ทำให้ภาษาไทยที่ส่งเป็น utf8 ถูกตีความผิดจนค้นหา med_user ไม่เจอ
  charset: 'UTF8MB4_GENERAL_CI',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // ✅ keepAlive: ป้องกัน connection ถูก firewall/LB ตัดตอน idle → ลด ECONNRESET
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

export default pool;