"use client";

import { useRouter } from "next/navigation";
import { FaSignInAlt, FaSpa, FaHistory, FaSignOutAlt } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";
import { AnimatePresence } from "framer-motion";
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
    router.push(user.role === "admin" || user.role === "user" ? "/booking" : "/booking");
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center p-4 sm:p-8 overflow-hidden">
      <BackgroundDecoration />
      {/* แถบเมนูบนสุด */}
      <div className="fixed top-0 left-0 w-full z-50 bg-emerald-600 shadow-md flex flex-wrap sm:flex-nowrap items-center justify-between p-2 gap-2">
        {/* ปุ่มซ้าย (เฉพาะ admin) */}
        {user?.role === "admin" && (
          <button
            onClick={() => router.push("/manage-therapists")}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg bg-white text-emerald-700 font-semibold shadow text-sm sm:text-base transition hover:bg-gray-300"
            title="จัดการบุคลากร"
          >
            🧑‍⚕️
            <span>จัดการบุคลากร</span>
          </button>
        )}

        {/* ปุ่มขวา */}
        <div className="flex gap-1 sm:gap-3 items-center ml-auto flex-wrap">
          {user ? (
            <>
              <button
                onClick={() => {
                  const isAdminLike = user?.role === "admin" || user?.role === "user";
                  router.push(isAdminLike ? "/all-bookings" : "/booking-history");
                }}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg bg-white text-emerald-700 font-semibold shadow text-sm sm:text-base transition hover:bg-gray-300"
                title="ประวัติการจอง"
              >
                <FaHistory className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>ประวัติการจอง</span>
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 bg-red-500 text-white rounded-lg shadow font-semibold text-sm sm:text-base transition hover:bg-red-600"
                title="ลงชื่อออก"
              >
                <FaSignOutAlt className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>ลงชื่อออก</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg bg-white text-emerald-700 font-semibold shadow text-sm sm:text-base transition hover:bg-gray-300"
              title="ลงชื่อเข้า"
            >
              <FaSignInAlt className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>ลงชื่อเข้า</span>
            </button>
          )}
        </div>
      </div>

      {/* หัวข้อ */}
      <h1
        className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-emerald-800 mb-8 sm:mb-12 max-w-xs sm:max-w-3xl text-center drop-shadow-xl z-10 leading-snug"
      >
        ศูนย์บริการสาธารณสุข <br /> เทศบาลเมืองลำพูน
      </h1>

      {/* ปุ่มจอง / ดูคิว */}
      {user ? (
        <button
          onClick={handleBookingClick}
          className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-3 px-6 sm:px-10 py-3 sm:py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-lg sm:text-2xl font-semibold shadow-lg transition z-10 text-center"
          title="จองคิวนวดแผนไทย"
        >
          <FaSpa size={30} />
          <span>จองคิวนวดแผนไทย</span>
        </button>
      ) : (
        <button
          onClick={() => router.push("/booking")}
          className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-3 px-6 sm:px-10 py-3 sm:py-4 bg-gray-500 hover:bg-gray-600 text-white rounded-full text-lg sm:text-2xl font-semibold shadow-lg transition z-10 text-center"
          title="ดูคิวจองนวดแผนไทย"
        >
          <FaSpa size={30} />
          <span>ดูคิวจองนวดแผนไทย</span>
        </button>
      )}

      {/* Alert */}
      <AnimatePresence>
        {showAlert && (
          <div
            className="fixed top-20 left-1/2 -translate-x-1/2 bg-yellow-50 border border-yellow-400 text-yellow-700 px-4 sm:px-6 py-3 sm:py-4 rounded-lg flex items-center gap-2 sm:gap-3 shadow-lg max-w-xs sm:max-w-md z-50"
          >
            <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-sm sm:text-base">กรุณาเข้าสู่ระบบก่อนจองคิวนวด</span>
            <button
              onClick={() => {
                setShowAlert(false);
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                  timeoutRef.current = null;
                }
              }}
              className="ml-auto text-yellow-700 font-bold hover:text-yellow-900 text-lg sm:text-xl"
              aria-label="ปิดข้อความแจ้งเตือน"
            >
              ×
            </button>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
