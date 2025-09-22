"use client";

import { useRouter } from "next/navigation";
import {
  FaSignInAlt,
  FaSpa,
  FaHistory,
  FaSignOutAlt,
} from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import { AlertCircle } from "lucide-react";

function BackgroundDecoration() {
  return (
    <svg
      className="absolute inset-0 w-full h-full -z-10"
      preserveAspectRatio="none"
      viewBox="0 0 1440 900"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
    >
      <rect width="1440" height="900" fill="#E6F4EA" />
      <path
        fill="url(#greenGradient1)"
        d="M0 400 Q360 350 720 400 T1440 400 V900 H0 Z"
        opacity="0.6"
      />
      <path
        fill="url(#greenGradient2)"
        d="M0 600 Q360 550 720 600 T1440 600 V900 H0 Z"
        opacity="0.4"
      />
      <circle cx="300" cy="300" r="180" fill="#A7F3D0" opacity="0.35" />
      <circle cx="1100" cy="200" r="120" fill="#22C55E" opacity="0.25" />
      <circle cx="1000" cy="700" r="220" fill="#4ADE80" opacity="0.15" />
      <circle cx="600" cy="750" r="150" fill="#86EFAC" opacity="0.2" />
      <defs>
        <linearGradient
          id="greenGradient1"
          x1="0"
          y1="350"
          x2="1440"
          y2="450"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#22C55E" />
          <stop offset="1" stopColor="#A7F3D0" />
        </linearGradient>
        <linearGradient
          id="greenGradient2"
          x1="0"
          y1="550"
          x2="1440"
          y2="650"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#16A34A" />
          <stop offset="1" stopColor="#4ADE80" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showAlert, setShowAlert] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleBookingClick = () => {
    if (!user) {
      setShowAlert(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setShowAlert(false);
        timeoutRef.current = null;
      }, 5000);
      return;
    }
    const isAdminLike = user.role === "admin" || user.role === "user";
    router.push(isAdminLike ? "/booking" : "/booking");
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center p-8 overflow-hidden">
      <BackgroundDecoration />
{/* แถบเมนูบนสุด */}
<div className="fixed top-0 left-0 w-full z-50 bg-emerald-600 shadow-md flex items-center justify-between p-2">
  {/* ปุ่มซ้าย (เฉพาะ admin) */}
  {user?.role === "admin" && (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={() => router.push("/manage-therapists")}
    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-emerald-700 font-semibold shadow transition"
    title="จัดการหมอ"
  >
    🧑‍⚕️
    <span>จัดการหมอ</span>
  </motion.button>
  )}

  {/* ปุ่มขวา */}
  <div className="flex gap-3 items-center ml-auto">
    {user ? (
      <>
        <span className="text-white font-semibold text-lg self-center">
          สวัสดี {user.name}!
        </span>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            const isAdminLike = user?.role === "admin" || user?.role === "user";
            router.push(isAdminLike ? "/all-bookings" : "/booking-history");
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-emerald-700 font-semibold shadow transition"
          title="ประวัติการจอง"
        >
          <FaHistory className="w-5 h-5" />
          <span>ประวัติการจอง</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg shadow font-semibold"
          title="ออกจากระบบ"
        >
          <FaSignOutAlt className="w-5 h-5" />
          <span>ออกจากระบบ</span>
        </motion.button>
      </>
    ) : (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.push("/login")}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-emerald-700 font-semibold shadow transition"
        title="เข้าสู่ระบบ"
      >
        <FaSignInAlt className="w-5 h-5" />
        <span>เข้าสู่ระบบ</span>
      </motion.button>
    )}
  </div>
</div>

      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-4xl md:text-6xl font-extrabold text-emerald-800 mb-12 max-w-3xl text-center drop-shadow-xl z-10"
      >
        ศูนย์บริการสาธารณสุข <br /> เทศบาลเมืองลำพูน
      </motion.h1>
      
      {user ? (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleBookingClick}
          className="flex items-center space-x-3 px-10 py-4 bg-emerald-600 text-white rounded-full text-2xl font-semibold shadow-lg transition z-10"
          title="จองคิวนวดแผนไทย"
        >
          <FaSpa size={30} />
          <span>จองคิวนวดแผนไทย</span>
        </motion.button>
      ) : (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push("/booking")}
          className="flex items-center space-x-3 px-10 py-4 bg-gray-500 text-white rounded-full text-2xl font-semibold shadow-lg transition z-10"
          title="ดูคิวจองนวดแผนไทย"
        >
          <FaSpa size={30} />
          <span>ดูคิวจองนวดแผนไทย</span>
        </motion.button>
      )}

      <AnimatePresence>
        {showAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 bg-yellow-50 border border-yellow-400 text-yellow-700 px-6 py-4 rounded-lg flex items-center gap-3 shadow-lg max-w-md z-50"
          >
            <AlertCircle className="w-6 h-6" />
            <span>กรุณาเข้าสู่ระบบก่อนจองคิวนวด</span>
            <button
              onClick={() => {
                setShowAlert(false);
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                  timeoutRef.current = null;
                }
              }}
              className="ml-auto text-yellow-700 font-bold hover:text-yellow-900"
              aria-label="ปิดข้อความแจ้งเตือน"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}