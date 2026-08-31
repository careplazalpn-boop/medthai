"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import {
  Sparkles,
  X,
  Menu,
  LogOut,
  LogIn,
  Calendar,
  History,
  BarChart3,
  Users,
  Facebook,
  Building2,
  BedDouble,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Search,
} from "lucide-react";

/**
 * เมนู Hamburger กลางของระบบ — ใช้ร่วมกันได้ทุกหน้า
 *
 * แนะนำให้วางไว้ใน app/layout.tsx ครั้งเดียว (ภายใน <AuthProvider> เสมอ
 * เพราะ component นี้เรียก useAuth() ข้างใน) แล้วทุกหน้าจะมีเมนูให้อัตโนมัติ
 * โดยไม่ต้อง import ซ้ำในแต่ละ page.tsx อีก
 *
 * ถ้าจะแก้/เพิ่ม/ลบเมนู แก้ที่ไฟล์นี้ไฟล์เดียว ทุกหน้าเห็นผลพร้อมกันทันที
 *
 * @param rightSlot  ปุ่ม/element เสริมที่ต้องการแสดงในแถบเมนูบนสุด ก่อนปุ่ม login/logout
 *                    (เช่นปุ่ม "HN ?" ที่เป็นของเฉพาะหน้า booking ไม่ต้องยกเข้ามาไว้ในนี้)
 */
interface HamburgerMenuProps {
  rightSlot?: ReactNode;
}

export default function HamburgerMenu({ rightSlot }: HamburgerMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === "admin";

  // เช็คว่าเมนูนี้ตรงกับหน้าที่กำลังแสดงอยู่หรือไม่ (ไฮไลต์ตามหน้าจริง แทนการ hardcode)
  const isActive = (path: string) => pathname === path;

  // ปิดเมนูเมื่อคลิกนอกพื้นที่ หรือกด Esc
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

  const handleLogout = async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* แถบเมนูบนสุด */}
      <div className="fixed top-0 left-0 w-full z-50 bg-gray-700 shadow-md flex justify-between items-center px-2 sm:px-4 py-2 sm:py-2">
        <div className="flex items-center gap-2 sm:gap-13">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-white text-xl sm:text-2xl cursor-pointer"
            title="เมนู"
          >
            {menuOpen ? <X /> : <Menu />}
          </button>

          <div
            className="ml-3 sm:ml-3 text-white font-bold text-base sm:text-lg flex items-center gap-1 cursor-pointer"
            onClick={() => router.push("/")}
            title="หน้าหลัก"
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" /> แพทย์แผนไทย
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3 flex-wrap sm:flex-nowrap items-center">
          {/* จุดแทรกปุ่มเสริมเฉพาะหน้า เช่นปุ่ม "HN ?" ของหน้า booking */}
          {rightSlot}

          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            {user ? (
              <>
                <span className="text-white font-semibold text-xs sm:text-sm">
                  คุณคือ {user.name || "ผู้ใช้"}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-2 py-3 sm:px-4 sm:py-3 bg-red-600 text-white rounded-lg shadow font-semibold transition hover:bg-red-700 text-xs sm:text-sm cursor-pointer"
                  title="ลงชื่อออก"
                >
                  <LogOut className="w-3 h-3 sm:w-5 sm:h-5" />
                  <span>ลงชื่อออก</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="flex items-center gap-1 px-2 py-3 sm:px-4 sm:py-3 rounded-lg bg-white text-emerald-700 font-semibold shadow transition hover:bg-gray-300 text-xs sm:text-sm cursor-pointer"
                title="ลงชื่อเข้าใช้"
              >
                <LogIn className="w-3 h-3 sm:w-5 sm:h-5" />
                <span>สำหรับบุคลากร</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* แผงเมนูแบบเลื่อนออก (dropdown) */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 left-0 w-72 h-full bg-slate-800/95 backdrop-blur-md z-40 flex flex-col pt-16 overflow-y-auto shadow-2xl text-white"
          >
            {/* Header */}
            <div className="px-5 pb-4 border-b border-slate-600">
              <div className="flex items-center gap-2 text-xl font-bold text-white">
                <Sparkles className="text-emerald-400 w-5 h-5" />
                ระบบแพทย์แผนไทย
              </div>

              {user && (
                <div className="mt-2 text-sm text-slate-300">
                  ผู้ใช้งาน : <span className="font-semibold">{user.name}</span>
                </div>
              )}
            </div>

            {/* ===================== เมนูหลัก (เห็นได้ทุกคน) ===================== */}
            <div className="py-2">
              <div
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/booking");
                }}
                className={`flex items-center gap-3 px-5 py-3 text-white transition cursor-pointer ${
                  isActive("/booking")
                    ? "bg-emerald-600/30 hover:bg-emerald-600"
                    : "hover:bg-emerald-600"
                }`}
              >
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>{user ? "จองคิวนวดแผนไทย" : "ดูคิวจองนวดแผนไทย"}</span>
              </div>

              <div
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/booking-audit");
                }}
                className={`flex items-center gap-3 px-5 py-3 text-white transition cursor-pointer ${
                  isActive("/booking-audit")
                    ? "bg-emerald-600/30 hover:bg-emerald-600"
                    : "hover:bg-emerald-600"
                }`}
              >
                <ClipboardList className="w-4 h-4 text-blue-400" />
                <span>ดูคิวนวดทั้งหมด</span>
              </div>

              <div
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/beds-special");
                }}
                className={`flex items-center gap-3 px-5 py-3 text-white transition cursor-pointer ${
                  isActive("/beds-special")
                    ? "bg-emerald-600/30 hover:bg-emerald-600"
                    : "hover:bg-emerald-600"
                }`}
              >
                <BedDouble className="w-4 h-4 text-emerald-300" />
                <span>จองเตียงพิเศษ</span>
              </div>
            </div>

            {/* ===================== สำหรับเจ้าหน้าที่ (login แล้วเท่านั้น) ===================== */}
            {user && (
              <>
                <div className="border-t border-slate-600 my-2" />

                <div className="px-5 py-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  สำหรับเจ้าหน้าที่
                </div>

                <div
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/all-bookings");
                  }}
                  className={`flex items-center gap-3 px-5 py-3 text-white transition cursor-pointer ${
                    isActive("/all-bookings")
                      ? "bg-blue-600/40 hover:bg-blue-600"
                      : "hover:bg-blue-600"
                  }`}
                >
                  <History className="w-4 h-4 text-amber-400" />
                  <span>ประวัติการจอง</span>
                </div>

                <div
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/summary-history");
                  }}
                  className={`flex items-center gap-3 px-5 py-3 text-white transition cursor-pointer ${
                    isActive("/summary-history")
                      ? "bg-blue-600/40 hover:bg-blue-600"
                      : "hover:bg-blue-600"
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  <span>สรุปรายงาน</span>
                </div>

                <div
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/summary-therapists");
                  }}
                  className={`flex items-center gap-3 px-5 py-3 text-white transition cursor-pointer ${
                    isActive("/summary-therapists")
                      ? "bg-blue-600/40 hover:bg-blue-600"
                      : "hover:bg-blue-600"
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-purple-100" />
                  <span>รายงานการปฎิบัติงาน</span>
                </div>

                <div
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/check-que");
                  }}
                  className={`flex items-center gap-3 px-5 py-3 text-white transition cursor-pointer ${
                    isActive("/check-que")
                      ? "bg-blue-600/40 hover:bg-blue-600"
                      : "hover:bg-blue-600"
                  }`}
                >
                  <Search className="w-4 h-4 text-purple-100" />
                  <span>ค้นหาข้อมูลผู้รับบริการ</span>
                </div>
              </>
            )}

            {/* ===================== Admin เท่านั้น ===================== */}
            {isAdmin && (
              <>
                <div className="border-t border-slate-600 my-2" />

                <div className="px-5 py-2 text-xs font-semibold uppercase tracking-widest text-amber-300">
                  จัดการระบบ
                </div>

                <div
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/manage-therapists");
                  }}
                  className={`flex items-center gap-3 px-5 py-3 text-white transition cursor-pointer ${
                    isActive("/manage-therapists")
                      ? "bg-amber-600/40 hover:bg-amber-600"
                      : "hover:bg-amber-600"
                  }`}
                >
                  <Users className="w-4 h-4 text-rose-400" />
                  <span>จัดการบุคลากร</span>
                </div>
              </>
            )}

            {/* ===================== ติดต่อ (เห็นได้ทุกคน) ===================== */}
            <div className="border-t border-slate-600 my-2" />

            <div
              onClick={() => setContactOpen(!contactOpen)}
              className="flex items-center gap-3 px-5 py-3 text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-teal-400" />
              <span className="flex-1">ช่องทางติดต่อ</span>
              {contactOpen ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </div>

            {contactOpen && (
              <div className="bg-slate-900">
                <a
                  href="https://m.me/100070719421986"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-9 py-3 text-slate-200 hover:bg-blue-700 transition"
                >
                  <Facebook className="w-4 h-4 text-blue-400" />
                  Facebook (จองคิว)
                </a>

                <a
                  href="https://www.lmwcc.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-9 py-3 text-slate-200 hover:bg-emerald-700 transition"
                >
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  เว็บไซต์ศูนย์บริการ
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
