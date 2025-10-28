"use client";

import { useEffect, useState, useRef } from "react";
import { User, Phone, UserCheck, Clock, CalendarDays, CheckCircle2, Smile, Frown } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { FaCheck, FaFacebook, FaHospital, FaHistory, FaChartBar, FaCalendarAlt, FaUsersCog, FaSpa, FaTimes, FaBars, FaSignOutAlt, FaSignInAlt } from "react-icons/fa";
import { HiChevronDown, HiChevronUp } from "react-icons/hi";
import { ImSpinner2 } from "react-icons/im";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAuth } from "@/context/AuthContext";

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
  created_at: string; // หรือ Date ถ้า parse เป็น Date แล้ว
  payment_status?: string;
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

interface SummaryProps { attended: Booking[]; cancelled: Booking[]; }

function BookingSummary({ summary }: { summary: { totalAttended: number; totalCancelled: number } }) {
  const { totalAttended, totalCancelled } = summary;
  const total = totalAttended + totalCancelled;
  const attendedPercent = total ? Math.round((totalAttended / total) * 100) : 0;
  const cancelledPercent = total ? 100 - attendedPercent : 0;
  
//function BookingSummary({ attended, cancelled }: SummaryProps) {
//  const totalAttended = attended.length;
//  const totalCancelled = cancelled.length;
//  const total = totalAttended + totalCancelled;
//  const attendedPercent = total ? Math.round((totalAttended / total) * 100) : 0;
//  const cancelledPercent = total ? 100 - attendedPercent : 0;
  
  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-3">
      <div
        className="flex items-center gap-4 bg-emerald-50 text-emerald-900 rounded-xl p-4 shadow-sm border-2 border-emerald-200 w-full sm:min-w-[396px]"
      >
        <Smile className="w-12 h-10 text-emerald-500 flex-shrink-0" />
        <div className="flex flex-col flex-grow justify-center">
          <div className="flex justify-center items-baseline gap-2">
            <span className="text-lg text-emerald-700">มานวด :</span>
            <span className="text-lg font-bold">{totalAttended} คน</span>
          </div>
          <div className="w-full h-4 bg-emerald-200 rounded-full mt-2 relative overflow-hidden">
            <motion.div
              className="h-full bg-emerald-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${attendedPercent}%` }}
              transition={{ duration: 1 }}
            />
            <div className="absolute inset-0 flex justify-center items-center text-white font-semibold text-xs">
              {attendedPercent}%
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex items-center gap-4 bg-red-50 text-red-900 rounded-xl p-4 shadow-sm border-2 border-red-200 w-full sm:min-w-[397px]"
      >
        <Frown className="w-12 h-10 text-red-500 flex-shrink-0" />
        <div className="flex flex-col flex-grow justify-center">
          <div className="flex justify-center items-baseline gap-2">
            <span className="text-lg text-red-700">ไม่มานวด :</span>
            
            <span className="text-lg font-bold">{totalCancelled} คน</span>
          </div>
          <div className="w-full h-4 bg-red-200 rounded-full mt-2 relative overflow-hidden">
            <motion.div
              className="h-full bg-red-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${cancelledPercent}%` }}
              transition={{ duration: 1 }}
            />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-semibold text-xs">
              {cancelledPercent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AllBookingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [therapists, setTherapists] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);
  const [showConfirmSuccess, setShowConfirmSuccess] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingPnameValue, setEditingPnameValue] = useState("");
  const [editingFnameValue, setEditingFnameValue] = useState("");
  const [editingLnameValue, setEditingLnameValue] = useState("");
  const [editingPhoneId, setEditingPhoneId] = useState<number | null>(null);
  const [editingPhoneValue, setEditingPhoneValue] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false); // state สำหรับ hamburger
  const [, setShowAlert] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterTherapist, setFilterTherapist] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterTimeSlot, setFilterTimeSlot] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);  const [summary, setSummary] = useState<{ totalAttended: number; totalCancelled: number }>({  totalAttended: 0,  totalCancelled: 0, });

  
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
    setPage(1);
  }, [filterDate, filterProvider, filterStatus]);


  useEffect(() => {
  //if (!filterDate) { setBookings([]); return; }
  if (!filterDate) {
  setBookings([]);
  setSummary({ totalAttended: 0, totalCancelled: 0 });
  return;
  }

  setLoading(true);
  (async () => {
    try {
      const res = await fetch(
        `/api/all-bookings?date=${filterDate || ""}&provider=${filterProvider || ""}&status=${filterStatus || ""}&page=${page}&limit=${limit}`
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "เกิดข้อผิดพลาด");

      setBookings(data.bookings);
      setTotalPages(data.pagination.totalPages || 1);

      if (data.summary) {
        setSummary({
          totalAttended: data.summary.totalAttended,
          totalCancelled: data.summary.totalCancelled,
        });
      }
    } catch (e: any) {
      setError(e.message || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ");
    } finally {
      setLoading(false);
    }
  })();
}, [filterDate, filterProvider, filterStatus, page, limit]);
    
   //////////
    

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
    return <p>กำลังตรวจสอบสิทธิ์...</p>; // render ชั่วคราว
  }

const exportToExcel = () => {
  // กรองเฉพาะวันที่ที่เลือก
  const filteredData = bookings
    .filter(b => formatDate(b.date) === filterDate)
    // sort: time_slot จากน้อยไปมาก + create_at ใหม่สุดล่าง
    .sort((a, b) => {
      const [aStart] = a.time_slot.split("-");
      const [bStart] = b.time_slot.split("-");
      const timeDiff = parseTime(aStart) - parseTime(bStart);
      if (timeDiff !== 0) return timeDiff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  if (filteredData.length === 0) return alert("ไม่มีข้อมูลให้ export สำหรับวันที่นี้");

  // แปลงข้อมูล
  const data = filteredData.map(b => ({
    "ผู้ให้บริการ": b.provider,
    "ผู้มารับบริการ": b.name,
    "เบอร์โทร": b.phone,
    "หมอนวด": b.therapist,
    "วันที่": new Date(b.date).toLocaleDateString("th-TH",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Bangkok"}),
    "ช่วงเวลา": b.time_slot,
    "สถานะ": getStatusLabel(b),
    "การชำระเงิน": b.payment_status === "paid" ? "ชำระเงิน" : "เบิกได้",
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
      "สถานะการชำระเงิน": 15,
    };

    return { wch: Math.min(maxLength + 2, maxWidths[key] || maxLength + 2) };
  });

  ws['!cols'] = columnWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bookings");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const file = new Blob([buf], { type: "application/octet-stream" });
  saveAs(file, `BookingHistory-${filterDate}.xlsx`);
};

// ฟังก์ชันช่วยแปลง "HH:MM" เป็นนาที
const parseTime = (timeStr: string) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,"0")}-${d.getDate().toString().padStart(2,"0")}`;
  };

  const filteredBookings = bookings.filter(b => {
    const nameMatch = b.name.toLowerCase().includes(filterName.toLowerCase());
    const therapistMatch = filterTherapist === "all" || b.therapist === filterTherapist;
    const providerMatch = filterProvider === "all" || b.provider === filterProvider;
    const dateMatch = !filterDate || formatDate(b.date) === filterDate;
    const timeMatch = filterTimeSlot === "all" || b.time_slot === filterTimeSlot;
    const statusLabel = getStatusLabel(b);

    switch(filterStatus) {
      case "upcoming": return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch && statusLabel==="รอดำเนินการ";
      case "in_queue": return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch && statusLabel==="อยู่ในคิว";
      case "past": return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch && statusLabel==="สำเร็จ";
      case "cancelled": return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch && statusLabel==="ยกเลิก";
      default: return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch;
    }
  });

const attendedKeys = new Set<string>();
const cancelledKeys = new Set<string>();

bookings.forEach(b => {
  if (filterDate && formatDate(b.date) !== filterDate) return; // กรองตามวันที่ก่อน

  const key = `${b.name}-${formatDate(b.date)}`;
  const status = getStatusLabel(b);

  if (status === "สำเร็จ") {
    attendedKeys.add(key);  // มานวด
  } else if (status === "ยกเลิก" && !attendedKeys.has(key)) {
    cancelledKeys.add(key); // ไม่มานวด
  }
});

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

const attendedBookings = Array.from(attendedKeys).map(k => {
  const [name, date] = k.split("-");
  return bookings.find(b => b.name === name && formatDate(b.date) === date)!;
});

const cancelledBookings = Array.from(cancelledKeys).map(k => {
  const [name, date] = k.split("-");
  return bookings.find(b => b.name === name && formatDate(b.date) === date)!;
});

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
        alert(`เกิดข้อผิดพลาดในการ${action==="cancel"?"ยกเลิก":"ยืนยัน"}`);
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
          className="fixed top-0 left-0 w-64 h-full bg-black/70 z-40 flex flex-col pt-15 overflow-y-auto"
          >
            {/* แถบเมนูแต่ละรายการ */}
            <div
              onClick={user ? handleBookingClick : () => router.push("/booking")}
              className="w-full py-3 sm:py-4 px-4 sm:px-6 border-b-1 border-gray-400 cursor-pointer hover:bg-white/20 flex items-center justify-center gap-2 text-sm sm:text-lg font-semibold text-white"
            >
              <FaCalendarAlt /> {user ? "จองคิวนวดแผนไทย" : "ดูคิวจองนวดแผนไทย"}
            </div>
            {user && (
              <>
                <div
                  onClick={() => router.push("/all-bookings")}
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
                    href="https://m.me/100070719421986"
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
      <h1 className="text-3xl sm:text-4xl font-extrabold text-emerald-700 mb-8 sm:mb-12 pt-15 text-center drop-shadow-sm">
        ประวัติการจอง
      </h1>

      {/* ฟิลเตอร์ */}
      <div className="max-w-6xl mx-auto mb-4 flex flex-wrap gap-4 items-end">
        <div className="w-full sm:w-[356px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">ผู้มารับบริการ:</label>
          <input 
            type="text" 
            placeholder="พิมพ์ชื่อเพื่อกรอง..." 
            value={filterName} 
            onChange={e => setFilterName(e.target.value)}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          />
        </div>

        <div className="w-full sm:w-[256px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">ผู้ให้บริการ:</label>
          <select 
            value={filterProvider} 
            onChange={e => setFilterProvider(e.target.value)}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          >
            <option value="all">ทั้งหมด</option>
            {providers.map((t,i)=><option key={i} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="w-full sm:w-[256px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">หมอนวด:</label>
          <select 
            value={filterTherapist} 
            onChange={e => setFilterTherapist(e.target.value)}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          >
            <option value="all">ทั้งหมด</option>
            {therapists.map((t,i)=><option key={i} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="w-full sm:w-[150px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">สถานะ:</label>
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          >
            <option value="all">ทั้งหมด</option>
            <option value="upcoming">รอดำเนินการ</option>
            <option value="in_queue">อยู่ในคิว</option>
            <option value="past">สำเร็จ</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
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
            onChange={e => setFilterDate(e.target.value)}
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
            onChange={e => setFilterTimeSlot(e.target.value)}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          >
            <option value="all">ทั้งหมด</option>
            {timeSlots.map((slot,i)=><option key={i} value={slot}>{slot}</option>)}
          </select>
        </div>
        <div className="w-full sm:flex-1">
          <BookingSummary attended={totalAttended} cancelled={totalCancelled} />
        </div>
      </div>      
      {filteredBookings.length === 0 ? (
        <p className="text-center text-gray-500 italic select-none">ยังไม่มีประวัติ</p>
      ) : (
        
        <ul className="space-y-4 w-full max-w-[92rem] mx-auto">
          {filteredBookings.map((b, idx) => (
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
                  <Label icon={<UserCheck className="w-4 h-4" />} text="ผู้ให้บริการ" />
                  <span className="font-normal text-base">{b.provider}</span>
                </div>
                {/* ผู้มารับบริการ */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<User className="w-4 h-4" />} text="ผู้มารับบริการ" />
                  {editingNameId === b.id ? (
                    <div className="flex flex-col gap-1">
                      {/* Input 3 ช่อง */}
                      <div className="flex flex-col sm:flex-row gap-1">
                        <input
                          placeholder="คำนำหน้า"
                          value={editingPnameValue}
                          onChange={(e) => setEditingPnameValue(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded-md text-gray-900 w-19"
                          autoFocus
                        />
                        <input
                          placeholder="ชื่อจริง"
                          value={editingFnameValue}
                          onChange={(e) => setEditingFnameValue(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded-md text-gray-900 w-19"
                        />
                        <input
                          placeholder="นามสกุล"
                          value={editingLnameValue}
                          onChange={(e) => setEditingLnameValue(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded-md text-gray-900 w-19"
                        />
                      </div>
                      {/* ปุ่มยืนยัน/ยกเลิก */}
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={async () => {
                            // รวม pname+fname ติดกัน ตามด้วย lname
                            const fullName = [editingPnameValue + editingFnameValue, editingLnameValue]
                              .filter(Boolean)
                              .join(" ");

                            if (
                              fullName &&
                              (editingPnameValue !== b.pname ||
                              editingFnameValue !== b.fname ||
                              editingLnameValue !== b.lname)
                            ) {
                              try {
                                const res = await fetch(`/api/update-booking-name`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    id: b.id,
                                    pname: editingPnameValue,
                                    fname: editingFnameValue,
                                    lname: editingLnameValue,
                                  }),
                                });
                                const data = await res.json();
                                if (data.success) {
                                  // แสดง fullname หลังอัปเดต
                                  setBookings((prev) =>
                                    prev.map((x) =>
                                      x.id === b.id
                                        ? {
                                            ...x,
                                            name: fullName,
                                            pname: editingPnameValue,
                                            fname: editingFnameValue,
                                            lname: editingLnameValue,
                                          }
                                        : x
                                    )
                                  );
                                } else {
                                  alert("ไม่สามารถอัปเดตชื่อได้: " + data.error);
                                }
                              } catch (err) {
                                alert("เกิดข้อผิดพลาด: " + err);
                              }
                            }
                            setEditingNameId(null);
                          }}
                          className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
                        >
                          ยืนยัน
                        </button>

                        <button
                          onClick={() => setEditingNameId(null)}
                          className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="font-normal text-base cursor-pointer"
                      onClick={() => {
                        setEditingNameId(b.id);
                        // แสดงข้อมูลเดิมก่อนแก้ไข
                        setEditingPnameValue(b.pname ?? "");
                        setEditingFnameValue(b.fname ?? "");
                        setEditingLnameValue(b.lname ?? "");
                      }}
                    >
                      {b.name}
                    </span>
                  )}
                  {/* ปุ่ม toggle การจ่ายเงิน */}
                  <button
                    onClick={async () => {
                      const newStatus = b.payment_status === "paid" ? "unpaid" : "paid";
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
                    className={`mt-1 px-2 py-1 text-xs rounded transition w-28 ${
                      b.payment_status === "paid"
                        ? "bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                        : "bg-yellow-600 text-white font-bold hover:bg-yellow-700"
                    }`}
                  >
                    {b.payment_status === "paid" ? "ชำระเงิน" : "เบิกได้"}
                  </button>

                  {/* สัญลักษณ์ 💰 */}
                  {b.payment_status === "paid" && (
                    <span className="absolute top-0 right-0 text-emerald-600 font-bold text-lg">💰</span>
                  )}
                </div>
                {/* เบอร์โทร */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<Phone className="w-4 h-4" />} text="เบอร์โทร" />
                  {editingPhoneId === b.id ? (
                    <div className="flex flex-col gap-1">
                      <input
                        value={editingPhoneValue}
                        onChange={(e) => setEditingPhoneValue(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded-md text-gray-900 w-32"
                        autoFocus
                      />
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={async () => {
                            if (editingPhoneValue && editingPhoneValue !== b.phone) {
                              try {
                                const res = await fetch("/api/update-booking-phone", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    id: b.id,
                                    phone: editingPhoneValue,
                                  }),
                                });
                                const data = await res.json();
                                if (data.success) {
                                  setBookings((prev) =>
                                    prev.map((x) =>
                                      x.id === b.id ? { ...x, phone: editingPhoneValue } : x
                                    )
                                  );
                                } else {
                                  alert("ไม่สามารถอัปเดตเบอร์โทรได้: " + data.error);
                                }
                              } catch (err) {
                                alert("เกิดข้อผิดพลาด: " + err);
                              }
                            }
                            setEditingPhoneId(null);
                          }}
                          className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
                        >
                          ยืนยัน
                        </button>
                        <button
                          onClick={() => setEditingPhoneId(null)}
                          className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="font-normal text-base cursor-pointer"
                      onClick={() => {
                        setEditingPhoneId(b.id);
                        setEditingPhoneValue(b.phone ?? "");
                      }}
                    >
                      {b.phone}
                    </span>
                  )}
                </div>
                {/* หมอนวด */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<UserCheck className="w-4 h-4" />} text="หมอนวด" />
                  <span className="font-normal text-base">{b.therapist}</span>
                </div>

                {/* วันที่ */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<CalendarDays className="w-4 h-4" />} text="วันที่" />
                  <span className="font-normal text-base">
                    {new Date(b.date).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      timeZone: "Asia/Bangkok",
                    })}
                  </span>
                </div>

                {/* ช่วงเวลา */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<Clock className="w-4 h-4" />} text="ช่วงเวลา" />
                  <span className="font-normal text-base">{b.time_slot}</span>
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
    {/* ยืนยัน */}
    {getStatusLabel(b) === "รอดำเนินการ" && (
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
    )}
    {/* ยกเลิก */}
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
          ))}
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
