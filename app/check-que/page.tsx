"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FaSignOutAlt,
  FaSignInAlt,
} from "react-icons/fa";
import {
  Menu,
  X,
  Sparkles,
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
  Search,
  User,
  Phone,
  Clock,
  UserCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

// ---------------- Types ----------------
interface SearchResult {
  id: number;
  hn: string;
  name: string;
  phone: string;
}

interface Patient {
  id: number;
  hn: string;
  name: string;
  phone: string;
  isDeceased: boolean;
}

interface HistoryRow {
  id: number;
  date: string; // "YYYY-MM-DD"
  time_slot: string;
  therapist: string;
  status: string;
  payment_status: string;
  provider?: string;
  hasSpecialBed?: boolean;
  bedCode?: string | null;
  bedName?: string | null;
  roomName?: string | null;
}

// แปลง YYYY-MM-DD -> "29 สิงหาคม 2569" (พ.ศ.) — ไม่ผ่าน Date object/toISOString
// เพื่อกัน timezone bug แบบเดียวกับที่แก้ไว้ในหน้าอื่นๆ ของระบบนี้
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
function formatThaiDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

// สีป้ายสถานะ ให้เข้าชุดกับหน้า all-bookings เดิมของระบบ
function getStatusBadgeClass(status: string) {
  switch (status) {
    case "สำเร็จ":
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "ยกเลิก":
      return "bg-red-100 text-red-800 border-red-300";
    case "อยู่ในคิว":
      return "bg-orange-100 text-orange-800 border-orange-300";
    default:
      return "bg-gray-100 text-gray-700 border-gray-300";
  }
}

function getPaymentLabel(paymentStatus: string) {
  switch (paymentStatus) {
    case "paid":
      return { text: "ชำระเงิน", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    case "UC":
      return { text: "สิทธิ UC", cls: "bg-blue-100 text-blue-800 border-blue-300" };
    default:
      return { text: "เบิกได้", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  }
}

export default function CheckQuePage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [contactOpen, setContactOpen] = useState(false);

  // ---------------- ค้นหา / ผลลัพธ์ ----------------
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);

  // ---------------- รายละเอียดผู้รับบริการที่เลือก ----------------
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [currentHn, setCurrentHn] = useState<string | null>(null);

  // ---------------- แบ่งหน้าประวัติ ----------------
  const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalHistory, setTotalHistory] = useState(0);

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

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleBookingClick = () => {
    router.push("/booking");
  };

  // ---------------- โหลดรายละเอียด + ประวัติ ของ HN ที่เลือก (รองรับแบ่งหน้า) ----------------
  const loadPatientDetail = async (hn: string, targetPage: number = 1, targetLimit: number = limit) => {
    setLoadingDetail(true);
    setDetailError(null);
    setCurrentHn(hn);
    try {
      const res = await fetch(
        `/api/check-que?hn=${encodeURIComponent(hn)}&page=${targetPage}&limit=${targetLimit}`
      );
      const json = await res.json();
      if (!json.success) {
        setDetailError(json.error || "ไม่พบข้อมูล");
        setPatient(null);
        setHistory([]);
        return;
      }
      setPatient(json.patient);
      setHistory(json.history || []);
      setPage(json.pagination?.page || targetPage);
      setLimit(json.pagination?.limit || targetLimit);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalHistory(json.pagination?.total || 0);
    } catch (err) {
      console.error(err);
      setDetailError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setPatient(null);
      setHistory([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  // เปลี่ยนหน้า (คงจำนวนต่อหน้าเดิม)
  const handleChangePage = (newPage: number) => {
    if (!currentHn || newPage < 1 || newPage > totalPages || newPage === page) return;
    loadPatientDetail(currentHn, newPage, limit);
  };

  // เปลี่ยนจำนวนแถวต่อหน้า (กลับไปหน้า 1 เสมอ)
  const handleChangeLimit = (newLimit: number) => {
    if (!currentHn) {
      setLimit(newLimit);
      return;
    }
    loadPatientDetail(currentHn, 1, newLimit);
  };

  // ---------------- ค้นหา ----------------
  const handleSearch = async () => {
    const kw = keyword.trim();
    if (!kw) {
      setSearchError("กรุณากรอกชื่อ-สกุล หรือ HN ที่ต้องการค้นหา");
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    setPatient(null);
    setHistory([]);
    setDetailError(null);
    setCurrentHn(null);
    setPage(1);
    setTotalPages(1);
    setTotalHistory(0);

    try {
      const res = await fetch(`/api/check-que?keyword=${encodeURIComponent(kw)}`);
      const json = await res.json();
      if (!json.success) {
        setSearchError(json.error || "เกิดข้อผิดพลาดในการค้นหา");
        setSearchResults([]);
        return;
      }

      const results: SearchResult[] = json.results || [];
      setSearchResults(results);

      // ถ้าพบพอดี 1 คน ให้โหลดรายละเอียดให้ทันที ไม่ต้องให้กดเลือกซ้ำ
      if (results.length === 1) {
        await loadPatientDetail(results[0].hn);
      }
    } catch (err) {
      console.error(err);
      setSearchError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (hn: string) => {
    loadPatientDetail(hn);
  };

  const handleBackToResults = () => {
    setPatient(null);
    setHistory([]);
    setDetailError(null);
    setCurrentHn(null);
    setPage(1);
    setTotalPages(1);
    setTotalHistory(0);
  };

  if (!user) {
    return <p>กำลังตรวจสอบสิทธิ์...</p>;
  }

  const showResultList =
    !patient && !loadingDetail && searchResults !== null && searchResults.length > 1;

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
              <div
                onClick={() => router.push("/beds-special")}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer"
              >
                <BedDouble className="w-4 h-4 text-emerald-300" />
                <span>จองเตียงพิเศษ</span>
              </div>
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
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  <span>รายงานการปฎิบัติงาน</span>
                </div>
                {/* ✅ ใหม่: เมนูหน้าค้นหาข้อมูลผู้รับบริการ (ไฮไลต์ว่าอยู่หน้านี้) */}
                <div
                  onClick={() => router.push("/check-que")}
                  className="flex items-center gap-3 px-5 py-3 text-white bg-blue-600/40 transition cursor-pointer"
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
      <div className="max-w-5xl mx-auto p-6 pt-27">
        <h1 className="text-4xl font-extrabold text-emerald-700 mb-8 text-center drop-shadow-sm">
          ค้นหาข้อมูลผู้รับบริการ
        </h1>

        {/* ---------------- ช่องค้นหา ---------------- */}
        <div className="bg-white rounded-xl shadow p-4 mb-8 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[240px]">
            <label className="block mb-1 text-sm font-medium text-gray-600">
              ชื่อ-สกุล, HN หรือเบอร์โทรศัพท์
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="กรอกชื่อ-สกุล, HN หรือเบอร์โทรศัพท์ แล้วกดค้นหา"
              className="w-full h-10 px-3 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={searching}
            className="h-10 px-6 bg-emerald-600 text-white rounded-md font-semibold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {searching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> กำลังค้นหา...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" /> ค้นหา
              </>
            )}
          </button>
        </div>

        {searchError && (
          <p className="text-center text-red-600 font-medium mb-4">{searchError}</p>
        )}

        {/* ---------------- รายชื่อที่พบ (กรณีเจอมากกว่า 1 คน) ---------------- */}
        {showResultList && (
          <div className="bg-white rounded-xl shadow p-4 mb-8">
            <p className="text-sm text-gray-600 mb-3">
              พบข้อมูล {searchResults!.length} รายการ กรุณาเลือกผู้รับบริการที่ต้องการ
            </p>
            <ul className="divide-y divide-gray-200">
              {searchResults!.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => handleSelectResult(r.hn)}
                    className="w-full flex justify-between items-center px-3 py-3 hover:bg-emerald-50 rounded-md text-left transition"
                  >
                    <span className="flex items-center gap-2 font-medium text-gray-800">
                      <User className="w-4 h-4 text-emerald-600" />
                      {r.name}
                      <span className="text-xs text-gray-500 font-normal">HN: {r.hn}</span>
                    </span>
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {r.phone || "ไม่มีเบอร์"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {searchResults !== null && searchResults.length === 0 && !searching && (
          <p className="text-center text-gray-500 italic mb-8">
            ไม่พบผู้รับบริการที่ตรงกับคำค้นหา
          </p>
        )}

        {/* ---------------- กำลังโหลดรายละเอียด ---------------- */}
        {loadingDetail && (
          <p className="text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลดข้อมูล...
          </p>
        )}

        {detailError && !loadingDetail && (
          <p className="text-center text-red-600 font-medium mb-4">{detailError}</p>
        )}

        {/* ---------------- รายละเอียดผู้รับบริการ + ประวัติ ---------------- */}
        {patient && !loadingDetail && (
          <div className="space-y-6">
            {/* ปุ่มย้อนกลับไปเลือกคนอื่น (แสดงเฉพาะตอนค้นหาแล้วเจอหลายคน) */}
            {searchResults && searchResults.length > 1 && (
              <button
                onClick={handleBackToResults}
                className="flex items-center gap-2 text-emerald-700 font-medium hover:underline"
              >
                <ArrowLeft className="w-4 h-4" /> กลับไปเลือกรายชื่ออื่น
              </button>
            )}

            {/* การ์ดข้อมูลผู้รับบริการ */}
            <div className="bg-white rounded-xl shadow p-5">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-600" />
                  <span className="font-semibold text-gray-800">{patient.name}</span>
                  {patient.isDeceased && (
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600 border border-gray-300">
                      เสียชีวิตแล้ว
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="font-semibold text-emerald-600">HN:</span> {patient.hn}
                </div>
                {patient.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4 text-emerald-600" /> {patient.phone}
                  </div>
                )}
              </div>
            </div>

            {/* ตารางประวัติ */}
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <div className="px-5 pt-4 pb-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-bold text-lg text-emerald-700">
                    ประวัติการนัดหมาย/รับบริการ ({totalHistory} รายการ)
                  </h2>
                </div>
                {totalHistory > 0 && (
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    แสดงต่อหน้า
                    <select
                      value={limit}
                      onChange={(e) => handleChangeLimit(Number(e.target.value))}
                      className="h-8 px-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {PAGE_SIZE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {totalHistory === 0 ? (
                <p className="text-center text-gray-500 italic py-6">
                  ยังไม่มีประวัติการนัดหมาย/รับบริการ
                </p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-emerald-600 text-white">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">วันที่</th>
                      <th className="px-4 py-3 text-left font-medium">ช่วงเวลา</th>
                      <th className="px-4 py-3 text-left font-medium">ผู้ให้บริการ</th>
                      <th className="px-4 py-3 text-center font-medium">เตียงพิเศษ</th>
                      <th className="px-4 py-3 text-center font-medium">สถานะ</th>
                      <th className="px-4 py-3 text-center font-medium">การชำระเงิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {history.map((h, idx) => {
                      const payment = getPaymentLabel(h.payment_status);
                      return (
                        <tr key={h.id} className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/50"}>
                          <td className="px-4 py-2 whitespace-nowrap flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                            {formatThaiDate(h.date)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-emerald-500" />
                              {h.time_slot}
                            </span>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                              {h.therapist}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            {h.hasSpecialBed ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border bg-emerald-100 text-emerald-800 border-emerald-300"
                                title={
                                  h.roomName || h.bedName || h.bedCode
                                    ? `เตียงพิเศษ${h.bedName ? `: ${h.bedName}` : ""}${h.bedCode ? ` (${h.bedCode})` : ""}${h.roomName ? ` — ห้อง ${h.roomName}` : ""}`
                                    : "ใช้เตียงพิเศษ"
                                }
                              >
                                <BedDouble className="w-3.5 h-3.5 text-emerald-700" />
                                {h.bedName || h.bedCode || "เตียงพิเศษ"}
                                {h.roomName ? ` (ห้อง ${h.roomName})` : ""}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border ${getStatusBadgeClass(
                                h.status
                              )}`}
                            >
                              {h.status === "สำเร็จ" ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : h.status === "ยกเลิก" ? (
                                <XCircle className="w-3.5 h-3.5" />
                              ) : null}
                              {h.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border ${payment.cls}`}
                            >
                              {payment.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* ---------------- ควบคุมแบ่งหน้า ---------------- */}
              {totalHistory > 0 && totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-gray-200">
                  <span className="text-sm text-gray-500">
                    หน้า {page} จาก {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleChangePage(page - 1)}
                      disabled={page <= 1 || loadingDetail}
                      className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      ก่อนหน้า
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      // แสดงเลขหน้าแบบย่อ: หน้าแรก/สุดท้าย + 2 หน้ารอบๆ หน้าปัจจุบัน
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === totalPages ||
                          Math.abs(p - page) <= 1
                      )
                      .reduce((acc: (number | "...")[], p, idx, arr) => {
                        if (idx > 0 && typeof arr[idx - 1] === "number" && p - (arr[idx - 1] as number) > 1) {
                          acc.push("...");
                        }
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) =>
                        p === "..." ? (
                          <span key={`ellipsis-${idx}`} className="px-2 text-sm text-gray-400">
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => handleChangePage(p as number)}
                            disabled={loadingDetail}
                            className={`px-3 py-1.5 text-sm rounded-md border ${
                              p === page
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "border-gray-300 text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}
                    <button
                      onClick={() => handleChangePage(page + 1)}
                      disabled={page >= totalPages || loadingDetail}
                      className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
