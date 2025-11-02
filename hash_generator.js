import bcrypt from 'bcrypt'; // <--- เปลี่ยนตรงนี้
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// เนื่องจากเราใช้ import/export, เราต้องใช้ฟังก์ชันหลัก (main function)
async function generateHash() {
    const plaintextPassword = '7Xkmbi'; // <--- เปลี่ยนรหัสผ่านตรงนี้
    const saltRounds = 10; // ใช้ค่าเดียวกับที่ระบบ Login ของคุณใช้

    try {
        const hash = await bcrypt.hash(plaintextPassword, saltRounds);

        console.log("----------------------------------------------------------------------------------------------------------------------------------");
        console.log("Plaintext Password (รหัสผ่านเดิม):", plaintextPassword);
        console.log("BCRYPT HASH (รหัสผ่านเข้ารหัส):");
        console.log(hash); // นี่คือ Hash ที่ต้องใช้ในคำสั่ง SQL
        console.log("----------------------------------------------------------------------------------------------------------------------------------");
    } catch (err) {
        console.error("Error generating hash:", err);
    }
}

generateHash();