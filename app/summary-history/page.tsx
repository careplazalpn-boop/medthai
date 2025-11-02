"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, LabelList } from "recharts";
import { FaHistory, FaCalendarAlt, FaFacebook, FaHospital, FaChartBar, FaUsersCog, FaSignOutAlt, FaSignInAlt, FaTimes, FaBars, FaCheckCircle, FaClock, FaSpa, FaTimesCircle } from "react-icons/fa";
import { HiChevronDown, HiChevronUp } from "react-icons/hi";

type Booking = {
  id: number;
  therapist: string;
  status: string;
  date: string;
};

interface Therapist {
  id: number;
  name: string;
}


export default function SummaryHistoryPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  //const [therapists, setTherapists] = useState<string[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [filtered, setFiltered] = useState<Booking[]>([]);
  const [, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [month,] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"success" | "pending" | "cancelled">("success");
  const monthNames = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
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
        setBookings(data.bookings);

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

  const f = bookings.filter(b => {
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

    // กรองช่วง start-end
    if (s && e) {
      const dDateOnly = new Date(dY, dM, dD);
      const startDateOnly = new Date(sY!, sM!, sD!);
      const endDateOnly = new Date(eY!, eM!, eD!);
      return dDateOnly >= startDateOnly && dDateOnly <= endDateOnly;
    }

    // กรองวันเดียวจาก startDate
    if (s && !e) return dY === sY && dM === sM && dD === sD;

    // กรองวันเดียวจาก endDate
    if (!s && e) return dY === eY && dM === eM && dD === eD;

    // กรองเดือน/ปี
    if (year && month !== "all") return dY === year && dM === month;

    return true;
  });

  setFiltered(f);
}, [bookings, year, month, startDate, endDate]);


  if (!user) {
    return <p>กำลังตรวจสอบสิทธิ์...</p>; // render ชั่วคราว
  }
  // Summary รายเดือน
  const monthlySummary = Array.from({ length: 12 }).map((_, idx) => {
    const monthBookings = filtered.filter(b => new Date(b.date).getMonth() === idx);
    return {
      month: monthNames[idx],
      สำเร็จ: monthBookings.filter(b => b.status === "สำเร็จ").length,
      รอดำเนินการ: monthBookings.filter(b => b.status === "รอดำเนินการ").length,
      ยกเลิก: monthBookings.filter(b => b.status === "ยกเลิก").length,
      total: monthBookings.length,
    };
  });
  
  // Summary ตามหมอนวด
  const therapistSummary: Record<string, { success: number; pending: number; cancelled: number }> = {};
  therapists.forEach(t => {
  therapistSummary[t.name] = { success: 0, pending: 0, cancelled: 0 };});
  filtered.forEach(b => {
    if (!therapists.some(t => t.name === b.therapist)) return;
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

  return (
    <div className="min-h-screen bg-gray-50 pt-28">
      {/* Header */}
            <div className="fixed top-0 left-0 w-full z-50 bg-gray-700 shadow-md flex justify-between items-center px-2 sm:px-4 py-2 sm:py-2">
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
                    คุณคือ {user.name || "ผู้ใช้"}
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
                    className="flex items-center gap-1 px-2 py-1 sm:px-4 sm:py-2 rounded-lg bg-white text-emerald-700 font-semibold shadow transition hover:bg-gray-300 text-xs sm:text-sm"
                    title="ลงชื่อเข้าใช้"
                  >
                    <FaSignInAlt className="w-3 h-3 sm:w-5 sm:h-5" />
                    <span>สำหรับบุคลากร</span>
                  </button>
                )}
              </div>
            </div>
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
              className="w-full py-3 sm:py-4 px-4 sm:px-6 border-b-1 border-gray-400 cursor-pointer hover:bg-white/20 flex items-center justify-center gap-2 text-sm sm:text-lg font-semibold text-white"
            >
              <FaCalendarAlt /> {user ? "จองคิวนวดแผนไทย" : "ดูคิวจองนวดแผนไทย"}
            </div>

            {user && (
              <>
                <div
                  onClick={() => router.push("/summary-history")}
                  className="w-full py-3 sm:py-4 px-4 sm:px-6 border-b-1 border-gray-400 cursor-pointer hover:bg-white/20 flex items-center justify-center gap-2 text-sm sm:text-lg font-semibold text-white"
                >
                  <FaHistory /> ประวัติการจอง
                </div>
                <div
                  onClick={() => router.push("/summary-history")}
                  className="w-full py-3 sm:py-4 px-4 sm:px-6 border-b-1 border-gray-400 cursor-pointer hover:bg-white/20 flex items-center justify-center gap-2 text-sm sm:text-lg font-semibold text-white"
                >
                  <FaChartBar /> สรุปประวัติ
                </div>
                {user.role === "admin" && (
                  <button
                    onClick={() => router.push("/manage-therapists")}
                    className="w-full py-3 sm:py-4 px-4 sm:px-6 border-b-1 border-gray-400 cursor-pointer hover:bg-white/20 flex items-center justify-center gap-2 text-sm sm:text-lg font-semibold text-white"
                    title="จัดการบุคลากร"
                  >
                    <FaUsersCog /> จัดการบุคลากร
                  </button>
                )}
              </>
            )}

            {/* ช่องทางติดต่อ */}
            <div className="w-full border-b-1 border-gray-400 relative">
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
                    <span>Facebook (จองคิว)</span>
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
      <h1 className="text-3xl font-bold text-emerald-800 mb-6 text-center">
        📊 สรุปประวัติ
      </h1>
      {/* ตัวเลือกช่วงวันที่สำหรับกราฟ/summary */}
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
            <FaCheckCircle className="text-green-500" /> สำเร็จ
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-green-500">
            {filtered.filter(b => b.status === "สำเร็จ").length}
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-2 sm:p-4 text-center border-l-4 border-gray-400">
          <div className="flex justify-center items-center gap-1 text-gray-600 font-semibold text-sm sm:text-base">
            <FaClock className="text-gray-500" /> รอดำเนินการ
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-500">
            {filtered.filter(b => b.status === "รอดำเนินการ").length}
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-2 sm:p-4 text-center border-l-4 border-red-400">
          <div className="flex justify-center items-center gap-1 text-gray-600 font-semibold text-sm sm:text-base">
            <FaTimesCircle className="text-red-600" /> ยกเลิก
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-red-600">
            {filtered.filter(b => b.status === "ยกเลิก").length}
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

        {/* ResponsiveContainer สำหรับมือถือ/desktop */}
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
                formatter={(v) => (v === 0 ? "" : v)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* รายละเอียดหมอนวด */}
        <div className="mt-4 max-w-6xl mx-auto">
          <h3 className="text-lg font-semibold text-emerald-700 mb-2 text-center">จำนวนครั้งสถานะทั้งหมดต่อคน</h3>
          {/* Dropdown เลือกสถานะ */}
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

          {/* การ์ดรายหมอนวด */}
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
     </>
    )}
  </div>
  );
}
