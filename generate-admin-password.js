import bcrypt from "bcryptjs";

const plainPassword = "";

bcrypt.hash(plainPassword, 10).then((hash) => {
  console.log("รหัสผ่านที่ถูกเข้ารหัสแล้ว:", hash);
});