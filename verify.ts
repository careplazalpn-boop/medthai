import bcrypt from "bcryptjs";

const hashFromDB = "<<<นำ hash ที่อยู่ในฐานข้อมูลมาวางตรงนี้>>>";
const inputPassword = "admin1234";

bcrypt.compare(inputPassword, hashFromDB).then((result) => {
  console.log("รหัสผ่านตรงกันหรือไม่:", result);
});
