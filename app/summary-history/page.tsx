"use client";

import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  BedDouble,
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Wallet,
  Receipt,
  Calendar,
  History,
  BarChart3,
  Users,
  Facebook,
  X,
  Menu,
  LogOut,
  LogIn,
  Sparkles,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Bed,
} from "lucide-react";

// === Hook นำทางและ Context สิทธิ์ ===
let useRouterHook: any;
try {
  useRouterHook = require("next/navigation").useRouter;
} catch (e) {
  useRouterHook = () => ({
    push: (path: string) => {
      if (typeof window !== "undefined") {
        window.location.href = path;
      }
    },
  });
}

let useAuthHook: any;
try {
  useAuthHook = require("@/context/AuthContext").useAuth;
} catch (e) {
  useAuthHook = () => ({
    user: { name: "นายดุสิทธิ์ ไชยศรีหา", role: "admin", role_id: 909, isAdmin: true },
    logout: () => console.log("Logout triggered"),
  });
}

type Booking = {
  id: number;
  therapist: string;
  status: string;
  date: string;
  payment_status?: string; // unpaid, paid, UC
  special_booking_id?: number | null;
  bed_id?: number | null;
  special_bed_status?: number | string | null;
  bed_name?: string | null;
  room_name?: string | null;
};

interface Therapist {
  id: number;
  name: string;
}

interface SpecialBed {
  id: number;
  bed_code?: string;
  bed_name: string;
  room_name: string;
}

export default function SummaryHistoryPage() {
  const router = useRouterHook();
  const { user, logout } = useAuthHook();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [specialBeds, setSpecialBeds] = useState<SpecialBed[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [filtered, setFiltered] = useState<Booking[]>([]);
  const [, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [month] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"success" | "pending" | "cancelled">("success");
  const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [, setShowAlert] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    setWindowWidth(window.innerWidth);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  useEffect(() => {
    if (!startDate && !endDate) return;
    (async () => {
      try {
        const res = await fetch("/api/summary-history");
        const data = await res.json();
        if (data.success) {
          setBookings(data.bookings || []);
          if (data.specialBeds && data.specialBeds.length > 0) {
            setSpecialBeds(data.specialBeds);
          }

          const yearSet = new Set<number>();
          data.bookings.forEach((b: Booking) => yearSet.add(new Date(b.date).getFullYear()));
          const yearArr = Array.from(yearSet).sort((a, b) => a - b);
          setYears(yearArr);
          if (yearArr.length > 0) setYear(yearArr[yearArr.length - 1]);
        }
      } catch (e) {
        console.error("โหลดข้อมูล bookings ล้มเหลว", e);
      }
    })();
  }, [startDate, endDate]);

  useEffect(() => {
    if (!startDate && !endDate) return;
    (async () => {
      try {
        const res = await fetch("/api/therapists");
        const data = await res.json();
        if (data.success) setTherapists(data.therapists);
      } catch (e) {
        console.error("โหลดข้อมูล therapists ล้มเหลว", e);
      }
    })();
  }, [startDate, endDate]);

  useEffect(() => {
    if (!startDate && !endDate) {
      setFiltered([]);
      return;
    }

    const f = bookings.filter((b) => {
      const d = new Date(b.date);
      const s = startDate ? new Date(startDate) : null;
      const e = endDate ? new Date(endDate) : null;

      if (s && e) {
        const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const sOnly = new Date(s.getFullYear(), s.getMonth(), s.getDate());
        const eOnly = new Date(e.getFullYear(), e.getMonth(), e.getDate());
        return dOnly >= sOnly && dOnly <= eOnly;
      }

      if (s && !e)
        return (
          d.getFullYear() === s.getFullYear() &&
          d.getMonth() === s.getMonth() &&
          d.getDate() === s.getDate()
        );

      if (!s && e)
        return (
          d.getFullYear() === e.getFullYear() &&
          d.getMonth() === e.getMonth() &&
          d.getDate() === e.getDate()
        );

      return false;
    });

    setFiltered(f);
  }, [bookings, startDate, endDate]);

  useEffect(() => {
    if (!year) return;

    const f = bookings.filter((b) => {
      const d = new Date(b.date);

      const dY = d.getFullYear();
      const dM = d.getMonth();
      const dD = d.getDate();

      const s = startDate ? new Date(startDate) : null;
      const e = endDate ? new Date(endDate) : null;

      const sY = s?.getFullYear();
      const sM = s?.getMonth();
      const sD = s?.getDate();

      const eY = e?.getFullYear();
      const eM = e?.getMonth();
      const eD = e?.getDate();

      if (s && e) {
        const dDateOnly = new Date(dY, dM, dD);
        const startDateOnly = new Date(sY!, sM!, sD!);
        const endDateOnly = new Date(eY!, eM!, eD!);
        return dDateOnly >= startDateOnly && dDateOnly <= endDateOnly;
      }

      if (s && !e) return dY === sY && dM === sM && dD === sD;
      if (!s && e) return dY === eY && dM === eM && dD === eD;
      if (year && month !== "all") return dY === year && dM === month;

      return true;
    });

    setFiltered(f);
  }, [bookings, year, month, startDate, endDate]);

  if (!user) {
    return <p className="text-center py-20 font-bold">กำลังตรวจสอบสิทธิ์...</p>;
  }

  // สรุปข้อมูลรายเดือน
  const monthlySummary = Array.from({ length: 12 }).map((_, idx) => {
    const monthBookings = filtered.filter((b) => new Date(b.date).getMonth() === idx);
    return {
      month: monthNames[idx],
      สำเร็จ: monthBookings.filter((b) => b.status === "สำเร็จ").length,
      รอดำเนินการ: monthBookings.filter((b) => b.status === "รอดำเนินการ").length,
      ยกเลิก: monthBookings.filter((b) => b.status === "ยกเลิก").length,
      total: monthBookings.length,
    };
  });

  // สรุปข้อมูลตามหมอนวด
  const therapistSummary: Record<string, { success: number; pending: number; cancelled: number }> = {};
  therapists.forEach((t) => {
    therapistSummary[t.name] = { success: 0, pending: 0, cancelled: 0 };
  });
  filtered.forEach((b) => {
    if (!therapists.some((t) => t.name === b.therapist)) return;
    if (!therapistSummary[b.therapist]) therapistSummary[b.therapist] = { success: 0, pending: 0, cancelled: 0 };
    if (b.status === "สำเร็จ") therapistSummary[b.therapist].success += 1;
    if (b.status === "รอดำเนินการ") therapistSummary[b.therapist].pending += 1;
    if (b.status === "ยกเลิก") therapistSummary[b.therapist].cancelled += 1;
  });

  const therapistChartData = Object.entries(therapistSummary).map(([name, counts]) => ({
    name,
    สำเร็จ: counts.success,
    รอดำเนินการ: counts.pending,
    ยกเลิก: counts.cancelled,
  }));

  // 🌟 คำนวณสรุปสถิติสิทธิการรักษาพยาบาล (payment_status)
  const unpaidCount = filtered.filter(
    (b) => b.payment_status === "unpaid" || b.payment_status === "เบิกตรง" || !b.payment_status
  ).length;
  const paidCount = filtered.filter((b) => b.payment_status === "paid" || b.payment_status === "ชำระเงิน").length;
  const ucCount = filtered.filter((b) => b.payment_status === "UC" || b.payment_status === "บัตรทอง").length;

  // 🌟 คำนวณสรุปสถิติการใช้บริการเตียงพิเศษ (Special Bed Bookings)
  const defaultBeds: SpecialBed[] = [
    { id: 1, bed_code: "BED-VIP-01", bed_name: "เตียงพิเศษ 1", room_name: "ห้องนวด VIP 1 (ชั้น 2)" },
    { id: 2, bed_code: "BED-VIP-02", bed_name: "เตียงพิเศษ 2", room_name: "ห้องนวด VIP 1 (ชั้น 2)" },
    { id: 3, bed_code: "BED-VIP-03", bed_name: "เตียงพิเศษ 3", room_name: "ห้องนวด VIP 2 (ชั้น 2)" },
    { id: 4, bed_code: "BED-VIP-04", bed_name: "เตียงพิเศษ 4", room_name: "ห้องนวด VIP 2 (ชั้น 2)" },
  ];

  const specialBedBookingsFiltered = filtered.filter(
    (b) => b.special_booking_id || b.bed_id || b.bed_name
  );

  const totalSpecialBedUsage = specialBedBookingsFiltered.length;

  const completedSpecialBedUsage = specialBedBookingsFiltered.filter(
    (b) => b.special_bed_status === 1 || b.special_bed_status === "1" || b.status === "สำเร็จ"
  ).length;

  const pendingSpecialBedUsage = totalSpecialBedUsage - completedSpecialBedUsage;

  const bedListToDisplay = specialBeds.length > 0 ? specialBeds : defaultBeds;

  const usageByBed = bedListToDisplay.map((bed) => {
    const bedBookings = specialBedBookingsFiltered.filter(
      (b) => b.bed_id === bed.id || b.bed_name === bed.bed_name
    );
    const completed = bedBookings.filter(
      (b) => b.special_bed_status === 1 || b.special_bed_status === "1" || b.status === "สำเร็จ"
    ).length;
    return {
      ...bed,
      total: bedBookings.length,
      completed,
      pending: bedBookings.length - completed,
    };
  });

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

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

  const handleBedsClick = () => {
    if (!user) {
      setShowAlert(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setShowAlert(false);
        timeoutRef.current = null;
      }, 5000);
      return;
    }
    router.push("/beds-special");
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-28 pb-12">
      {/* Header Bar */}
      <div className="fixed top-0 left-0 w-full z-50 bg-gray-700 shadow-md flex justify-between items-center px-2 sm:px-4 py-2 sm:py-2">
        <div className="flex items-center gap-2 sm:gap-13">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-white text-xl sm:text-2xl cursor-pointer"
            title="เมนู"
          >
            {menuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          <div
            className="ml-3 sm:ml-3 text-white font-bold text-base sm:text-lg flex items-center gap-1 cursor-pointer"
            onClick={() => router.push("/")}
            title="หน้าหลัก"
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" /> แพทย์แผนไทย
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-3 text-xs sm:text-sm">
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
              className="flex items-center gap-1 px-2 py-1 sm:px-4 sm:py-2 rounded-lg bg-white text-emerald-700 font-semibold shadow transition hover:bg-gray-300 text-xs sm:text-sm"
              title="ลงชื่อเข้าใช้"
            >
              <LogIn className="w-3 h-3 sm:w-5 sm:h-5" />
              <span>สำหรับบุคลากร</span>
            </button>
          )}
        </div>
      </div>

      {/* Hamburger Drawer */}
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
            <div className="px-5 pb-4 border-b border-slate-600">
              <div className="flex items-center gap-2 text-xl font-bold text-white">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                ระบบแพทย์แผนไทย
              </div>
              {user && (
                <div className="mt-2 text-sm text-slate-300">
                  ผู้ใช้งาน : <span className="font-semibold text-white">{user.name}</span>
                </div>
              )}
            </div>

            <div className="py-2">
              <div
                onClick={user ? handleBookingClick : () => router.push("/booking")}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>{user ? "จองคิวนวดแผนไทย" : "ดูคิวจองนวดแผนไทย"}</span>
              </div>

              <div
                onClick={() => router.push("/booking-audit")}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer"
              >
                <ClipboardList className="w-4 h-4 text-sky-400" />
                <span>ดูคิวนวดทั้งหมด</span>
              </div>
              
              <div
                onClick={user ? handleBedsClick : () => router.push("/beds-special")}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer"
              >
                <BedDouble className="w-4 h-4 text-teal-300" />
                <span>{user ? "การจองเตียงพิเศษ" : "การจองเตียงพิเศษ"}</span>
              </div>
            </div>

            {user && (
              <>
                <div className="border-t border-slate-600 my-2" />
                <div className="px-5 py-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  สำหรับเจ้าหน้าที่
                </div>
                <div
                  onClick={() => router.push("/all-bookings")}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer"
                >
                  <History className="w-4 h-4 text-amber-400" />
                  <span>ประวัติการจอง</span>
                </div>
                <div
                  onClick={() => router.push("/summary-history")}
                  className="flex items-center gap-3 px-5 py-3 text-white bg-blue-600/30 hover:bg-blue-600 transition cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  <span>สรุปรายงาน</span>
                </div>
              </>
            )}

            {user?.role === "admin" && (
              <>
                <div className="border-t border-slate-600 my-2" />
                <div className="px-5 py-2 text-xs font-semibold uppercase tracking-widest text-amber-300">
                  จัดการระบบ
                </div>
                <div
                  onClick={() => router.push("/manage-therapists")}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-amber-600 transition cursor-pointer"
                >
                  <Users className="w-4 h-4 text-rose-400" />
                  <span>จัดการบุคลากร</span>
                </div>
              </>
            )}

            <div className="border-t border-slate-600 my-2" />
            <div
              onClick={() => setContactOpen(!contactOpen)}
              className="flex items-center gap-3 px-5 py-3 text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-teal-400" />
              <span className="flex-1">ช่องทางติดต่อ</span>
              {contactOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>

            {contactOpen && (
              <div className="bg-slate-900">
                <a
                  href="https://m.me/100070719421986"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-9 py-3 text-slate-200 hover:bg-blue-700 transition"
                >
                  <Facebook className="w-4 h-4 text-sky-400" />
                  <span>Facebook (จองคิว)</span>
                </a>
                <a
                  href="https://www.lmwcc.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-9 py-3 text-slate-200 hover:bg-emerald-700 transition"
                >
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>เว็บไซต์ศูนย์บริการ</span>
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <h1 className="text-3xl font-bold text-emerald-800 mb-6 text-center">
        📊 สรุปประวัติ
      </h1>

      {/* เลือกช่วงวันที่ */}
      <div className="flex gap-2 sm:gap-3 mb-7 justify-center flex-wrap items-center">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-30 sm:w-35 border border-emerald-400 rounded-lg px-2 sm:px-3 py-2 sm:py-2 text-sm sm:text-base bg-white text-emerald-800 shadow-sm focus:ring-2 focus:ring-emerald-300 outline-none"
        />
        <span className="text-sm sm:text-base text-emerald-800 mx-1 sm:mx-0">-</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-30 sm:w-35 border border-emerald-400 rounded-lg px-2 sm:px-3 py-2 sm:py-2 text-sm sm:text-base bg-white text-emerald-800 shadow-sm focus:ring-2 focus:ring-emerald-300 outline-none"
        />
      </div>

      {!startDate && !endDate ? (
        <div className="text-center text-gray-500 text-base mt-10">
          🗓️ กรุณาเลือกวันที่เพื่อดูสรุปข้อมูล
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 text-base mt-10">
          ไม่มีข้อมูลในช่วงวันที่ที่เลือก
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 max-w-6xl mx-auto px-4">
            <div className="bg-white shadow rounded-lg p-2 sm:p-4 text-center border-l-4 border-green-800">
              <div className="text-gray-600 font-semibold text-sm sm:text-base">ทั้งหมด</div>
              <div className="text-2xl sm:text-3xl font-bold text-green-800">{filtered.length}</div>
            </div>
            <div className="bg-white shadow rounded-lg p-2 sm:p-4 text-center border-l-4 border-green-400">
              <div className="flex justify-center items-center gap-1 text-gray-600 font-semibold text-sm sm:text-base">
                <CheckCircle2 className="w-4 h-4 text-green-500 inline" /> สำเร็จ
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-green-500">
                {filtered.filter((b) => b.status === "สำเร็จ").length}
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-2 sm:p-4 text-center border-l-4 border-gray-400">
              <div className="flex justify-center items-center gap-1 text-gray-600 font-semibold text-sm sm:text-base">
                <Clock className="w-4 h-4 text-gray-500 inline" /> รอดำเนินการ
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-500">
                {filtered.filter((b) => b.status === "รอดำเนินการ").length}
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-2 sm:p-4 text-center border-l-4 border-red-400">
              <div className="flex justify-center items-center gap-1 text-gray-600 font-semibold text-sm sm:text-base">
                <XCircle className="w-4 h-4 text-red-600 inline" /> ยกเลิก
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-red-600">
                {filtered.filter((b) => b.status === "ยกเลิก").length}
              </div>
            </div>
          </div>

          {/* BarChart รายเดือน */}
          <div className="bg-white shadow rounded-lg p-4 mb-8 max-w-6xl mx-auto px-4">
            <h2 className="text-xl font-semibold text-emerald-700 mb-4 text-center">จำนวนการจองต่อเดือน</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlySummary}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value} ครั้ง`]} labelFormatter={(label) => `เดือน ${label}`} />
                <Legend />
                <Bar dataKey="สำเร็จ" stackId="a" fill="#22C55E" />
                <Bar dataKey="รอดำเนินการ" stackId="a" fill="#6B7280" />
                <Bar dataKey="ยกเลิก" stackId="a" fill="#EF4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* BarChart ตามหมอนวด */}
          <div className="bg-white shadow rounded-lg p-4 max-w-6xl mx-auto mt-8 px-4">
            <h2 className="text-xl font-semibold text-emerald-700 mb-4 text-center">จำนวนการจองต่อคน</h2>

            <ResponsiveContainer
              width="100%"
              height={windowWidth < 640 ? 300 : Math.max(50 * therapistChartData.length, 300)}
            >
              <BarChart
                layout="vertical"
                data={therapistChartData.sort(
                  (a, b) =>
                    b.สำเร็จ + b.รอดำเนินการ + b.ยกเลิก - (a.สำเร็จ + a.รอดำเนินการ + a.ยกเลิก)
                )}
                margin={{
                  top: 20,
                  right: windowWidth < 640 ? 20 : 120,
                  left: 20,
                  bottom: 20,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={windowWidth < 640 ? 120 : 200} />
                <Tooltip />
                <Legend />
                <Bar dataKey="สำเร็จ" stackId="b" fill="#22C55E" />
                <Bar dataKey="รอดำเนินการ" stackId="b" fill="#6B7280" />
                <Bar dataKey="ยกเลิก" stackId="b" fill="#EF4444">
                  <LabelList
                    dataKey={(d: any) => d.สำเร็จ + d.รอดำเนินการ + d.ยกเลิก}
                    position="right"
                    formatter={(v: any) => (v === 0 ? "" : v)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* รายละเอียดหมอนวด */}
            <div className="mt-4 max-w-6xl mx-auto">
              <h3 className="text-lg font-semibold text-emerald-700 mb-2 text-center">จำนวนครั้งสถานะทั้งหมดต่อคน</h3>
              <div className="flex justify-center mb-4">
                <select
                  className="border border-emerald-400 rounded-lg px-3 py-2 bg-white text-emerald-800 shadow-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "success" | "pending" | "cancelled")}
                >
                  <option value="success">สำเร็จ</option>
                  <option value="pending">รอดำเนินการ</option>
                  <option value="cancelled">ยกเลิก</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(therapistSummary).map(([name, counts]) => (
                  <div key={name} className="bg-white rounded shadow p-3 flex justify-between items-center">
                    <span className="font-medium text-gray-600">{name}</span>
                    <span
                      className={`font-bold ${
                        statusFilter === "success"
                          ? "text-green-600"
                          : statusFilter === "pending"
                          ? "text-gray-600"
                          : "text-red-600"
                      }`}
                    >
                      {statusFilter === "success"
                        ? counts.success
                        : statusFilter === "pending"
                        ? counts.pending
                        : counts.cancelled}{" "}
                      ครั้ง
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 🌟 การ์ดรายงานสถิติสิทธิการรักษาพยาบาล (payment_status) */}
          <div className="bg-white shadow rounded-lg p-5 max-w-6xl mx-auto mt-8 border border-emerald-100">
            <h2 className="text-xl font-bold text-emerald-800 mb-2 flex items-center justify-center gap-2">
              <Receipt className="w-6 h-6 text-emerald-600" />
              รายงานสถิติการใช้สิทธิการรักษาพยาบาล
            </h2>
            <p className="text-center text-gray-500 text-xs sm:text-sm mb-6">
              สรุปแยกตามสิทธิการจ่ายเงินประจำช่วงเวลาที่เลือก
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* unpaid: เบิกตรง */}
              <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-sky-500 text-white rounded-xl">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sky-900 text-base">สิทธิเบิกตรง</h3>
                      <p className="text-sky-700 text-[11px] font-semibold">unpaid</p>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-sky-700">{unpaidCount} <span className="text-xs font-bold text-sky-600">ราย</span></span>
                </div>
                <p className="text-xs text-sky-800 font-medium bg-white p-2.5 rounded-xl border border-sky-200 mt-2">
                  คำอธิบาย: สิทธิเบิกได้สำหรับข้าราชการ / รัฐวิสาหกิจ / อปท. / การรถไฟฯ
                </p>
              </div>

              {/* paid: ชำระเงินเอง */}
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-600 text-white rounded-xl">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-emerald-900 text-base">ชำระเงินเอง</h3>
                      <p className="text-emerald-700 text-[11px] font-semibold">paid</p>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-emerald-700">{paidCount} <span className="text-xs font-bold text-emerald-600">ราย</span></span>
                </div>
                <p className="text-xs text-emerald-800 font-medium bg-white p-2.5 rounded-xl border border-emerald-200 mt-2">
                  คำอธิบาย: ผู้รับบริการที่ชำระเงินสด / โอนชำระเงินด้วยตนเอง
                </p>
              </div>

              {/* UC: บัตรทอง */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-500 text-white rounded-xl">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-amber-900 text-base">สิทธิบัตรทอง</h3>
                      <p className="text-amber-700 text-[11px] font-semibold">UC</p>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-amber-700">{ucCount} <span className="text-xs font-bold text-amber-600">ราย</span></span>
                </div>
                <p className="text-xs text-amber-800 font-medium bg-white p-2.5 rounded-xl border border-amber-200 mt-2">
                  คำอธิบาย: ผู้รับบริการใช้สิทธิหลักประกันสุขภาพแห่งชาติ (บัตรทอง)
                </p>
              </div>
            </div>
          </div>

          {/* 🌟 การ์ดรายงานสถิติการใช้บริการเตียงพิเศษ (Special Bed Usage Report Card) */}
          <div className="bg-white shadow rounded-lg p-5 max-w-6xl mx-auto mt-8 border border-emerald-100">
            <h2 className="text-xl font-bold text-emerald-800 mb-2 flex items-center justify-center gap-2">
              <BedDouble className="w-6 h-6 text-emerald-600" />
              รายงานสถิติการใช้บริการเตียงพิเศษ
            </h2>
            <p className="text-center text-gray-500 text-xs sm:text-sm mb-6">
              สรุปจำนวนการเข้าใช้เตียงพิเศษและสถานะการให้บริการ ประจำช่วงเวลาที่เลือก
            </p>

            {/* สรุปสถิติมุมมองรวม */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 text-center shadow-xs">
                <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
                  จำนวนคิวใช้เตียงพิเศษทั้งหมด
                </div>
                <div className="text-3xl font-black text-emerald-900">
                  {totalSpecialBedUsage} <span className="text-sm font-bold text-emerald-700">ครั้ง</span>
                </div>
              </div>

              <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-4 text-center shadow-xs">
                <div className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" /> บริการเสร็จสิ้นแล้ว
                </div>
                <div className="text-3xl font-black text-teal-900">
                  {completedSpecialBedUsage} <span className="text-sm font-bold text-teal-700">ครั้ง</span>
                </div>
              </div>

              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-center shadow-xs">
                <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                  <Clock className="w-4 h-4 text-amber-600" /> อยู่ระหว่างจอง/รอให้บริการ
                </div>
                <div className="text-3xl font-black text-amber-900">
                  {pendingSpecialBedUsage} <span className="text-sm font-bold text-amber-700">ครั้ง</span>
                </div>
              </div>
            </div>

            {/* สรุปแยกรายเตียง */}
            <h3 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2 flex items-center gap-2">
              <Bed className="w-4 h-4 text-emerald-600" />
              สถิติการใช้งานแยกตามรายเตียงพิเศษ
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {usageByBed.map((bedItem) => (
                <div key={bedItem.id} className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-extrabold text-base text-slate-900">{bedItem.bed_name}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                        {bedItem.total} ครั้ง
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3 font-semibold">{bedItem.room_name}</p>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-700 font-bold">
                      <span>✓ เสร็จสิ้น:</span>
                      <span className="text-teal-800 font-black">{bedItem.completed} ครั้ง</span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-bold">
                      <span>⏳ จองแล้ว:</span>
                      <span className="text-amber-800 font-black">{bedItem.pending} ครั้ง</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}