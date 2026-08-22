"use client";

import { useEffect, useState, useRef } from "react";
import { User, Phone, UserCheck, Clock, CalendarDays, BedDouble, CheckCircle2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { FaCheck, FaFacebook, FaHospital, FaHistory, FaChartBar, FaCalendarAlt, FaUsersCog, FaSpa, FaTimes, FaBars, FaSignOutAlt, FaSignInAlt } from "react-icons/fa";
import { HiChevronDown, HiChevronUp } from "react-icons/hi";
import { ImSpinner2 } from "react-icons/im";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAuth } from "@/context/AuthContext";
import BookingSummary from "@/app/BookingSummary/BookingSummary";
import { FaClipboardList } from "react-icons/fa";
import {
  Calendar as CalendarIcon,
  User as UserIcon,
  AlertCircle,
  UserX,
  Search,
  Loader2,
  Check,
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
  ChevronDown,
  ChevronUp,
  ClipboardList
} from "lucide-react";

interface Booking {
  id: number;
  provider: string;
  name: string;
  pname?: string;
  fname?: string;
  lname?: string;
  phone: string;
  therapist: string;
  time_slot: string;
  date: string;
  status: string;
  created_at: string; 
  payment_status?: string;
  has_special_bed?: number | boolean;
  bed_name?: string;
  hn?: string | null;
  has_confirmed_hn?: number | boolean;
  is_new_user_pending?: number | boolean;
}

interface Therapist {
  id: number;
  name: string;
}

const getStatusLabel = (b: Booking) => {
  return b.status || "รอดำเนินการ";
};

const getStatusColor = (b: Booking) => {
  switch (getStatusLabel(b)) {
    case "ยกเลิก": return "border-red-500";
    case "อยู่ในคิว": return "border-orange-500";
    case "สำเร็จ": return "border-emerald-500";    
    default: return "border-gray-500";
  }
};

export default function AllBookingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);
  const [showConfirmSuccess, setShowConfirmSuccess] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); 
  const [, setShowAlert] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterTherapist, setFilterTherapist] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterTimeSlot, setFilterTimeSlot] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterSpecialBed, setFilterSpecialBed] = useState(false); 
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);  
  const [summary, setSummary] = useState<{ 
        totalAttended: number; 
        totalCancelled: number; 
        totalPending: number; 
        totalInQueue: number; 
    }>({ 
        totalAttended: 0, 
        totalCancelled: 0, 
        totalPending: 0,
        totalInQueue: 0,
    });

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
    if (!filterDate) {
      setBookings([]);
      setSummary({ totalAttended: 0, totalCancelled: 0 ,totalPending: 0,totalInQueue:0 });
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/all-bookings?date=${filterDate || ""}&provider=${filterProvider || ""}&therapist=${filterTherapist || ""}&timeSlots=${filterTimeSlot || ""}&status=${filterStatus || ""}&specialBed=${filterSpecialBed}&page=${page}&limit=${limit}`
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "เกิดข้อผิดพลาด");

        setBookings(data.bookings);
        setTotalPages(data.pagination.totalPages || 1);

        if (data.summary) {
            setSummary({
             totalAttended: data.summary.totalAttended ||0 ,
             totalCancelled: data.summary.totalCancelled || 0,
             totalPending: data.summary.totalPending || 0,
             totalInQueue: data.summary.totalInQueue || 0,
            });
           }

      } catch (e: any) {
        setError(e.message || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ");
      } finally {
        setLoading(false);
      }
    })();
  }, [filterDate, filterProvider, filterTherapist, filterTimeSlot, filterStatus, filterSpecialBed, page, limit]);
      
  const handleNext = () => {
    if (page < totalPages) setPage((p) => p + 1);
  };

  const handlePrev = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const [resTherapist, resTimeSlot, resStaff] = await Promise.all([
          fetch("/api/therapists"),
          fetch("/api/time-slots"),
          fetch("/api/med-staff")
        ]);

        const dataTherapist = await resTherapist.json();
        const dataTimeSlot = await resTimeSlot.json();
        const dataStaff = await resStaff.json();

        if (dataTherapist.success) setTherapists(dataTherapist.therapists);
        if (dataTimeSlot.success) setTimeSlots(dataTimeSlot.timeSlots);
        if (dataStaff.success) setProviders(dataStaff.staff.map((s:any) => s.name));

      } catch {
        setTherapists([]); setTimeSlots([]); setProviders([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!user) {
    return <p>กำลังตรวจสอบสิทธิ์...</p>;
  }

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

  const exportToExcel = async () => { 
    if (!filterDate) return alert("กรุณาเลือกวันที่ (Date Filter) ก่อนทำการ Export");
    
    setLoading(true);

    try {
        const exportUrl = `/api/all-bookings?export=true&date=${filterDate || ""}&provider=${filterProvider || ""}&therapist=${filterTherapist || ""}&timeSlots=${filterTimeSlot || ""}&status=${filterStatus || ""}&specialBed=${filterSpecialBed}`;

        const exportRes = await fetch(exportUrl);
        const exportData = await exportRes.json();
        
        if (!exportData.success) throw new Error(exportData.error || "เกิดข้อผิดพลาดในการดึงข้อมูล Export");

        const allBookings = exportData.bookings as Booking[];
        
        if (allBookings.length === 0) {
            alert("ไม่มีข้อมูลให้ export สำหรับเงื่อนไขที่เลือก");
            return;
        }

        const finalExportData = allBookings
            .sort((a, b) => {
                const [aStart] = a.time_slot.split("-");
                const [bStart] = b.time_slot.split("-");
                const timeDiff = parseTime(aStart) - parseTime(bStart);
                if (timeDiff !== 0) return timeDiff;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });

        const paymentLabels = {
            unpaid: "เบิกได้",
            paid: "ชำระเงิน",
            UC: "สิทธิ UC"
        };
        const data = finalExportData.map(b => ({
            "ผู้ให้บริการ": b.provider,
            "ผู้มารับบริการ": b.name,
            "เบอร์โทร": b.phone,
            "หมอนวด": b.therapist,
            "วันที่": new Date(b.date).toLocaleDateString("th-TH",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Bangkok"}),
            "ช่วงเวลา": b.time_slot,
            "สถานะ": getStatusLabel(b),           
            "การชำระเงิน": paymentLabels[b.payment_status as keyof typeof paymentLabels] || "ไม่ระบุ",
          
        }));

        const ws = XLSX.utils.json_to_sheet(data);

        const columnWidths = Object.keys(data[0]).map(key => {
            const maxLength = Math.max(
              key.length,
              ...data.map((d: Record<string, any>) => (d[key] ? d[key].toString().length : 0))
            );
        
            const maxWidths: Record<string, number> = {
              "ผู้ให้บริการ": 30,
              "ผู้มารับบริการ": 30,
              "หมอนวด": 30,
              "ช่วงเวลา": 15,
              "สถานะ" : 15,
              "การชำระเงิน": 15, 
            };
        
            return { wch: Math.min(maxLength + 2, maxWidths[key] || maxLength + 2) };
          });
        
        ws['!cols'] = columnWidths;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bookings");

        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const file = new Blob([buf], { type: "application/octet-stream" });
        saveAs(file, `BookingHistory-${filterDate}.xlsx`);

    } catch (e) {
        console.error("Export Error:", e);
        alert("เกิดข้อผิดพลาดในการ Export ข้อมูล");
    } finally {
        setLoading(false);
    }
  };

  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,"0")}-${d.getDate().toString().padStart(2,"0")}`;
  };
  const normalizeTimeSlot = (time: string) => time.replace(/\s/g, '');

  const filteredBookings = bookings.filter(b => {
    const nameMatch = b.name.toLowerCase().includes(filterName.toLowerCase());
    const therapistMatch = filterTherapist === "all" || b.therapist === filterTherapist;
    const providerMatch = filterProvider === "all" || b.provider === filterProvider;
    const dateMatch = !filterDate || formatDate(b.date) === filterDate;
    const timeMatch = filterTimeSlot === "all" || normalizeTimeSlot(b.time_slot) === normalizeTimeSlot(filterTimeSlot);
    const specialBedMatch = !filterSpecialBed || !!b.has_special_bed;
    
    const statusLabel = getStatusLabel(b);

    switch(filterStatus) {
      case "upcoming": return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch && specialBedMatch && statusLabel==="รอดำเนินการ";
      case "in_queue": return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch && specialBedMatch && statusLabel==="อยู่ในคิว";
      case "past": return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch && specialBedMatch && statusLabel==="สำเร็จ";
      case "cancelled": return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch && specialBedMatch && statusLabel==="ยกเลิก";
      default: return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch && specialBedMatch;
    }
  });

  // ตรวจสอบว่าวันที่ของการจองเป็นวันข้างหน้า (อนาคต) หรือไม่
  const isFutureBookingDate = (dateStr: string) => {
    const bookingDate = new Date(dateStr);
    bookingDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return bookingDate.getTime() > today.getTime();
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

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const selectedBooking = bookings.find(b => b.id === selectedId);

  const handleBookingAction = async (action: "confirm"|"cancel") => {
    if (!selectedId) return;
    try {
      const url = action==="cancel"
        ? `/api/cancel-booking?id=${selectedId}`
        : `/api/all-bookings?confirmId=${selectedId}`;
      const method = action==="cancel" ? "DELETE" : "GET";
      const res = await fetch(url, { method });
      const data = await res.json();

      if (data.success) {
        setBookings(prev =>
          prev.map(b =>
            b.id === selectedId
              ? { ...b, status: action==="cancel" ? "ยกเลิก" : data.updatedStatus || "อยู่ในคิว" }
              : b
          )
        );
        setSelectedId(null);
        if (action==="cancel") setShowCancelSuccess(true);
        else setShowConfirmSuccess(true);
        setTimeout(() => (action === "cancel" ? setShowCancelSuccess(false) : setShowConfirmSuccess(false)), 3000);
      } else {
        alert(data.message || data.error || `เกิดข้อผิดพลาดในการ${action==="cancel"?"ยกเลิก":"ยืนยัน"}`);
      }
    } catch {
      alert(`ไม่สามารถ${action==="cancel"?"ยกเลิก":"ยืนยัน"}การจองได้`);
    }
  };

  if (error) return <p className="p-4 text-center text-red-600 font-semibold">Error: {error}</p>;

  return (
    <div className="min-h-screen px-4 sm:px-6 py-12 bg-gradient-to-br from-white to-emerald-50 relative">
      {loading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[1000]">
          <ImSpinner2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}
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

        {/* กลุ่มปุ่มขวา */}
        <div className="flex items-center gap-2  sm:gap-3 text-xs sm:text-sm">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1 sm:gap-2 px-4 sm:px-4 py-3 sm:py-3 rounded-lg bg-white text-emerald-700 font-semibold shadow text-sm sm:text-base transition hover:bg-gray-300"
            title="ส่งออก Excel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 sm:w-5 sm:h-5 text-green-600"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19 2H8a2 2 0 0 0-2 2v4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-1V2zM8 4h11v16H5V8h1v-2zM7 10h10v2H7v-2zm0 4h10v2H7v-2z"/>
            </svg>
          </button>
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
                onClick={user ? handleBookingClick : () => router.push("/booking")}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>
                  {user ? "จองคิวนวดแผนไทย" : "ดูคิวจองนวดแผนไทย"}
                </span>
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
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-purple-100" />
                  <span>รายงานการปฎิบัติงาน</span>
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

              <span className="flex-1">
                ช่องทางติดต่อ
              </span>

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
      
      <h1 className="text-3xl sm:text-4xl font-extrabold text-emerald-700 mb-8 sm:mb-12 pt-15 text-center drop-shadow-sm">
        ประวัติการจอง
      </h1>

      {/* ฟิลเตอร์ */}
      <div className="max-w-6xl mx-auto mb-4 flex flex-wrap gap-4 items-end">
        <div className="w-full sm:w-[356px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">ผู้มารับบริการ:</label>         <input 
            type="text" 
            placeholder="พิมพ์ชื่อเพื่อกรอง..." 
            value={filterName} 
            onChange={e => {setFilterName(e.target.value);setPage(1);}}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          />
        </div>

        <div className="w-full sm:w-[256px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">ผู้จองคิว</label>
          <select 
            value={filterProvider} 
            onChange={e => {setFilterProvider(e.target.value);setPage(1);}}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          >
            <option value="all">ทั้งหมด</option>
            {providers.map((t,i)=><option key={i} value={t}>{t}</option>)}            
          </select>
        </div>

        <div className="w-full sm:w-[256px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">พนักงานนวดแผนไทย:</label>
          <select 
            value={filterTherapist} 
            onChange={e => {setFilterTherapist(e.target.value);setPage(1);}}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          >
            <option value="all">ทั้งหมด</option>
            {therapists.map((t,i)=><option key={i} value={t.name}>{t.name}</option>)}
          </select>
        </div>

        <div className="w-full sm:w-[150px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">สถานะ:</label>
          <select 
            value={filterStatus} 
            onChange={e => {setFilterStatus(e.target.value);setPage(1);}}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          >
            <option value="all">ทั้งหมด</option>
            <option value="upcoming">รอดำเนินการ</option>
            <option value="in_queue">อยู่ในคิว</option>
            <option value="past">สำเร็จ</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
        </div>

        <div className="w-full sm:w-[190px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">เตียงพิเศษ:</label>
          <label className="flex items-center gap-2 h-10 px-3 border border-gray-300 rounded-md cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterSpecialBed}
              onChange={e => { setFilterSpecialBed(e.target.checked); setPage(1); }}
              className="w-4 h-4 accent-emerald-600"
            />
            <BedDouble className="w-4 h-4 text-emerald-700" />
            <span className="text-sm text-gray-700">เฉพาะคิวที่มีการจองเตียงพิเศษ</span>
          </label>
        </div>

        <div className="flex w-full sm:w-auto items-end">
          <button 
            onClick={() => {
              setFilterName(""); 
              setFilterTherapist("all"); 
              setFilterStatus("all"); 
              setFilterDate(""); 
              setFilterTimeSlot("all"); 
              setFilterProvider("all");
              setFilterSpecialBed(false);
            }}
            className="h-10 px-4 bg-emerald-600 text-white rounded-md font-semibold hover:bg-emerald-700 transition"
          >
            รีเซ็ต
          </button>
        </div>
      </div>

      {/* วันที่ + ช่วงเวลา + BookingSummary */}
      <div className="max-w-6xl mx-auto mb-5 flex flex-wrap gap-4 items-end">
        <div className="w-full sm:w-[150px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">วันที่:</label>
          <input 
            type="date" 
            value={filterDate} 
            onChange={e => {setFilterDate(e.target.value);setPage(1);}}
            className={`w-full px-4 h-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500
              ${filterDate 
                ? "border-gray-300 text-gray-900" 
                : "border-gray-300 text-gray-400"
              }`}
          />
        </div>

        <div className="w-full sm:w-[150px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">ช่วงเวลา:</label>
          <select 
            value={filterTimeSlot} 
            onChange={e => {setFilterTimeSlot(e.target.value);setPage(1);}}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          >
            <option value="all">ทั้งหมด</option>
            {timeSlots.map((slot,i)=><option key={i} value={slot}>{slot}</option>)}
          </select>
        </div>
        <div className="w-full sm:flex-1">                       
          <BookingSummary summary={summary} />
        </div>
      </div>      
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={handlePrev}
            disabled={page <= 1}
            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
          >
            ก่อนหน้า
          </button>
          <span className="text-gray-700">
            หน้า {page} / {totalPages}
          </span>
          <button
            onClick={handleNext}
            disabled={page >= totalPages}
            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
          >
            ถัดไป
          </button>
        </div>
      {filteredBookings.length === 0 ? (
        <p className="text-center text-gray-500 italic select-none">ยังไม่มีประวัติ</p>

      ) : (
        
        <ul className="space-y-4 w-full max-w-[92rem] mx-auto">
          {filteredBookings.map((b, idx) => {
            // 📌 ผู้มารับบริการรายใหม่ที่ยังไม่มี HN สมบูรณ์ (รอเจ้าหน้าที่บันทึก HN ในตาราง bookings)
            // เช็คตรงจากคอลัมน์ bookings.hn (เร็วกว่าเดิม ไม่ต้อง join med_user/new_user)
            const isPendingHN = !!b.is_new_user_pending && !b.has_confirmed_hn;
            return (
            <li
              key={b.id}
              className={`bg-white border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center border-l-8 ${getStatusColor(
                b
              )}`}
            >
              {/* เลขลำดับ */}
              <div className="flex items-center gap-2 pr-0 sm:pr-4 mb-3 sm:mb-0">
                <span className="w-8 h-8 flex items-center justify-center bg-emerald-200 text-emerald-700 font-bold rounded-full">
                  {(page - 1) * limit + idx + 1}
                </span>
              </div>
              {/* ข้อมูล */}
              <div className="grid grid-cols-1 sm:grid-cols-[200px_211px_130px_200px_120px_120px_120px] gap-y-2 sm:gap-x-6 text-gray-700 flex-grow">
                {/* ผู้ให้บริการ */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<UserCheck className="w-4 h-4" />} text="ผู้จองคิว" />
                  <span className="font-normal text-base">{b.provider}</span>
                </div>
                {/* ผู้มารับบริการ */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<User className="w-4 h-4" />} text="ผู้มารับบริการ" />
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-normal text-base">
                      {b.name}
                    </span>
                    {/* แสดง Icon เตียงพิเศษ */}
                    {Boolean(b.has_special_bed) && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300"
                        title={b.bed_name ? `เตียงพิเศษ: ${b.bed_name}` : "ใช้เตียงพิเศษ"}
                      >
                        <BedDouble className="w-3.5 h-3.5 text-emerald-700" />
                        <span>เตียงพิเศษ{b.bed_name ? ` (${b.bed_name})` : ""}</span>
                      </span>
                    )}
                    {/* ✅ ใหม่: สัญลักษณ์เตือน ยังไม่มี HN / ข้อมูลใหม่ยังไม่สมบูรณ์ (เหมือนหน้า booking) */}
                    {isPendingHN && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-300"
                        title="ผู้มารับบริการรายใหม่ ยังไม่มี HN — รอเจ้าหน้าที่บันทึกข้อมูลให้สมบูรณ์"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                        <span>รอบันทึก HN</span>
                      </span>
                    )}
                  </div>

                  {/* ปุ่ม toggle การจ่ายเงิน */}
                  <button
                    onClick={async () => {
                      // 1. กำหนด Logic การวนค่าใหม่: unpaid -> paid -> UC -> unpaid
                      const current = b.payment_status;
                      const newStatus = current === "paid" ? "UC" : current === "UC" ? "unpaid" : "paid";
                      
                      try {
                        const res = await fetch("/api/update-payment-status", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: b.id, status: newStatus }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setBookings((prev) =>
                            prev.map((x) =>
                              x.id === b.id ? { ...x, payment_status: newStatus } : x
                            )
                          );
                        } else {
                          alert("อัปเดตสถานะการจ่ายเงินไม่สำเร็จ");
                        }
                      } catch (err) {
                        alert("เกิดข้อผิดพลาด: " + err);
                      }
                    }}
                    className={`mt-1 px-2 py-1 text-xs rounded transition w-28 text-white font-bold ${
                      b.payment_status === "paid"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : b.payment_status === "UC"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-yellow-600 hover:bg-yellow-700"
                    }`}
                  >
                    {b.payment_status === "paid" ? "ชำระเงิน" : b.payment_status === "UC" ? "สิทธิ UC" : "เบิกได้"}
                  </button>

                  {/* สัญลักษณ์แสดงสถานะ */}
                  {(b.payment_status === "paid" || b.payment_status === "UC") && (
                    <span className="absolute top-0 right-0 font-bold text-lg">
                      {b.payment_status === "paid" ? "💰" : "🏥"}
                    </span>
                  )}
                 
                  {/* สัญลักษณ์ 💰 */}
                  {b.payment_status === "paid" && (
                    <span className="absolute top-0 right-0 text-emerald-600 font-bold text-lg">💰</span>
                  )}
                </div>
                {/* เบอร์โทร */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<Phone className="w-4 h-4" />} text="เบอร์โทร" />
                  <span className="font-normal text-base">
                    {b.phone}
                  </span>
                </div>
                {/* หมอนวด */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<UserCheck className="w-4 h-4" />} text="พนักงานนวด" />
                  <span className="font-normal text-base">{b.therapist}</span>
                </div>

                {/* วันที่ + เวลาที่บันทึก */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<CalendarDays className="w-4 h-4" />} text="วันที่" />
                  
                  {/* วันที่นัดหมาย */}
                  <span className="font-normal text-base">
                    {new Date(b.date).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      timeZone: "Asia/Bangkok",
                    })}
                  </span>

                  {/* วันที่บันทึกข้อมูล */}
                  <span className="text-sm text-gray-500">
                    บันทึกเมื่อ:{" "}
                    {new Date(b.created_at).toLocaleString("th-TH", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Bangkok",
                    })}
                  </span>
                </div>

                {/* ช่วงเวลา */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<Clock className="w-4 h-4" />} text="ช่วงเวลา" />
                  <span className="font-normal text-base flex items-center gap-1 flex-wrap">
                    {b.time_slot}
                    {/* ✅ ใหม่: แสดงสัญลักษณ์เตียงพิเศษ เหมือนหน้า booking */}
                    {!!b.has_special_bed && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300"
                        title={b.bed_name ? `เตียงพิเศษ: ${b.bed_name}` : "ใช้เตียงพิเศษ"}
                      >
                        <BedDouble className="w-3.5 h-3.5 text-emerald-700" />
                        <span className="hidden sm:inline">เตียงพิเศษ</span>
                      </span>
                    )}
                  </span>
                </div>

                {/* สถานะ */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<CheckCircle2 className="w-4 h-4" />} text="สถานะ" />
                  <span
                    className={`font-bold text-base ${
                      b.status === "ยกเลิก"
                        ? "text-red-600"
                        : getStatusLabel(b) === "สำเร็จ"
                        ? "text-emerald-600"
                        : getStatusLabel(b) === "อยู่ในคิว"
                        ? "text-orange-600"
                        : "text-gray-600"
                    }`}
                  >
                    {getStatusLabel(b)}
                  </span>
                </div>
              </div>

              {/* ปุ่ม action */}
              <div className="flex gap-2 mt-3 sm:mt-0">
                {getStatusLabel(b) === "ยกเลิก" && (
                  <Dialog.Root open={cancelDialogOpen && selectedId === b.id} onOpenChange={setCancelDialogOpen}>
                    <Dialog.Trigger asChild>
                      <button
                        onClick={() => {
                          setSelectedId(b.id);
                          setCancelDialogOpen(true);
                        }}
                        className="px-4 py-2 rounded-md flex items-center gap-2 bg-gray-300 hover:bg-gray-400 text-gray-600"
                      >
                        <FaTimes className="text-red-500" />
                        ยกเลิกแล้ว
                      </button>
                    </Dialog.Trigger>
                    <BookingDialog
                      title="ต้องการลบรายการนี้หรือไม่?"
                      color="red"
                      booking={selectedBooking}
                      onConfirm={async () => {
                        try {
                          const res = await fetch(`/api/all-bookings?id=${b.id}`, { method: "DELETE" });
                          const data = await res.json();
                          if (data.success) {
                            setBookings((prev) => prev.filter((x) => x.id !== b.id));
                            setSelectedId(null);
                            setShowDeleteSuccess(true);
                            setTimeout(() => setShowDeleteSuccess(false), 3000);
                          } else alert("เกิดข้อผิดพลาดในการลบรายการ");
                        } catch {
                          alert("ไม่สามารถลบรายการได้");
                        }
                      }}
                    />
                  </Dialog.Root>
                )}

      {(getStatusLabel(b) === "รอดำเนินการ" || getStatusLabel(b) === "อยู่ในคิว") && (
            <>
              {/* ✅ แสดงปุ่มเฉพาะแอดมิน (909) หรือหมอนวดที่เป็นเจ้าของ booking */}
              {(user?.role_id === 909 ||
                (b?.therapist && b?.therapist === user?.name)) && (
                <>
                  {/* ปุ่มยืนยัน */}
                    {getStatusLabel(b) === "รอดำเนินการ" && (
                      isPendingHN ? (
                        // ✅ ใหม่: ยังไม่มี HN / ข้อมูลใหม่ยังไม่สมบูรณ์ ห้ามยืนยันสำเร็จ (ปุ่มยกเลิกยังใช้งานได้ปกติ)
                        <button
                          disabled
                          title="ไม่สามารถยืนยันสถานะได้ เนื่องจากยังไม่มี HN — รอเจ้าหน้าที่บันทึกข้อมูลให้สมบูรณ์"
                          className="flex items-center justify-center w-15 h-10 bg-gray-300 rounded-md shadow cursor-not-allowed"
                        >
                          <FaCheck className="text-gray-400 w-5 h-5" />
                        </button>
                      ) : isFutureBookingDate(b.date) ? (
                        // หากยังไม่ถึงวันนัด ให้ disable ปุ่มไว้
                        <button
                          disabled
                          title="ไม่สามารถยืนยันสถานะได้ เนื่องจากยังไม่ถึงวันนัดหมาย"
                          className="flex items-center justify-center w-15 h-10 bg-gray-300 rounded-md shadow cursor-not-allowed"
                        >
                          <FaCheck className="text-gray-400 w-5 h-5" />
                        </button>
                      ) : (
                        // เมื่อถึงวันนัดหมายแล้ว หรือวันในอดีต ทำงานตาม Logic เดิมปกติ
                        <Dialog.Root>
                          <Dialog.Trigger asChild>
                            <button
                              onClick={() => setSelectedId(b.id)}
                              className="flex items-center justify-center w-15 h-10 bg-emerald-600 rounded-md shadow hover:bg-emerald-700 transition"
                            >
                              <FaCheck className="text-white w-5 h-5" />
                            </button>
                          </Dialog.Trigger>
                          <BookingDialog
                            title="ต้องการยืนยันรายการนี้หรือไม่?"
                            color="emerald"
                            booking={b}
                            onConfirm={() => handleBookingAction("confirm")}
                          />
                        </Dialog.Root>
                      )
                    )}

                  {/* ปุ่มยกเลิก */}
                  {/* ✅ ใหม่: ถ้าคิวนี้มีการจองเตียงพิเศษแล้ว ห้ามยกเลิกการให้บริการช่วงเวลานั้น */}
                  {b.has_special_bed ? (
                    <button
                      disabled
                      title={
                        b.bed_name
                          ? `ไม่สามารถยกเลิกได้ เนื่องจากมีการจองเตียงพิเศษ (${b.bed_name}) ไว้แล้ว`
                          : "ไม่สามารถยกเลิกได้ เนื่องจากมีการจองเตียงพิเศษไว้แล้ว"
                      }
                      className="flex items-center justify-center w-15 h-10 bg-gray-300 rounded-md shadow cursor-not-allowed"
                    >
                      <BedDouble className="text-gray-500 w-5 h-5" />
                    </button>
                  ) : (
                    <Dialog.Root>
                      <Dialog.Trigger asChild>
                        <button
                          onClick={() => setSelectedId(b.id)}
                          className="flex items-center justify-center w-15 h-10 bg-red-500 rounded-md shadow hover:bg-red-600 transition"
                        >
                          <FaTimes className="text-white w-5 h-5" />
                        </button>
                      </Dialog.Trigger>
                      <BookingDialog
                        title="ต้องการยกเลิกรายการนี้หรือไม่?"
                        color="red"
                        booking={b}
                        onConfirm={() => handleBookingAction("cancel")}
                      />
                    </Dialog.Root>
                  )}
                </>
              )}
            </>
      )}

                {getStatusLabel(b) === "สำเร็จ" && (
                  <button
                    disabled
                    className="px-4 py-2 rounded-md text-gray-600 flex items-center gap-2 bg-gray-300"
                  >
                    <FaCheck className="text-emerald-600" />
                    สำเร็จแล้ว
                  </button>
                )}
              </div>
            </li>
          );})}
        </ul>
      )}

      <AnimatePresence>
        {showCancelSuccess && <Toast key="cancel" message="ยกเลิกการจองสำเร็จ" />}
        {showConfirmSuccess && <Toast key="confirm" message="ยืนยันการจองสำเร็จ" />}
        {showDeleteSuccess && <Toast key="delete" message="ลบรายการสำเร็จ" />}
      </AnimatePresence>

    <div className="flex justify-center items-center gap-4 mt-6">
      <button
        onClick={handlePrev}
        disabled={page <= 1}
        className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
      >
        ก่อนหน้า
      </button>
      <span className="text-gray-700">
        หน้า {page} / {totalPages}
      </span>
      <button
        onClick={handleNext}
        disabled={page >= totalPages}
        className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
      >
        ถัดไป
      </button>
    </div>
    </div>
    
  );
}



function Label({ icon, text }: { icon: React.ReactNode, text: string }) {
  return <div className="flex items-center gap-1 text-emerald-700 font-medium text-sm">{icon} {text}</div>;
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg z-50">{message}</div>
  );
}

function BookingDialog({ title, color, booking, onConfirm }: any) {
  if (!booking) return null;
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40"/>
      <Dialog.Content asChild>
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-xl shadow-lg z-50 w-96">
          <Dialog.Title className={`text-xl font-bold text-${color}-600 mb-4`}>{title}</Dialog.Title>
          <div className="mb-4 text-sm grid grid-cols-1 gap-2">
            {[
              {icon:<UserCheck className="w-5 h-5 text-emerald-700"/>, label:"ผู้ให้บริการ", value:booking.provider},
              {icon:<User className="w-5 h-5 text-emerald-700"/>, label:"ชื่อ", value:booking.name},
              {icon:<Phone className="w-5 h-5 text-emerald-700"/>, label:"เบอร์โทร", value:booking.phone},
              {icon:<UserCheck className="w-5 h-5 text-emerald-700"/>, label:"หมอนวด", value:booking.therapist},
              {icon:<CalendarDays className="w-5 h-5 text-emerald-700"/>, label:"วันที่", value:new Date(booking.date).toLocaleDateString("th-TH",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Bangkok"})},
              {icon:<Clock className="w-5 h-5 text-emerald-700"/>, label:"ช่วงเวลา", value:booking.time_slot},
            ].map((item,i)=>(
              <div key={`${booking.id}-${i}`} className="flex items-center gap-2 p-2 rounded-md border border-gray-200">
                {item.icon}<span className="font-medium text-emerald-700">{item.label}:</span>
                <span className="ml-auto font-semibold text-emerald-700">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-4">
            <Dialog.Close asChild><button className="px-4 py-2 rounded-md bg-gray-500 hover:bg-gray-600 transition">ยกเลิก</button></Dialog.Close>
            <button onClick={onConfirm} className={`px-4 py-2 rounded-md bg-${color}-600 text-white hover:bg-${color}-700 transition`}>ยืนยัน</button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}