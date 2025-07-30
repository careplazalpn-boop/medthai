"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaUser, FaEnvelope, FaPhone, FaLock, FaArrowLeft } from "react-icons/fa";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        body: JSON.stringify({ name, phone, email, password }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
      } else {
        setSuccess("สมัครสมาชิกสำเร็จ! กำลังนำไปยังหน้าล็อกอิน...");
        setTimeout(() => {
          router.push("/login");
        }, 2500);
      }
    } catch (err) {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-white to-emerald-100 px-4">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-10"
      >
        <h2 className="text-3xl font-extrabold mb-8 text-center text-emerald-700 drop-shadow-sm">
          สมัครสมาชิก
        </h2>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-600 mb-4 text-center font-medium"
          >
            {error}
          </motion.p>
        )}

        {success && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-green-600 mb-4 text-center font-medium"
          >
            {success}
          </motion.p>
        )}

        {/* ชื่อ-นามสกุล */}
        <motion.div whileFocus={{ scale: 1.05 }} className="mb-4">
          <div className="flex items-center border border-emerald-300 rounded-xl p-3">
            <FaUser className="text-emerald-600 mr-3" />
            <input
              type="text"
              placeholder="ชื่อ - นามสกุล"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-none focus:outline-none placeholder-gray-400 text-gray-800"
              required
            />
          </div>
        </motion.div>

        {/* เบอร์โทร */}
        <motion.div whileFocus={{ scale: 1.05 }} className="mb-4">
          <div className="flex items-center border border-emerald-300 rounded-xl p-3">
            <FaPhone className="text-emerald-600 mr-3" />
            <input
              type="tel"
              placeholder="เบอร์โทรศัพท์"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border-none focus:outline-none placeholder-gray-400 text-gray-800"
              required
            />
          </div>
        </motion.div>

        {/* อีเมล */}
        <motion.div whileFocus={{ scale: 1.05 }} className="mb-4">
          <div className="flex items-center border border-emerald-300 rounded-xl p-3">
            <FaEnvelope className="text-emerald-600 mr-3" />
            <input
              type="email"
              placeholder="อีเมล"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-none focus:outline-none placeholder-gray-400 text-gray-800"
              required
            />
          </div>
        </motion.div>

        {/* รหัสผ่าน */}
        <motion.div whileFocus={{ scale: 1.05 }} className="mb-6">
          <div className="flex items-center border border-emerald-300 rounded-xl p-3">
            <FaLock className="text-emerald-600 mr-3" />
            <input
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-none focus:outline-none placeholder-gray-400 text-gray-800"
              required
            />
          </div>
        </motion.div>

        {/* ปุ่มสมัคร */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="submit"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg transition mb-3"
        >
          สมัครสมาชิก
        </motion.button>

        {/* ปุ่มกลับหน้าหลัก */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => router.push("/")}
          className="w-full border border-emerald-600 text-emerald-700 font-semibold py-3 rounded-xl hover:bg-emerald-50 transition flex items-center justify-center gap-2"
        >
          <FaArrowLeft />
          กลับสู่หน้าหลัก
        </motion.button>
      </motion.form>
    </div>
  );
}