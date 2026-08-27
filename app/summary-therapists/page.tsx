"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FaSignOutAlt,
  FaSignInAlt,
  FaFileExcel,
} from "react-icons/fa";
import {
  Menu,
  X,
  Sparkles,
  Search,
  Calendar,
  ClipboardList,
  BedDouble,
  History,
  BarChart3,
  Users,
  Building2,
  ChevronDown,
  ChevronUp,
  Facebook,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

interface TherapistRow {
  name: string; // bookings.therapist เก็บเป็นชื่อข้อความ ไม่มี id แยก
  counts: Record<string, number>; // key = YYYY-MM-DD
  total: number;
}

interface SummaryResponse {
  start: string;
  end: string;
  dates: string[];
  therapists: TherapistRow[];
  dailyTotals: Record<string, number>;
  grandTotal: number;
  error?: string;
}

// แปลง Date -> "YYYY-MM-DD" ตามเวลาท้องถิ่นของเบราว์เซอร์ (ไม่ผ่าน UTC เหมือน toISOString)
function toLocalISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// วันที่ default: 7 วันล่าสุด (รวมวันนี้)
function defaultRange() {
  const today = new Date();
  const end = toLocalISODate(today);
  const startD = new Date(today);
  startD.setDate(startD.getDate() - 6);
  const start = toLocalISODate(startD);
  return { start, end };
}

// แปลง YYYY-MM-DD -> "20 ส.ค."
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
function formatThaiDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${THAI_MONTHS_SHORT[m - 1]}`;
}

export default function SummaryTherapistsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [contactOpen, setContactOpen] = useState(false);

  const { start: defStart, end: defEnd } = defaultRange();
  const [startDate, setStartDate] = useState(defStart);
  const [endDate, setEndDate] = useState(defEnd);

  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
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

  const fetchSummary = async () => {
    if (!startDate || !endDate) {
      alert("กรุณาเลือกช่วงวันที่ให้ครบ");
      return;
    }
    if (startDate > endDate) {
      alert("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/summary-therapists?start=${startDate}&end=${endDate}`
      );
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "เกิดข้อผิดพลาด");
        setData(null);
      } else {
        setData(json);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // โหลดสรุปช่วง default ตอนเปิดหน้าครั้งแรก
  useEffect(() => {
    if (user) fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleBookingClick = () => {
    router.push("/booking");
  };

  // ---------------- Export Excel ----------------
  const handleExportExcel = async () => {
    if (!data || data.therapists.length === 0) {
      alert("ไม่มีข้อมูลสำหรับ export");
      return;
    }
    // โหลด xlsx แบบ dynamic import (ต้องติดตั้งก่อน: npm install xlsx)
    const XLSX = await import("xlsx");

    const header = [
      "ลำดับ",
      "ชื่อผู้ให้บริการ",
      ...data.dates.map((d) => formatThaiDate(d)),
      "รวม",
    ];

    const rows = data.therapists.map((t, idx) => [
      idx + 1,
      t.name,
      ...data.dates.map((d) => t.counts[d] || 0),
      t.total,
    ]);

    const totalRow = [
      "",
      "รวมทั้งหมด",
      ...data.dates.map((d) => data.dailyTotals[d] || 0),
      data.grandTotal,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows, totalRow]);
    // ปรับความกว้างคอลัมน์คร่าวๆ
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 28 },
      ...data.dates.map(() => ({ wch: 10 })),
      { wch: 10 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "สรุปรายงาน");
    XLSX.writeFile(
      workbook,
      `สรุปรายงานผู้ให้บริการ_${startDate}_ถึง_${endDate}.xlsx`
    );
  };

  const hasData = useMemo(
    () => !!data && data.therapists.length > 0,
    [data]
  );

  if (!user) {
    return <p>กำลังตรวจสอบสิทธิ์...</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-emerald-700">
      {/* Header */}
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

        <div className="flex items-center gap-3 sm:gap-3 text-xs sm:text-sm">
          {user ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-2 py-3 sm:px-4 sm:py-3 bg-red-600 text-white rounded-lg shadow font-semibold transition hover:bg-red-700 text-xs sm:text-sm"
              title="ลงชื่อออก"
            >
              <FaSignOutAlt className="w-3 h-3 sm:w-5 sm:h-5" />
              <span>ลงชื่อออก</span>
            </button>
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

      {/* Hamburger Menu */}
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

            {/* ===================== เมนูหลัก ===================== */}
            <div className="py-2">
              <div
                onClick={handleBookingClick}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>จองคิวนวดแผนไทย</span>
              </div>

              <div
                onClick={() => router.push("/booking-audit")}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer"
              >
                <ClipboardList className="w-4 h-4 text-blue-400" />
                <span>ดูคิวนวดทั้งหมด</span>
              </div>
            </div>
            <div
              onClick={() => router.push("/beds-special")}
              className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer"
            >
              <BedDouble className="w-4 h-4 text-emerald-300" />
              <span>จองเตียงพิเศษ</span>
            </div>

            {/* ===================== เจ้าหน้าที่ ===================== */}
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
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  <span>สรุปรายงาน</span>
                </div>
                <div
                  onClick={() => router.push("/summary-therapists")}
                  className="flex items-center gap-3 px-5 py-3 text-white bg-blue-600/40 transition cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-purple-100" />
                  <span>รายงานการปฎิบัติงาน</span>
                </div>
                <div
                  onClick={() => router.push("/check-que")}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer"
                >
                  <Search className="w-4 h-4 text-purple-100" />
                  <span>ค้นหาข้อมูลผู้รับบริการ</span>
                </div>
              </>
            )}

            {/* ===================== Admin ===================== */}
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

            {/* ===================== ติดต่อ ===================== */}
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

      {/* เนื้อหา */}
      <div className="max-w-6xl mx-auto p-6 pt-27">
        <h1 className="text-4xl font-extrabold text-emerald-700 mb-8 text-center drop-shadow-sm">
          สรุปรายงานการปฏิบัติงาน
        </h1>

        {/* ตัวกรองช่วงวันที่ */}
        <div className="bg-white rounded-xl shadow p-4 mb-8 flex flex-wrap items-end gap-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-600">
              วันที่เริ่มต้น
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 px-3 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-600">
              ถึงวันที่
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 px-3 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={fetchSummary}
            disabled={loading}
            className="h-10 px-6 bg-emerald-600 text-white rounded-md font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {loading ? "กำลังโหลด..." : "ค้นหา"}
          </button>

          <button
            onClick={handleExportExcel}
            disabled={!hasData}
            className="h-10 px-6 bg-green-700 text-white rounded-md font-semibold hover:bg-green-800 transition disabled:opacity-40 flex items-center gap-2"
          >
            <FaFileExcel />
            Export Excel
          </button>
        </div>

        {errorMsg && (
          <p className="text-center text-red-600 font-medium mb-4">
            {errorMsg}
          </p>
        )}

        {loading ? (
          <p className="text-center text-gray-500">กำลังโหลดข้อมูล...</p>
        ) : !hasData ? (
          <p className="text-center text-gray-500 italic">
            ไม่พบข้อมูลในช่วงวันที่ที่เลือก
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg shadow bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-emerald-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-medium sticky left-0 bg-emerald-600">
                    ลำดับ
                  </th>
                  <th className="px-4 py-3 text-left font-medium sticky left-12 bg-emerald-600">
                    ชื่อผู้ให้บริการ
                  </th>
                  {data!.dates.map((d) => (
                    <th key={d} className="px-4 py-3 text-center font-medium whitespace-nowrap">
                      {formatThaiDate(d)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-medium">รวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data!.therapists.map((t, idx) => (
                  <tr
                    key={t.name}
                    className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/50"}
                  >
                    <td className="px-4 py-2">{idx + 1}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{t.name}</td>
                    {data!.dates.map((d) => (
                      <td key={d} className="px-4 py-2 text-center">
                        {t.counts[d] ?? 0}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-center font-semibold">
                      {t.total}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-100 font-bold text-emerald-800">
                  <td className="px-4 py-3" colSpan={2}>
                    รวมทั้งหมด
                  </td>
                  {data!.dates.map((d) => (
                    <td key={d} className="px-4 py-3 text-center">
                      {data!.dailyTotals[d] ?? 0}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    {data!.grandTotal}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
