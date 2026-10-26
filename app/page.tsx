"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  Phone,
  Mail,
  Globe,
  Building2,
  BedDouble,
  ClipboardList,
  LogOut,
  LogIn,
  AlertCircle,
  MapPin,
  PhoneCall,
  ArrowRight,
  Flower2,
  Stethoscope,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";

// === นำเข้า HamburgerMenu ที่ดึงมาจาก components ===
import HamburgerMenu from "./components/HamburgerMenu";

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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // ✅ สร้างปุ่ม Login/Logout เพื่อส่งไปเป็น rightSlot ใน HamburgerMenu
  const rightSlotContent = (
    <div className="flex items-center gap-3">
      
    </div>
  );

  return (
    <div className="min-h-screen relative flex flex-col justify-between text-slate-950 bg-slate-100 overflow-x-hidden">
      
      {/* Background Layer */}
      <div className="fixed inset-0 -z-20 bg-slate-900/10">
        <img
          src="/แผนไทย.png"
          alt="พื้นหลัง"
          className="hidden sm:block absolute inset-0 w-full h-full object-cover object-center"
        />
        <img
          src="/mthai_mb.jpg"
          alt="พื้นหลังแนวตั้ง"
          className="block sm:hidden absolute inset-0 w-full h-full object-cover object-center portrait:block landscape:hidden"
        />
        <img
          src="/แผนไทยมือถือแนวนอน.png"
          alt="พื้นหลังแนวนอน"
          className="block sm:hidden absolute inset-0 w-full h-full object-cover object-center portrait:hidden landscape:block"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-900/40 to-slate-950/80 backdrop-blur-[2px]" />
      </div>

      {/* 🌟 ดึง HamburgerMenu มาแสดงตรงนี้แทน Navbar เดิม */}
      <HamburgerMenu rightSlot={rightSlotContent} />

      {/* 🌟 คอนเทนต์หลักกลางหน้าจอ */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-12 my-auto z-10 w-full">
        <div className="bg-white/98 backdrop-blur-md rounded-3xl shadow-2xl p-6 sm:p-10 border-2 border-emerald-200 text-slate-950">
          
          {/* Header Title with Logo */}
          <div className="text-center border-b-2 pb-6 border-slate-200">
            <div className="mb-4 flex justify-center">
              <img
                src="/logo.png"
                alt="โลโก้ศูนย์บริการสาธารณสุขเทศบาลเมืองลำพูน"
                className="h-20 sm:h-24 w-auto object-contain drop-shadow-md"
                onError={(e) => {
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