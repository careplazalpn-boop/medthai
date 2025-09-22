"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { FaUser, FaLock, FaArrowLeft } from "react-icons/fa";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
      } else {
        login(data.user);
        router.push("/");
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-white to-emerald-100 px-4 sm:px-6 relative">
      {/* กล่องฟอร์ม */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm sm:max-w-md p-6 sm:p-10 relative z-10"
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-6 sm:mb-8 text-center text-emerald-700 drop-shadow-sm">
          เข้าสู่ระบบ
        </h2>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-600 mb-4 sm:mb-6 text-center font-medium text-sm sm:text-base select-none"
          >
            {error}
          </motion.p>
        )}

        <motion.div
          whileFocus={{ scale: 1.02 }}
          className="mb-4 sm:mb-6 relative flex items-center border border-emerald-300 rounded-xl focus-within:ring-2 focus-within:ring-emerald-400 transition"
        >
          <FaUser className="absolute left-3 sm:left-4 text-emerald-500" />
          <input
            type="text"
            placeholder="ชื่อผู้ใช้"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 sm:p-4 pl-10 sm:pl-12 rounded-xl focus:outline-none text-gray-800 text-sm sm:text-base"
            required
            autoComplete="username"
          />
        </motion.div>

        <motion.div
          whileFocus={{ scale: 1.02 }}
          className="mb-6 sm:mb-8 relative flex items-center border border-emerald-300 rounded-xl focus-within:ring-2 focus-within:ring-emerald-400 transition"
        >
          <FaLock className="absolute left-3 sm:left-4 text-emerald-500" />
          <input
            type="password"
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 sm:p-4 pl-10 sm:pl-12 rounded-xl focus:outline-none text-gray-800 text-sm sm:text-base"
            required
            autoComplete="current-password"
          />
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          type="submit"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 sm:py-4 rounded-xl shadow-lg text-sm sm:text-base transition"
        >
          เข้าสู่ระบบ
        </motion.button>

        {/* ปุ่มกลับหน้าแรก */}
        <motion.button
          type="button"
          onClick={() => router.push("/")}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="mt-4 sm:mt-6 w-full flex justify-center items-center space-x-2 border border-emerald-600 text-emerald-600 font-semibold py-2.5 sm:py-3 rounded-xl hover:bg-emerald-100 text-sm sm:text-base transition"
        >
          <FaArrowLeft />
          <span>กลับสู่หน้าหลัก</span>
        </motion.button>
      </motion.form>

      {/* แสงเงาพื้นหลัง */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.15 }}
        transition={{ duration: 2 }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#34d399,_transparent_70%)] pointer-events-none"
      />
    </div>
  );
}
