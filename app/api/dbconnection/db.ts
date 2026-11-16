import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // ✅ charset: utf8mb4 — server CentOS (MariaDB 12.3) ไม่ยอมรับ collation id 18 (tis620)
  //    ใน handshake แล้ว fallback เป็น utf8mb4_uca1400_ai_ci เสมอ → ถ้าตั้ง TIS620
  //    client จะ encode ภาษาไทยเป็น tis620 แต่ server อ่านเป็น utf8mb4 → ตัวอักษรเพี้ยน
  //    คอลัมน์ที่เป็น tis620_thai_ci (med_user/new_user) ถูก CONVERT เป็น utf8mb4 ตอน query
  charset: 'UTF8MB4_GENERAL_CI',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // ✅ keepAlive: ป้องกัน connection ถูก firewall/LB ตัดตอน idle → ลด ECONNRESET
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

export default pool;