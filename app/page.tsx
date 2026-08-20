"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Calendar,
  Clock,
  Phone,
  Mail,
  Globe,
  CreditCard,
  Building2,
  BedDouble,
  ClipboardList,
  History,
  BarChart3,
  Users,
  Menu,
  X,
  LogOut,
  LogIn,
  ChevronDown,
  ChevronUp,
  Facebook,
  AlertCircle,
  MapPin,
  PhoneCall,
  ArrowRight,
  HeartHandshake,
  Flower2,
  Stethoscope,
  Activity,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";

// === Hook การนำทางจริง / Mock สำรองสำหรับ Preview ===
let useRouterHook: any;
try {
  useRouterHook = require("next/navigation").useRouter;
} catch (e) {
  useRouterHook = () => ({
    push: (path: string) => {
      if (typeof window !== "undefined") {
        console.log("นำทางไปหน้า:", path);
        window.location.href = path;
      }
    },
  });
}

// === Hook สิทธิ์ผู้ใช้งานจริง / Mock สำรองสำหรับ Preview ===
let useAuthHook: any;
try {
  useAuthHook = require("@/context/AuthContext").useAuth;
} catch (e) {
  useAuthHook = () => ({
    user: { name: "นายดุสิทธิ์ ไชยศรีหา", role: "admin", role_id: 909, isAdmin: true },
    logout: () => console.log("Logout triggered"),
  });
}

export default function HomePage() {
  const router = useRouterHook();
  const { user, logout } = useAuthHook();

  const [showAlert, setShowAlert] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isUserAdmin = user?.isAdmin || user?.role_id === 909 || String(user?.role).toLowerCase() === "admin";

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
      triggerAlert();
      return;
    }
    router.push("/booking");
  };

  const handleBedsClick = () => {
    if (!user) {
      triggerAlert();
      return;
    }
    router.push("/beds-special");
  };

  const triggerAlert = () => {
    setShowAlert(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setShowAlert(false);
      timeoutRef.current = null;
    }, 4000);
  };

  const handleLogoutNavigation = async () => {
    if (logout) await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between text-slate-950 bg-slate-100 overflow-x-hidden">
      
      {/* Background Layer */}
      <div className="fixed inset-0 -z-20 bg-slate-900/10">
        {/* Desktop Image */}
        <img
          src="/แผนไทย.png"
          alt="พื้นหลัง"
          className="hidden sm:block absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Mobile Portrait Image */}
        <img
          src="/mthai_mb.jpg"
          alt="พื้นหลังแนวตั้ง"
          className="block sm:hidden absolute inset-0 w-full h-full object-cover object-center portrait:block landscape:hidden"
        />
        {/* Mobile Landscape Image */}
        <img
          src="/แผนไทยมือถือแนวนอน.png"
          alt="พื้นหลังแนวนอน"
          className="block sm:hidden absolute inset-0 w-full h-full object-cover object-center portrait:hidden landscape:block"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-900/40 to-slate-950/80 backdrop-blur-[2px]" />
      </div>

      {/* Navbar บนสุด */}
      <div className="fixed top-0 left-0 w-full z-50 bg-slate-900/90 backdrop-blur-md shadow-md flex justify-between items-center px-4 py-3 border-b border-slate-800 h-16">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-white p-1.5 hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="เมนู"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div
            className="text-white font-black text-base sm:text-lg flex items-center gap-2 cursor-pointer hover:text-emerald-400 transition"
            onClick={() => router.push("/")}
          >
            <Flower2 className="w-5 h-5 text-emerald-400" />
            <span>แพทย์แผนไทย</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-slate-200 text-xs sm:text-sm font-extrabold hidden sm:inline">
                สวัสดี <strong className="text-emerald-400 font-black">{user.name || "ผู้ใช้"}</strong>
              </span>
              <button
                onClick={handleLogoutNavigation}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow font-black text-xs transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>ลงชื่อออก</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 font-black shadow-sm transition text-xs cursor-pointer border border-emerald-300"
            >
              <LogIn className="w-4 h-4 text-emerald-700" />
              <span>สำหรับบุคลากร</span>
            </button>
          )}
        </div>
      </div>

      {/* Hamburger Drawer เมนูด้านซ้าย */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed top-0 left-0 w-72 h-full bg-slate-900/98 backdrop-blur-md z-50 flex flex-col pt-16 border-r border-slate-800 text-white shadow-2xl"
          >
            {/* Header */}
            <div className="px-5 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xl font-black text-white">
                <Flower2 className="text-emerald-400 w-5 h-5" />
                ระบบแพทย์แผนไทย
              </div>

              {user && (
                <div className="mt-2 text-sm text-slate-300 font-semibold">
                  ผู้ใช้งาน : <span className="font-bold text-white">{user.name}</span>
                </div>
              )}
            </div>

            {/* ===================== เมนูหลัก ===================== */}
            <div className="py-2">
              <div
                onClick={() => {
                  setMenuOpen(false);
                  user ? handleBookingClick() : router.push("/booking");
                }}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer text-sm font-bold"
              >
                <Calendar className="w-5 h-5 text-emerald-400" />
                <span>{user ? "จองคิวนวดแผนไทย" : "ดูคิวจองนวดแผนไทย"}</span>
              </div>

              <div
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/booking-audit");
                }}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer text-sm font-bold"
              >
                <ClipboardList className="w-5 h-5 text-sky-400" />
                <span>ดูคิวนวดทั้งหมด</span>
              </div>

              <div
                onClick={() => {
                  setMenuOpen(false);
                  user ? handleBedsClick() : router.push("/beds-special");
                }}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer text-sm font-bold"
              >
                <BedDouble className="w-5 h-5 text-teal-300" />
                <span>การจองเตียงพิเศษ</span>
              </div>
            </div>

            {/* ===================== เจ้าหน้าที่ ===================== */}
            {user && (
              <>
                <div className="border-t border-slate-800 my-2" />

                <div className="px-5 py-2 text-xs font-black uppercase tracking-widest text-slate-400">
                  สำหรับเจ้าหน้าที่
                </div>

                <div
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/all-bookings");
                  }}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer text-sm font-bold"
                >
                  <History className="w-5 h-5 text-amber-400" />
                  <span>ประวัติการจอง</span>
                </div>

                <div
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/summary-history");
                  }}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer text-sm font-bold"
                >
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  <span>สรุปรายงาน</span>
                </div>
                <div
                  onClick={() => router.push("/summary-therapists")}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-purple-100" />
                  <span>รายงานการปฎิบัติงาน</span>
                </div>
              </>
            )}

            {/* ===================== Admin ===================== */}
            {isUserAdmin && (
              <>
                <div className="border-t border-slate-800 my-2" />

                <div className="px-5 py-2 text-xs font-black uppercase tracking-widest text-amber-300">
                  จัดการระบบ
                </div>

                <div
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/manage-therapists");
                  }}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-amber-600 transition cursor-pointer text-sm font-bold"
                >
                  <Users className="w-5 h-5 text-rose-400" />
                  <span>จัดการบุคลากร</span>
                </div>
              </>
            )}

            {/* ===================== ติดต่อ ===================== */}
            <div className="border-t border-slate-800 my-2" />

            <div
              onClick={() => setContactOpen(!contactOpen)}
              className="flex items-center gap-3 px-5 py-3 text-white hover:bg-slate-800 transition cursor-pointer text-sm font-bold"
            >
              <Building2 className="w-5 h-5 text-teal-400" />
              <span className="flex-1">ช่องทางติดต่อ</span>
              {contactOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>

            {contactOpen && (
              <div className="bg-slate-950/80 text-slate-300 text-xs font-bold">
                <a
                  href="https://m.me/100070719421986"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-9 py-3 hover:bg-slate-800 transition"
                >
                  <Facebook className="w-4 h-4 text-sky-400" />
                  <span>Facebook (จองคิว)</span>
                </a>

                <a
                  href="https://www.lmwcc.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-9 py-3 hover:bg-slate-800 transition"
                >
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>เว็บไซต์ศูนย์บริการ</span>
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🌟 คอนเทนต์หลักกลางหน้าจอ */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-12 my-auto z-10 w-full">
        
        {/* Main Card Container */}
        <div className="bg-white/98 backdrop-blur-md rounded-3xl shadow-2xl p-6 sm:p-10 border-2 border-emerald-200 text-slate-950">
          
          {/* Header Title with Logo */}
          <div className="text-center border-b-2 pb-6 border-slate-200">
            
            {/* 🌟 โลโก้หน่วยงานด้านบนสุด */}
            <div className="mb-4 flex justify-center">
              <img
                src="/logo.png"
                alt="โลโก้ศูนย์บริการสาธารณสุขเทศบาลเมืองลำพูน"
                className="h-20 sm:h-24 w-auto object-contain drop-shadow-md"
                onError={(e) => {
                  // Fallback กรณีหาภาพไม่เจอ
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-950 text-xs font-black mb-3 border-2 border-emerald-300 shadow-2xs">
              <Flower2 className="w-4 h-4 text-emerald-700" />
              <span>ศูนย์บริการสาธารณสุขเทศบาลเมืองลำพูน</span>
            </div>
            
            <h1 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight leading-tight flex items-center justify-center gap-2">
              <Stethoscope className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-700 hidden sm:inline-block" />
              <span>คลินิกแพทย์แผนไทยประยุกต์</span>
            </h1>
            <p className="text-slate-800 font-extrabold text-sm sm:text-base mt-2 flex items-center justify-center gap-1.5">
              <MapPin className="w-4.5 h-4.5 text-emerald-700" />
              <span>เทศบาลเมืองลำพูน จังหวัดลำพูน</span>
            </p>
          </div>

          {/* Quick Info Grid - สื่อความหมายเกี่ยวกับการบริการแพทย์แผนไทย */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 my-6">
            
            {/* เวลาทำการ */}
            <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-300">
              <h3 className="font-black text-slate-950 text-base mb-3 flex items-center gap-2 border-b pb-2 border-slate-200">
                <Clock className="w-5 h-5 text-emerald-700" />
                <span>เวลาเปิดให้บริการตรวจรักษา</span>
              </h3>
              <ul className="text-xs sm:text-sm text-slate-900 space-y-2 font-black">
                <li className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span>วันจันทร์ - วันศุกร์:</span>
                  <span className="text-emerald-900 font-black bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">07.30 - 18.00 น.</span>
                </li>
                <li className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span>วันเสาร์:</span>
                  <span className="text-emerald-900 font-black bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">08.00 - 16.00 น.</span>
                </li>
              </ul>
            </div>

            {/* สิทธิการรักษา */}
<div className="bg-emerald-50/80 p-5 rounded-2xl border-2 border-emerald-300">
  <h3 className="font-black text-emerald-950 text-base mb-3 flex items-center gap-2 border-b pb-2 border-emerald-200">
    <ShieldCheck className="w-5 h-5 text-emerald-700" />
    <span>สิทธิการเบิกจ่ายการรักษา</span>
  </h3>

  <div className="space-y-3">
    {/* หัวข้อที่ 1: สิทธิเบิกตรง */}
    <div className="bg-white p-3.5 rounded-xl border-2 border-emerald-300 shadow-2xs">
      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-emerald-950 mb-1">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>สิทธิเบิกตรง:</span>
      </div>
      <p className="text-xs sm:text-sm text-slate-800 font-extrabold leading-relaxed pl-5">
        <strong className="text-emerald-950 font-black">ข้าราชการ</strong> /{" "}
        <strong className="text-emerald-950 font-black">องค์กรปกครองส่วนท้องถิ่น (อปท.)</strong> /{" "}
        <strong className="text-emerald-950 font-black">การรถไฟแห่งประเทศไทย</strong> สามารถใช้สิทธิเบิกตรงได้ตามระเบียบ
      </p>
    </div>

    {/* หัวข้อที่ 2: สิทธิหลักประกันสุขภาพแห่งชาติ */}
    <div className="bg-white p-3.5 rounded-xl border-2 border-emerald-300 shadow-2xs">
      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-emerald-950 mb-1">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>สิทธิหลักประกันสุขภาพแห่งชาติ:</span>
      </div>
      <p className="text-xs sm:text-sm text-slate-800 font-extrabold leading-relaxed pl-5">
        <strong className="text-emerald-950 font-black">สิทธิบัตรทอง</strong> สามารถใช้บริการได้ตามเงื่อนไขและระเบียบของ สปสช.
      </p>
    </div>
  </div>
</div>

          </div>

          {/* ช่องทางติดต่อสอบถาม */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 mb-8 shadow-md">
            <h3 className="font-black text-base text-amber-300 mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
              <PhoneCall className="w-5 h-5 text-amber-400" />
              <span>สอบถามข้อมูลเพิ่มเติม & ช่องทางติดต่อ</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm font-extrabold">
              <div className="flex items-start gap-2.5 bg-slate-800 p-3 rounded-xl border border-slate-700">
                <Phone className="w-4.5 h-4.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-slate-300 block text-[11px] font-bold">เบอร์โทรศัพท์ติดต่อ:</span>
                  <span className="text-white font-black text-sm">053-525776 ต่อ 320</span> <br />
                  <span className="text-white font-black text-sm">094-6422111</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-800 p-3 rounded-xl border border-slate-700">
                <Globe className="w-4.5 h-4.5 text-sky-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-slate-300 block text-[11px] font-bold">เว็บไซต์ทางการ:</span>
                  <a
                    href="https://www.lmwcc.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-300 hover:underline font-black text-sm"
                  >
                    www.lmwcc.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-800 p-3 rounded-xl border border-slate-700 sm:col-span-2">
                <Mail className="w-4.5 h-4.5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-slate-300 block text-[11px] font-bold">อีเมลติดต่อ (E-mail):</span>
                  <span className="text-white font-black text-sm">medicalwcc@gmail.com</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => user ? handleBookingClick() : router.push("/booking")}
              className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-base rounded-2xl shadow-md transition duration-200 flex items-center justify-center gap-2 cursor-pointer border-2 border-emerald-900"
            >
              <Calendar className="w-5 h-5 text-amber-300" />
              <span>{user ? "จองคิวนวดแผนไทย" : "ดูคิวจองนวดแผนไทย"}</span>
              <ArrowRight className="w-5 h-5 text-amber-300" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => user ? handleBedsClick() : router.push("/beds-special")}
                className="w-full py-3.5 bg-teal-800 hover:bg-teal-900 text-white font-black text-sm rounded-2xl shadow-xs transition duration-200 flex items-center justify-center gap-2 cursor-pointer border-2 border-teal-950"
              >
                <BedDouble className="w-4.5 h-4.5 text-teal-300" />
                <span>การจองเตียงพิเศษ</span>
              </button>

              <button
                onClick={() => router.push("/booking-audit")}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-sm rounded-2xl shadow-xs transition duration-200 flex items-center justify-center gap-2 cursor-pointer border-2 border-slate-950"
              >
                <ClipboardList className="w-4.5 h-4.5 text-sky-400" />
                <span>ดูคิวนวดทั้งหมด</span>
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Popup เตือนกรณีบุคคลทั่วไปยังไม่ได้เข้าสู่ระบบ */}
      <AnimatePresence>
        {showAlert && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-amber-100 border-2 border-amber-400 text-amber-950 px-6 py-4 rounded-2xl flex items-center gap-3 shadow-xl max-w-md z-50">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-black">กรุณาเข้าสู่ระบบสำหรับบุคลากรก่อนทำรายการจองคิว</span>
            <button
              onClick={() => {
                setShowAlert(false);
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                  timeoutRef.current = null;
                }
              }}
              className="ml-auto text-amber-900 font-black hover:text-amber-950 text-xl cursor-pointer"
            >
              ×
            </button>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="text-center text-xs text-white/90 font-black py-4 z-10 drop-shadow-xs">
        © คลินิกแพทย์แผนไทยประยุกต์ ศูนย์บริการสาธารณสุขเทศบาลเมืองลำพูน
      </footer>

    </div>
  );
}