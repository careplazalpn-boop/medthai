import bcrypt from "bcryptjs";

const plainPassword = "admin1234";

bcrypt.hash(plainPassword, 10).then((hash) => {
  console.log("รหัสผ่านที่ถูกเข้ารหัสแล้ว:", hash);
});
