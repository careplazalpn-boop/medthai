"use client";

import { useEffect, useState, useRef } from "react";
import { 
  User, Phone, UserCheck, Clock, CalendarDays, 
  BedDouble, CheckCircle2, AlertCircle, XCircle, Users, ClipboardList, Search ,ChevronLeft, ChevronRight
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { FaCheck, FaTimes } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAuth } from "@/context/AuthContext";
import HamburgerMenu from "@/app/components/HamburgerMenu";

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
  is_own_booking?: number | boolean;
}

interface Therapist {
  id: number;
  name: string;
}

const getTodayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getStatusLabel = (b: Booking) => {
  return b.status || "รอดำเนินการ";
};

const isBookingPendingHN = (b: Booking) => !!b.is_new_user_pending && !b.has_confirmed_hn;

const getStatusColor = (b: Booking) => {
  switch (getStatusLabel(b)) {
    case "ยกเลิก": return "border-red-500";
    case "อยู่ในคิว": return "border-orange-500";
    case "สำเร็จ": return "border-emerald-500";    
    default: return "border-gray-500";
  }
};

const getStatusBgColor = (b: Booking) => {
  switch (getStatusLabel(b)) {
    case "ยกเลิก": return "bg-red-50";
    case "อยู่ในคิว": return "bg-orange-50";
    case "สำเร็จ": return "bg-emerald-50";
    default: return "bg-gray-50";
  }
};

export default function AllBookingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);
  const [showConfirmSuccess, setShowConfirmSuccess] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterTherapist, setFilterTherapist] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterTimeSlot, setFilterTimeSlot] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterSpecialBed, setFilterSpecialBed] = useState(false); 
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  useEffect(() => {
    setFilterDate(getTodayLocal());
  }, []);

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
          `/api/all-bookings?date=${filterDate || ""}&provider=${filterProvider || ""}&therapist=${filterTherapist || ""}&timeSlots=${filterTimeSlot || ""}&status=${filterStatus || ""}&specialBed=${filterSpecialBed}&page=${page}&limit=${limit}&role=${encodeURIComponent(user?.role || "")}&role_id=${encodeURIComponent(user?.role_id || "")}`
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
  }, [filterDate, filterProvider, filterTherapist, filterTimeSlot, filterStatus, filterSpecialBed, page, limit, user?.role, user?.role_id]);
      
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
              "ผู้ให้บริการ": 30, "ผู้มารับบริการ": 30, "หมอนวด": 30, "ช่วงเวลา": 15, "สถานะ" : 15, "การชำระเงิน": 15, 
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

  const filteredBookings = bookings
    .filter(b => {
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
    })
    .sort((a, b) => {
      const aOwn = a.is_own_booking ? 0 : 1;
      const bOwn = b.is_own_booking ? 0 : 1;
      if (aOwn !== bOwn) return aOwn - bOwn;
      const aPending = isBookingPendingHN(a) ? 0 : 1;
      const bPending = isBookingPendingHN(b) ? 0 : 1;
      return aPending - bPending;
    });

  const isFutureBookingDate = (dateStr: string) => {
    const bookingDate = new Date(dateStr);
    bookingDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bookingDate.getTime() > today.getTime();
  };

  const isTodayBookingDate = (dateStr: string) => {
    const bookingDate = new Date(dateStr);
    bookingDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bookingDate.getTime() === today.getTime();
  };

  const isAdmin = user?.role_id === 909;
  const statusCycle = ["รอดำเนินการ", "อยู่ในคิว", "สำเร็จ", "ยกเลิก"];

  const handleCycleStatus = async (b: Booking) => {
    const currentIndex = statusCycle.indexOf(getStatusLabel(b));
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];

    try {
      const res = await fetch("/api/all-bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: b.id,
          status: nextStatus,
          userId: (user as any)?.id,
          role_id: user?.role_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBookings((prev) =>
          prev.map((x) => (x.id === b.id ? { ...x, status: nextStatus } : x))
        );
      } else {
        alert(data.error || "อัปเดตสถานะไม่สำเร็จ");
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err);
    }
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

  if (!user) return <p>กำลังตรวจสอบสิทธิ์...</p>;
  if (error) return <p className="p-4 text-center text-red-600 font-semibold">Error: {error}</p>;

  // ✅ คำนวณเปอร์เซ็นต์สำหรับ Summary Cards
  const totalBookings = summary.totalAttended + summary.totalCancelled + summary.totalPending + summary.totalInQueue;
  const getPercentage = (value: number) => totalBookings === 0 ? 0 : Math.round((value / totalBookings) * 100);

  return (
    <div className="min-h-screen px-4 sm:px-6 py-12 bg-gradient-to-br from-white to-emerald-50 relative">
      {loading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[1000]">
          <ImSpinner2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}
      
      <HamburgerMenu
        rightSlot={
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1 sm:gap-2 px-4 sm:px-4 py-3 sm:py-3 rounded-lg bg-white text-emerald-700 font-semibold shadow text-sm sm:text-base transition hover:bg-gray-300"
            title="ส่งออก Excel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 2H8a2 2 0 0 0-2 2v4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-1V2zM8 4h11v16H5V8h1v-2zM7 10h10v2H7v-2zm0 4h10v2H7v-2z"/>
            </svg>
          </button>
        }
      />
      
      <h1 className="text-3xl sm:text-4xl font-extrabold text-emerald-700 mb-6 pt-15 text-center drop-shadow-sm">
        จัดการข้อมูลบริการ
      </h1>

      {/* ✅ SUMMARY CARDS (Clickable Filters) */}
      {/* ✅ SUMMARY CARDS (Clickable Filters) - ดีไซน์กะทัดรัด (Compact Modern Dashboard) */}
      <div className="max-w-6xl mx-auto mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        
        {/* 1. การ์ดทั้งหมด (All) */}
        <div 
          onClick={() => { setFilterStatus("all"); setPage(1); }}
          className={`relative overflow-hidden flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-300 
            ${filterStatus === "all" 
              ? 'border-blue-500 bg-gradient-to-br from-blue-100 to-blue-50 shadow-md shadow-blue-500/20 transform scale-[1.02] ring-2 ring-blue-500/10' 
              : 'border-blue-100 bg-gradient-to-br from-white to-blue-50/50 hover:border-blue-300 hover:shadow-sm'}`}
        >
          <ClipboardList className={`absolute -bottom-2 -right-2 w-14 h-14 opacity-10 ${filterStatus === "all" ? 'text-blue-700' : 'text-blue-500'}`} />
          <div className="flex justify-between items-center mb-1.5 relative z-10">
             <span className={`text-xs font-extrabold tracking-wide ${filterStatus === "all" ? 'text-blue-900' : 'text-blue-700'}`}>ทั้งหมด</span>
             <div className={`p-1.5 rounded-lg shadow-sm ${filterStatus === "all" ? 'bg-blue-200 text-blue-700' : 'bg-blue-100 text-blue-500'}`}>
               <ClipboardList className="w-3.5 h-3.5" />
             </div>
          </div>
          <div className="flex items-baseline gap-1.5 relative z-10">
             <span className={`text-2xl sm:text-3xl font-black tracking-tight ${filterStatus === "all" ? 'text-blue-700' : 'text-blue-900'}`}>{totalBookings}</span>
             <span className={`text-[11px] font-bold ${filterStatus === "all" ? 'text-blue-800' : 'text-blue-600/70'}`}>คน</span>
          </div>
          <div className={`mt-1 text-[10px] font-bold relative z-10 ${filterStatus === "all" ? 'text-blue-800' : 'text-blue-500/70'}`}>
            100% ของรายการทั้งหมด
          </div>
        </div>

        {/* 2. การ์ดสำเร็จ (Past) */}
        <div 
          onClick={() => { setFilterStatus("past"); setPage(1); }}
          className={`relative overflow-hidden flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-300 
            ${filterStatus === "past" 
              ? 'border-emerald-500 bg-gradient-to-br from-emerald-100 to-emerald-50 shadow-md shadow-emerald-500/20 transform scale-[1.02] ring-2 ring-emerald-500/10' 
              : 'border-emerald-100 bg-gradient-to-br from-white to-emerald-50/50 hover:border-emerald-300 hover:shadow-sm'}`}
        >
          <CheckCircle2 className={`absolute -bottom-2 -right-2 w-14 h-14 opacity-10 ${filterStatus === "past" ? 'text-emerald-700' : 'text-emerald-500'}`} />
          <div className="flex justify-between items-center mb-1.5 relative z-10">
             <span className={`text-xs font-extrabold tracking-wide ${filterStatus === "past" ? 'text-emerald-900' : 'text-emerald-700'}`}>สำเร็จแล้ว</span>
             <div className={`p-1.5 rounded-lg shadow-sm ${filterStatus === "past" ? 'bg-emerald-200 text-emerald-700' : 'bg-emerald-100 text-emerald-500'}`}>
               <CheckCircle2 className="w-3.5 h-3.5" />
             </div>
          </div>
          <div className="flex items-baseline gap-1.5 relative z-10">
             <span className={`text-2xl sm:text-3xl font-black tracking-tight ${filterStatus === "past" ? 'text-emerald-700' : 'text-emerald-900'}`}>{summary.totalAttended}</span>
             <span className={`text-[11px] font-bold ${filterStatus === "past" ? 'text-emerald-800' : 'text-emerald-600/70'}`}>คน</span>
          </div>
          <div className={`mt-1 text-[10px] font-bold relative z-10 ${filterStatus === "past" ? 'text-emerald-800' : 'text-emerald-500/70'}`}>
            {getPercentage(summary.totalAttended)}% ของทั้งหมด
          </div>
        </div>

        {/* 3. การ์ดรอดำเนินการ (Upcoming) */}
        <div 
          onClick={() => { setFilterStatus("upcoming"); setPage(1); }}
          className={`relative overflow-hidden flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-300 
            ${filterStatus === "upcoming" 
              ? 'border-violet-500 bg-gradient-to-br from-violet-100 to-violet-50 shadow-md shadow-violet-500/20 transform scale-[1.02] ring-2 ring-violet-500/10' 
              : 'border-violet-100 bg-gradient-to-br from-white to-violet-50/50 hover:border-violet-300 hover:shadow-sm'}`}
        >
          <Clock className={`absolute -bottom-2 -right-2 w-14 h-14 opacity-10 ${filterStatus === "upcoming" ? 'text-violet-700' : 'text-violet-500'}`} />
          <div className="flex justify-between items-center mb-1.5 relative z-10">
             <span className={`text-xs font-extrabold tracking-wide ${filterStatus === "upcoming" ? 'text-violet-900' : 'text-violet-700'}`}>รอดำเนินการ</span>
             <div className={`p-1.5 rounded-lg shadow-sm ${filterStatus === "upcoming" ? 'bg-violet-200 text-violet-700' : 'bg-violet-100 text-violet-500'}`}>
               <Clock className="w-3.5 h-3.5" />
             </div>
          </div>
          <div className="flex items-baseline gap-1.5 relative z-10">
             <span className={`text-2xl sm:text-3xl font-black tracking-tight ${filterStatus === "upcoming" ? 'text-violet-700' : 'text-violet-900'}`}>{summary.totalPending}</span>
             <span className={`text-[11px] font-bold ${filterStatus === "upcoming" ? 'text-violet-800' : 'text-violet-600/70'}`}>คน</span>
          </div>
          <div className={`mt-1 text-[10px] font-bold relative z-10 ${filterStatus === "upcoming" ? 'text-violet-800' : 'text-violet-500/70'}`}>
            {getPercentage(summary.totalPending)}% ของทั้งหมด
          </div>
        </div>

        {/* 4. การ์ดอยู่ในคิว (In Queue) */}
        <div 
          onClick={() => { setFilterStatus("in_queue"); setPage(1); }}
          className={`relative overflow-hidden flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-300 
            ${filterStatus === "in_queue" 
              ? 'border-amber-500 bg-gradient-to-br from-amber-100 to-amber-50 shadow-md shadow-amber-500/20 transform scale-[1.02] ring-2 ring-amber-500/10' 
              : 'border-amber-100 bg-gradient-to-br from-white to-amber-50/50 hover:border-amber-300 hover:shadow-sm'}`}
        >
          <Users className={`absolute -bottom-2 -right-2 w-14 h-14 opacity-10 ${filterStatus === "in_queue" ? 'text-amber-700' : 'text-amber-500'}`} />
          <div className="flex justify-between items-center mb-1.5 relative z-10">
             <span className={`text-xs font-extrabold tracking-wide ${filterStatus === "in_queue" ? 'text-amber-900' : 'text-amber-700'}`}>อยู่ในคิว</span>
             <div className={`p-1.5 rounded-lg shadow-sm ${filterStatus === "in_queue" ? 'bg-amber-200 text-amber-700' : 'bg-amber-100 text-amber-500'}`}>
               <Users className="w-3.5 h-3.5" />
             </div>
          </div>
          <div className="flex items-baseline gap-1.5 relative z-10">
             <span className={`text-2xl sm:text-3xl font-black tracking-tight ${filterStatus === "in_queue" ? 'text-amber-700' : 'text-amber-900'}`}>{summary.totalInQueue}</span>
             <span className={`text-[11px] font-bold ${filterStatus === "in_queue" ? 'text-amber-800' : 'text-amber-600/70'}`}>คน</span>
          </div>
          <div className={`mt-1 text-[10px] font-bold relative z-10 ${filterStatus === "in_queue" ? 'text-amber-800' : 'text-amber-500/70'}`}>
            {getPercentage(summary.totalInQueue)}% ของทั้งหมด
          </div>
        </div>

        {/* 5. การ์ดยกเลิก (Cancelled) */}
        <div 
          onClick={() => { setFilterStatus("cancelled"); setPage(1); }}
          className={`relative overflow-hidden flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-300 
            ${filterStatus === "cancelled" 
              ? 'border-rose-500 bg-gradient-to-br from-rose-100 to-rose-50 shadow-md shadow-rose-500/20 transform scale-[1.02] ring-2 ring-rose-500/10' 
              : 'border-rose-100 bg-gradient-to-br from-white to-rose-50/50 hover:border-rose-300 hover:shadow-sm'}`}
        >
          <XCircle className={`absolute -bottom-2 -right-2 w-14 h-14 opacity-10 ${filterStatus === "cancelled" ? 'text-rose-700' : 'text-rose-500'}`} />
          <div className="flex justify-between items-center mb-1.5 relative z-10">
             <span className={`text-xs font-extrabold tracking-wide ${filterStatus === "cancelled" ? 'text-rose-900' : 'text-rose-700'}`}>ยกเลิก</span>
             <div className={`p-1.5 rounded-lg shadow-sm ${filterStatus === "cancelled" ? 'bg-rose-200 text-rose-700' : 'bg-rose-100 text-rose-500'}`}>
               <XCircle className="w-3.5 h-3.5" />
             </div>
          </div>
          <div className="flex items-baseline gap-1.5 relative z-10">
             <span className={`text-2xl sm:text-3xl font-black tracking-tight ${filterStatus === "cancelled" ? 'text-rose-700' : 'text-rose-900'}`}>{summary.totalCancelled}</span>
             <span className={`text-[11px] font-bold ${filterStatus === "cancelled" ? 'text-rose-800' : 'text-rose-600/70'}`}>คน</span>
          </div>
          <div className={`mt-1 text-[10px] font-bold relative z-10 ${filterStatus === "cancelled" ? 'text-rose-800' : 'text-rose-500/70'}`}>
            {getPercentage(summary.totalCancelled)}% ของทั้งหมด
          </div>
        </div>

      </div>

      {/* ✅ ตัวกรอง (Filters) ชุดที่ 1 */}
      {/* ✅ ตัวกรอง (Filters) - แยกการ์ด ค้นหาชื่อ และ วันที่ ชัดเจน สีต่างกัน */}
      <div className="max-w-6xl mx-auto mb-8 space-y-4">
        
        {/* แถวที่ 1: ค้นหาหลัก (แยกการ์ด ชื่อ และ วันที่/เวลา) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* 1. การ์ดค้นหาชื่อ-สกุล (โทนสีฟ้า) */}
          <div className="bg-blue-50/80 p-5 sm:p-6 rounded-2xl shadow-sm border border-blue-200 flex flex-col justify-center">
            <label className="text-blue-900 font-extrabold mb-3 text-sm flex items-center gap-2">
              <div className="p-1.5 bg-blue-200 rounded-lg text-blue-700"><Search className="w-4 h-4" /></div>
              ค้นหาด้วยชื่อ-สกุล
            </label>
            <input 
              type="text" 
              placeholder="พิมพ์ชื่อ หรือ นามสกุล เพื่อค้นหา..." 
              value={filterName} 
              onChange={e => {setFilterName(e.target.value);setPage(1);}}
              className="w-full px-4 h-11 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-blue-400/70 text-sm shadow-inner bg-white transition-shadow"
            />
          </div>

          {/* 2. การ์ดค้นหาวันที่และเวลา (โทนสีเขียวมรกต) */}
          <div className="bg-emerald-50/80 p-5 sm:p-6 rounded-2xl shadow-sm border border-emerald-200 flex flex-col justify-center">
            <label className="text-emerald-900 font-extrabold mb-3 text-sm flex items-center gap-2">
              <div className="p-1.5 bg-emerald-200 rounded-lg text-emerald-700"><CalendarDays className="w-4 h-4" /></div>
              เลือกวันที่ และ ช่วงเวลา
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="date" 
                value={filterDate} 
                onChange={e => {setFilterDate(e.target.value);setPage(1);}}
                className={`w-full sm:w-1/2 px-4 h-11 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-inner bg-white transition-colors cursor-pointer
                  ${filterDate ? "border-emerald-300 text-gray-900" : "border-emerald-200 text-emerald-500"}`}
              />
              <select 
                value={filterTimeSlot} 
                onChange={e => {setFilterTimeSlot(e.target.value);setPage(1);}}
                className="w-full sm:w-1/2 px-4 h-11 border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 text-sm shadow-inner bg-white cursor-pointer"
              >
                <option value="all">ทุกช่วงเวลา</option>
                {timeSlots.map((slot,i)=><option key={i} value={slot}>{slot}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* แถวที่ 2: ตัวกรองเพิ่มเติม (โทนสีขาวสะอาดตา) */}
        <div className="bg-white p-5 sm:px-6 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-end">
          
          <div className="w-full sm:flex-1 min-w-[140px]">
            <label className="block text-gray-700 font-bold mb-2 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-gray-400"/> ผู้จองคิว:
            </label>
            <select 
              value={filterProvider} 
              onChange={e => {setFilterProvider(e.target.value);setPage(1);}}
              className="w-full px-4 h-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 text-sm bg-gray-50 hover:bg-white transition cursor-pointer"
            >
              <option value="all">ทั้งหมด</option>
              {providers.map((t,i)=><option key={i} value={t}>{t}</option>)}            
            </select>
          </div>

          <div className="w-full sm:flex-1 min-w-[140px]">
            <label className="block text-gray-700 font-bold mb-2 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-gray-400"/> พนักงานนวด:
            </label>
            <select 
              value={filterTherapist} 
              onChange={e => {setFilterTherapist(e.target.value);setPage(1);}}
              className="w-full px-4 h-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 text-sm bg-gray-50 hover:bg-white transition cursor-pointer"
            >
              <option value="all">ทั้งหมด</option>
              {therapists.map((t,i)=><option key={i} value={t.name}>{t.name}</option>)}
            </select>
          </div>

          <div className="w-full sm:w-[150px]">
            <label className="block text-gray-700 font-bold mb-2 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-gray-400"/> สถานะ:
            </label>
            <select 
              value={filterStatus} 
              onChange={e => {setFilterStatus(e.target.value);setPage(1);}}
              className="w-full px-4 h-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 text-sm bg-gray-50 hover:bg-white transition cursor-pointer"
            >
              <option value="all">ทั้งหมด</option>
              <option value="upcoming">รอดำเนินการ</option>
              <option value="in_queue">อยู่ในคิว</option>
              <option value="past">สำเร็จ</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </div>

          <div className="w-full sm:w-[220px]">
            <label className="block text-gray-700 font-bold mb-2 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <BedDouble className="w-4 h-4 text-gray-400"/> เตียงพิเศษ:
            </label>
            {/* ✅ เพิ่ม text-gray-700 เพื่อให้ตัวอักษรสีเข้มมองเห็นชัดเจนในสถานะปกติ */}
            <label className="flex items-center gap-2 h-10 px-4 border border-gray-300 rounded-xl cursor-pointer select-none bg-gray-50 text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition">
              <input
                type="checkbox"
                checked={filterSpecialBed}
                onChange={e => { setFilterSpecialBed(e.target.checked); setPage(1); }}
                className="w-4 h-4 accent-emerald-600 rounded"
              />
              <span className="text-sm font-semibold">เฉพาะที่มีการจองเตียง</span>
            </label>
          </div>

          <div className="flex w-full sm:w-auto items-end ml-auto mt-2 sm:mt-0">
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
              className="w-full sm:w-auto h-10 px-5 bg-white text-rose-600 border border-rose-200 rounded-xl font-bold hover:bg-rose-50 transition text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              <XCircle className="w-4 h-4" /> ล้างตัวกรอง
            </button>
          </div>

        </div>
      </div>
        
      {/* ส่วนควบคุมหน้า Page (บน) */}
      <div className="flex justify-center items-center gap-2 sm:gap-4 mb-4 mt-2">
        <button
          onClick={handlePrev}
          disabled={page <= 1}
          className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 hover:shadow-sm font-semibold text-sm text-gray-700 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">ก่อนหน้า</span>
        </button>
        
        <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-2">
          <span className="text-gray-500 font-medium text-sm mr-2">หน้า</span>
          <span className="text-emerald-700 font-black text-sm">{page}</span>
          <span className="text-gray-400 font-medium text-sm mx-1">/</span>
          <span className="text-gray-600 font-bold text-sm">{totalPages}</span>
        </div>

        <button
          onClick={handleNext}
          disabled={page >= totalPages}
          className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 hover:shadow-sm font-semibold text-sm text-gray-700 transition"
        >
          <span className="hidden sm:inline">ถัดไป</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {filteredBookings.length === 0 ? (
        <div className="text-center bg-white p-10 rounded-2xl max-w-6xl mx-auto border border-gray-200 shadow-sm">
          <p className="text-gray-500 text-lg font-medium select-none">ไม่พบประวัติการจองตามเงื่อนไขที่เลือก</p>
        </div>
      ) : (
        
        <ul className="space-y-4 w-full max-w-[92rem] mx-auto">
          {filteredBookings.map((b, idx) => {
            const isPendingHN = isBookingPendingHN(b);
            const isCompleted = getStatusLabel(b) === "สำเร็จ";
            const canManageBooking =
              user?.role_id === 909 || (!!b?.therapist && b.therapist === user?.name);
            const canEditCompleted = isCompleted && isAdmin && isTodayBookingDate(b.date);
            
            return (
            <li
              key={b.id}
              className={`border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center border-l-8 bg-white shadow-sm transition hover:shadow-md ${
                isPendingHN
                  ? "border-amber-500 bg-amber-50"
                  : `${getStatusColor(b)}`
              }`}
            >
              {/* เลขลำดับ */}
              <div className="flex items-center gap-2 pr-0 sm:pr-4 mb-3 sm:mb-0">
                <span className="w-8 h-8 flex items-center justify-center bg-emerald-100 text-emerald-700 font-extrabold rounded-full text-sm">
                  {(page - 1) * limit + idx + 1}
                </span>
              </div>
              
              {/* ข้อมูล */}
              <div className="grid grid-cols-1 sm:grid-cols-[200px_211px_130px_200px_120px_120px_120px] gap-y-2 sm:gap-x-6 text-gray-700 flex-grow">
                {/* ผู้ให้บริการ */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<UserCheck className="w-4 h-4" />} text="ผู้จองคิว" />
                  <span className="font-semibold text-sm text-gray-900">{b.provider}</span>
                </div>
                {/* ผู้มารับบริการ */}
                <div className="flex flex-col sm:flex-col gap-1 relative">
                  <Label icon={<User className="w-4 h-4" />} text="ผู้มารับบริการ" />
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-bold text-base text-gray-900">
                      {b.name}
                    </span>
                    {b.hn && (
                      <span className="text-[11px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        HN: {b.hn}
                      </span>
                    )}
                    {Boolean(b.has_special_bed) && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300 mt-0.5"
                        title={b.bed_name ? `เตียงพิเศษ: ${b.bed_name}` : "ใช้เตียงพิเศษ"}
                      >
                        <BedDouble className="w-3.5 h-3.5 text-emerald-700" />
                        <span>เตียงพิเศษ{b.bed_name ? ` (${b.bed_name})` : ""}</span>
                      </span>
                    )}
                    {isPendingHN && (
                      <>
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-300 mt-1"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                          <span>รอบันทึก HN</span>
                        </span>
                        <span className="text-[10px] font-medium text-amber-700 leading-snug mt-0.5 block">
                          ตรวจสอบชื่อ-นามสกุล หากไม่มีให้ทำประวัติใหม่ และจองคิวอีกครั้ง
                        </span>
                      </>
                    )}
                  </div>

                  {/* ปุ่ม toggle การจ่ายเงิน */}
                  <button
                    disabled={(isCompleted && !canEditCompleted) || !canManageBooking}
                    onClick={async () => {
                      if (isCompleted && !canEditCompleted) return;
                      if (!canManageBooking) return;

                      const current = b.payment_status;
                      const newStatus = current === "paid" ? "UC" : current === "UC" ? "unpaid" : "paid";
                      
                      try {
                        const res = await fetch("/api/update-payment-status", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            id: b.id,
                            status: newStatus,
                            userId: (user as any)?.id,
                            role_id: user?.role_id,
                          }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setBookings((prev) =>
                            prev.map((x) =>
                              x.id === b.id ? { ...x, payment_status: newStatus } : x
                            )
                          );
                        } else {
                          alert(data.error || "อัปเดตสถานะการจ่ายเงินไม่สำเร็จ");
                        }
                      } catch (err) {
                        alert("เกิดข้อผิดพลาด: " + err);
                      }
                    }}
                    title={
                      isCompleted && !canEditCompleted
                        ? "รายการนี้สำเร็จแล้ว ไม่สามารถแก้ไขสถานะการจ่ายเงินได้"
                        : !canManageBooking
                        ? "ไม่สามารถแก้ไขได้ เนื่องจากไม่ใช่รายการของคุณ"
                        : undefined
                    }
                    className={`mt-2 px-2 py-1.5 text-[11px] rounded transition w-24 text-white font-bold shadow-sm ${
                      (isCompleted && !canEditCompleted) || !canManageBooking
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:scale-105 active:scale-95"
                    } ${
                      b.payment_status === "paid"
                        ? "bg-emerald-600 border border-emerald-700"
                        : b.payment_status === "UC"
                        ? "bg-blue-600 border border-blue-700"
                        : "bg-amber-500 border border-amber-600"
                    }`}
                  >
                    {b.payment_status === "paid" ? "ชำระเงินแล้ว" : b.payment_status === "UC" ? "สิทธิ UC" : "เบิกได้"}
                  </button>

                  {/* สัญลักษณ์แสดงสถานะ */}
                  {(b.payment_status === "paid" || b.payment_status === "UC") && (
                    <span className="absolute top-0 right-0 sm:-right-4 font-bold text-xl drop-shadow-sm">
                      {b.payment_status === "paid" ? "💰" : "🏥"}
                    </span>
                  )}
                </div>
                
                {/* เบอร์โทร */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<Phone className="w-4 h-4" />} text="เบอร์โทร" />
                  <span className="font-semibold text-sm text-gray-900">{b.phone}</span>
                </div>
                
                {/* หมอนวด */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<UserCheck className="w-4 h-4" />} text="พนักงานนวด" />
                  <span className="font-semibold text-sm text-gray-900">{b.therapist}</span>
                </div>

                {/* วันที่ + เวลาที่บันทึก */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<CalendarDays className="w-4 h-4" />} text="วันที่" />
                  <span className="font-bold text-sm text-emerald-800">
                    {new Date(b.date).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      timeZone: "Asia/Bangkok",
                    })}
                  </span>
                  <span className="text-[10px] font-medium text-gray-400 mt-1 block">
                    บันทึก: {new Date(b.created_at).toLocaleString("th-TH", {
                      year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok",
                    })} น.
                  </span>
                </div>

                {/* ช่วงเวลา */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<Clock className="w-4 h-4" />} text="ช่วงเวลา" />
                  <span className="font-bold text-sm text-gray-900 bg-gray-100 px-2 py-1 rounded inline-block w-fit">
                    {b.time_slot}
                  </span>
                </div>

                {/* สถานะ */}
                <div className="flex flex-col sm:flex-col gap-1">
                  <Label icon={<CheckCircle2 className="w-4 h-4" />} text="สถานะ" />
                  <span
                    className={`font-black text-sm px-2 py-1 rounded-md inline-block w-fit mt-1 border ${
                      b.status === "ยกเลิก"
                        ? "text-red-700 bg-red-50 border-red-200"
                        : getStatusLabel(b) === "สำเร็จ"
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : getStatusLabel(b) === "อยู่ในคิว"
                        ? "text-orange-700 bg-orange-50 border-orange-200"
                        : "text-gray-700 bg-gray-100 border-gray-300"
                    }`}
                  >
                    {getStatusLabel(b)}
                  </span>
                </div>
              </div>

              {/* ปุ่ม action */}
              {/* ปุ่ม action */}
              <div className="flex gap-2 mt-3 sm:mt-0">
                {getStatusLabel(b) === "ยกเลิก" && !canManageBooking && (
                  // ✅ ใหม่: ไม่ใช่แอดมิน และไม่ใช่เจ้าของรายการ — แสดงสถานะเฉยๆ กดลบไม่ได้
                  <button
                    disabled
                    title="ไม่สามารถลบรายการนี้ได้ เนื่องจากไม่ใช่รายการของคุณ"
                    className="px-4 py-2 rounded-md flex items-center gap-2 bg-gray-300 text-gray-600 cursor-not-allowed"
                  >
                    <FaTimes className="text-red-500" />
                    ยกเลิกแล้ว
                  </button>
                )}
                {getStatusLabel(b) === "ยกเลิก" && canManageBooking && (
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
                    {canManageBooking && (
                      <>
                        {/* ปุ่มยืนยัน */}
                        {getStatusLabel(b) === "รอดำเนินการ" && (
                          isPendingHN ? (
                            <button
                              disabled
                              title="ไม่สามารถยืนยันสถานะได้ เนื่องจากยังไม่มี HN — รอเจ้าหน้าที่บันทึกข้อมูลให้สมบูรณ์"
                              className="flex items-center justify-center w-15 h-10 bg-gray-300 rounded-md shadow cursor-not-allowed"
                            >
                              <FaCheck className="text-gray-400 w-5 h-5" />
                            </button>
                          ) : isFutureBookingDate(b.date) ? (
                            <button
                              disabled
                              title="ไม่สามารถยืนยันสถานะได้ เนื่องจากยังไม่ถึงวันนัดหมาย"
                              className="flex items-center justify-center w-15 h-10 bg-gray-300 rounded-md shadow cursor-not-allowed"
                            >
                              <FaCheck className="text-gray-400 w-5 h-5" />
                            </button>
                          ) : (
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
                  canEditCompleted ? (
                    // ✅ ปรับปรุง: ใช้ Dialog.Root หุ้มเพื่อแสดง Popup ยืนยันเมื่อกดปุ่ม "แก้ไขสถานะ" (สำหรับสถานะ สำเร็จ)
                    <Dialog.Root open={cancelDialogOpen && selectedId === b.id} onOpenChange={setCancelDialogOpen}>
                      <Dialog.Trigger asChild>
                        <button
                          onClick={() => {
                            setSelectedId(b.id);
                            setCancelDialogOpen(true);
                          }}
                          title="คลิกเพื่อเปลี่ยนสถานะ (แก้ไขได้เฉพาะแอดมิน และเฉพาะวันนี้เท่านั้น)"
                          className="px-4 py-2 rounded-lg text-white font-bold text-sm flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 hover:shadow-md transition cursor-pointer"
                        >
                          <FaCheck className="text-white" />
                          สำเร็จแล้ว
                        </button>
                      </Dialog.Trigger>
                      <BookingDialog
                        title="ต้องการยกเลิกสถานะสำเร็จ ใช่หรือไม่?"
                        color="orange"
                        booking={selectedBooking}
                        onConfirm={async () => {
                           // หากกดยืนยัน ให้เรียกใช้ handleCycleStatus เดิม
                           await handleCycleStatus(b);
                           setSelectedId(null);
                           setCancelDialogOpen(false);
                        }}
                      />
                    </Dialog.Root>
                  ) : (
                    <button
                      disabled
                      title={isAdmin ? "ไม่สามารถแก้ไขสถานะได้ เนื่องจากวันที่ของรายการไม่ตรงกับวันที่ปัจจุบัน" : undefined}
                      className="px-4 py-2 rounded-lg text-gray-500 font-bold text-sm flex items-center gap-2 bg-gray-100 border border-gray-200 cursor-not-allowed"
                    >
                      <FaCheck className="text-emerald-500" />
                      สำเร็จ
                    </button>
                  )
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

      {/* ส่วนควบคุมหน้า Page (ล่าง) */}
      <div className="flex justify-center items-center gap-2 sm:gap-4 mt-8 pb-10">
        <button
          onClick={handlePrev}
          disabled={page <= 1}
          className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2.5 bg-white border border-gray-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 hover:shadow-sm font-bold text-sm text-gray-700 transition cursor-pointer"
        >
          <ChevronLeft className="w-4.5 h-4.5" />
          <span className="hidden sm:inline">ก่อนหน้า</span>
        </button>
        
        <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm px-5 py-2.5">
          <span className="text-emerald-800/70 font-bold text-sm mr-2">หน้า</span>
          <span className="text-emerald-700 font-black text-base">{page}</span>
          <span className="text-emerald-300 font-bold text-base mx-2">/</span>
          <span className="text-emerald-900 font-black text-base">{totalPages}</span>
        </div>

        <button
          onClick={handleNext}
          disabled={page >= totalPages}
          className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2.5 bg-white border border-gray-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 hover:shadow-sm font-bold text-sm text-gray-700 transition cursor-pointer"
        >
          <span className="hidden sm:inline">ถัดไป</span>
          <ChevronRight className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
}

function Label({ icon, text }: { icon: React.ReactNode, text: string }) {
  return <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold text-[11px] uppercase tracking-wider">{icon} {text}</div>;
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg z-50">
      {message}
    </div>
  );
}

function BookingDialog({ title, color, booking, onConfirm }: any) {
  if (!booking) return null;

  // ✅ สร้าง Map ระบุชื่อ Class แบบเต็มคำ เพื่อป้องกัน Tailwind ลบ Class ทิ้งตอน Build ขึ้น Server
  const colorStyles: Record<string, { text: string, bg: string }> = {
    red: {
      text: "text-red-600",
      bg: "bg-red-600 hover:bg-red-700"
    },
    emerald: {
      text: "text-emerald-600",
      bg: "bg-emerald-600 hover:bg-emerald-700"
    },
    orange: {
      text: "text-orange-600",
      bg: "bg-orange-600 hover:bg-orange-700"
    }
  };

  // ดึงสไตล์ตามค่า color ที่ส่งมา ถ้าไม่มีให้ใช้ emerald เป็นค่าเริ่มต้น
  const selectedStyle = colorStyles[color] || colorStyles.emerald;

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"/>
      <Dialog.Content asChild>
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 sm:p-8 rounded-2xl shadow-2xl z-50 w-[90%] max-w-md border border-gray-100">
          
          {/* ✅ เรียกใช้ class สีผ่าน selectedStyle.text */}
          <Dialog.Title className={`text-xl sm:text-2xl font-black mb-6 flex items-center gap-2 ${selectedStyle.text}`}>
            {color === "red" ? <XCircle className="w-7 h-7"/> : <CheckCircle2 className="w-7 h-7"/>}
            {title}
          </Dialog.Title>

          <div className="mb-6 text-sm grid grid-cols-1 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
            {[
              {icon:<UserCheck className="w-4 h-4 text-emerald-600"/>, label:"ผู้จองคิว", value:booking.provider},
              {icon:<User className="w-4 h-4 text-emerald-600"/>, label:"ชื่อผู้รับบริการ", value:booking.name},
              {icon:<Phone className="w-4 h-4 text-emerald-600"/>, label:"เบอร์โทร", value:booking.phone},
              {icon:<UserCheck className="w-4 h-4 text-emerald-600"/>, label:"หมอนวด", value:booking.therapist},
              {icon:<CalendarDays className="w-4 h-4 text-emerald-600"/>, label:"วันที่", value:new Date(booking.date).toLocaleDateString("th-TH",{year:"numeric",month:"short",day:"numeric",timeZone:"Asia/Bangkok"})},
              {icon:<Clock className="w-4 h-4 text-emerald-600"/>, label:"ช่วงเวลา", value:booking.time_slot},
            ].map((item,i)=>(
              <div key={`${booking.id}-${i}`} className="flex items-center gap-2 border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                {item.icon}<span className="font-semibold text-gray-600">{item.label}:</span>
                <span className="ml-auto font-black text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition cursor-pointer">
                ยกเลิก
              </button>
            </Dialog.Close>
            
            {/* ✅ เรียกใช้ class สีผ่าน selectedStyle.bg */}
            <button 
              onClick={onConfirm} 
              className={`px-6 py-2.5 rounded-xl text-white font-bold shadow-md transition hover:-translate-y-0.5 cursor-pointer ${selectedStyle.bg}`}
            >
              ยืนยันทำรายการ
            </button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}