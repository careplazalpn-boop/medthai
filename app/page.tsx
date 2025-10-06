"use client";

import { useRouter } from "next/navigation";
import { FaSignInAlt, FaSpa, FaSignOutAlt, FaBars, FaTimes, FaCalendarAlt, FaHistory, FaChartBar, FaUsersCog, FaFacebook, FaHospital } from "react-icons/fa";
import { HiChevronDown, HiChevronUp } from "react-icons/hi";
import { useAuth } from "@/context/AuthContext";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import Image from "next/image";

export default function HomePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showAlert, setShowAlert] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [menuOpen]);

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
    router.push("/booking");
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center p-2 sm:p-8 overflow-hidden">
      {/* Background Image */}
      <Image src="/background.png" alt="พื้นหลัง" fill className="object-cover -z-20" />
      {/* Header */}
      <div className="fixed top-0 left-0 w-full z-50 bg-gradient-to-r from-emerald-600 to-green-500 shadow-md flex justify-between items-center px-2 sm:px-4 py-2 sm:py-2">
        <div className="flex items-center gap-2 sm:gap-13">
          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-white text-xl sm:text-2xl"
            title="เมนู"
          >
            {menuOpen ? <FaTimes /> : <FaBars />}
          </button>

          {/* Logo */}
          <div
            className="ml-3 sm:ml-3 text-white font-bold text-base sm:text-lg flex items-center gap-1 cursor-pointer"
            onClick={() => router.push("/")}
            title="หน้าหลัก"
          >
            <FaSpa className="text-sm sm:text-base" /> แพทย์แผนไทย
          </div>
        </div>

        {/* User Buttons */}
        <div className="flex items-center gap-3 sm:gap-3 text-xs sm:text-sm">
          {user ? (
            <>
              <span className="text-white font-semibold text-xs sm:text-sm">
                สวัสดี {user.name || "ผู้ใช้"}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-2 py-3 sm:px-4 sm:py-3 bg-red-600 text-white rounded-lg shadow font-semibold transition hover:bg-red-700 text-xs sm:text-sm"
                title="ลงชื่อออก"
              >
                <FaSignOutAlt className="w-3 h-3 sm:w-5 sm:h-5" />
                <span>ลงชื่อออก</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="flex items-center gap-1 px-2 py-3 sm:px-4 sm:py-3 rounded-lg bg-white text-emerald-700 font-semibold shadow transition hover:bg-gray-300 text-xs sm:text-sm"
              title="ลงชื่อเข้าใช้"
            >
              <FaSignInAlt className="w-3 h-3 sm:w-5 sm:h-5" />
              <span>สำหรับบุคลากร</span>
            </button>
          )}
        </div>
      </div>
      {/* Hamburger Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 left-0 w-48 sm:w-64 h-full bg-black/70 z-40 flex flex-col pt-15 overflow-y-auto"
          >
            {/* จองคิว */}
            <div
              onClick={user ? handleBookingClick : () => router.push("/booking")}
              className="w-full py-3 sm:py-4 px-4 sm:px-6 border-b-2 border-gray-400 cursor-pointer hover:bg-white/20 flex items-center justify-center gap-2 text-sm sm:text-lg font-semibold text-white"
            >
              <FaCalendarAlt /> {user ? "จองคิวนวดแผนไทย" : "ดูคิวจองนวดแผนไทย"}
            </div>

            {user && (
              <>
                <div
                  onClick={() => router.push("/all-bookings")}
                  className="w-full py-3 sm:py-4 px-4 sm:px-6 border-b-2 border-gray-400 cursor-pointer hover:bg-white/20 flex items-center justify-center gap-2 text-sm sm:text-lg font-semibold text-white"
                >
                  <FaHistory /> ประวัติการจอง
                </div>
                <div
                  onClick={() => router.push("/summary-history")}
                  className="w-full py-3 sm:py-4 px-4 sm:px-6 border-b-2 border-gray-400 cursor-pointer hover:bg-white/20 flex items-center justify-center gap-2 text-sm sm:text-lg font-semibold text-white"
                >
                  <FaChartBar /> สรุปประวัติ
                </div>
                {user.role === "admin" && (
                  <button
                    onClick={() => router.push("/manage-therapists")}
                    className="w-full py-3 sm:py-4 px-4 sm:px-6 border-b-2 border-gray-400 cursor-pointer hover:bg-white/20 flex items-center justify-center gap-2 text-sm sm:text-lg font-semibold text-white"
                    title="จัดการบุคลากร"
                  >
                    <FaUsersCog /> จัดการบุคลากร
                  </button>
                )}
              </>
            )}

            {/* ช่องทางติดต่อ */}
            <div className="w-full border-b-2 border-gray-400 relative">
              <div
                onClick={() => setContactOpen(!contactOpen)}
                className="w-full py-3 sm:py-4 px-4 sm:px-6 cursor-pointer hover:bg-white/20 text-sm sm:text-lg font-semibold text-white text-center relative"
              >
                <span>ช่องทางอื่น</span>
                <span className="absolute right-4 top-1/2 -translate-y-1/2">
                  {contactOpen ? <HiChevronUp className="w-5 h-5" /> : <HiChevronDown className="w-5 h-5" />}
                </span>
              </div>
              {contactOpen && (
                <div className="flex flex-col bg-black/50 text-white text-sm sm:text-base">
                  <a
                    href="https://www.facebook.com/profile.php?id=100070719421986"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-6 hover:bg-white/20 flex items-center justify-center gap-2"
                  >
                    <FaFacebook className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Facebook</span>
                  </a>
                  <a
                    href="https://www.lmwcc.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-6 hover:bg-white/20 flex items-center justify-center gap-2"
                  >
                    <FaHospital className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>เพจหลักศูนย์บริการ</span>
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Title */}
      <h1 className="absolute top-25 text-xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white text-center drop-shadow-[0_0_5px_black] z-10 leading-snug max-w-full">
        คลินิกแพทย์แผนไทยประยุกต์<br />
        ศูนย์บริการสาธารณสุข เทศบาลเมืองลำพูน
      </h1>

      {/* Alert */}
      <AnimatePresence>
        {showAlert && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-yellow-50 border border-yellow-400 text-yellow-700 px-4 sm:px-6 py-2 sm:py-4 rounded-lg flex items-center gap-2 sm:gap-3 shadow-lg max-w-xs sm:max-w-md z-50">
            <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs sm:text-base">กรุณาเข้าสู่ระบบก่อนจองคิวนวด</span>
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

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 w-full bg-gray-200 shadow-md border-t border-gray-200 px-2 sm:px-8 py-2 sm:py-4 z-50 text-[12px] sm:text-base">
        <div className="flex items-center justify-center gap-2 sm:gap-4 relative">
          {/* Logo ชิดซ้าย */}
          <div className="absolute left-2 sm:left-4 flex-shrink-0">
            <Image src="/logo.png" alt="โลโก้เทศบาล" width={50} height={50} className="sm:w-[110px] sm:h-[110px]" />
          </div>

          {/* ข้อความกลาง อยู่ตรงกลาง */}
          <p className="text-center text-black text-sm sm:text-base leading-snug mx-auto">
            🏥 คลินิกแพทย์แผนไทยประยุกต์ — ศูนย์บริการสาธารณสุข เทศบาลเมืองลำพูน<br />
            🌿 บริการ: นวดประคบสมุนไพร • อบไอน้ำสมุนไพร • ดูแลมารดาหลังคลอด<br />
            ⏰ เวลาเปิดบริการ: จันทร์ - ศุกร์ 08:00 - 18:00 น. | เสาร์ 08:00 - 16:00 น.<br />
            📞 ติดต่อ: 053-525776 ต่อ 320, 094-6422111
          </p>
        </div>
      </footer>
    </div>
  );
}
