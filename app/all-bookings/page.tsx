"use client";

import { useEffect, useState, useRef } from "react";
import { User, Phone, UserCheck, Clock, CalendarDays, BedDouble, CheckCircle2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { FaCheck, FaTimes } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAuth } from "@/context/AuthContext";
import BookingSummary from "@/app/BookingSummary/BookingSummary";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import { AlertCircle } from "lucide-react";

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

// ✅ ใหม่: ฟังก์ชันกลางเช็คว่า booking นี้ยังไม่มี HN หรือไม่ (ใช้ทั้งตอน sort และตอน render)
// logic เดิมทุกประการ: !!b.is_new_user_pending && !b.has_confirmed_hn
const isBookingPendingHN = (b: Booking) => !!b.is_new_user_pending && !b.has_confirmed_hn;

const getStatusColor = (b: Booking) => {
  switch (getStatusLabel(b)) {
    case "ยกเลิก": return "border-red-500";
    case "อยู่ในคิว": return "border-orange-500";
    case "สำเร็จ": return "border-emerald-500";    
    default: return "border-gray-500";
  }
};

// ✅ ใหม่: สีพื้นหลังของการ์ด แยกฟังก์ชันต่างหากจาก getStatusColor (ไม่แก้ของเดิม)
// ใช้คู่กับ border-l-8 ด้านบน เพื่อให้แต่ละสถานะแยกจากกันชัดเจนขึ้น
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
    // ✅ ใหม่: ให้ผู้มารับบริการที่ยังไม่มี HN ขึ้นแสดงเป็นลำดับแรกเสมอ
    // ใช้ sort แบบ stable (JS การันตีความเสถียรของลำดับ) จึงไม่กระทบลำดับเดิม (วันที่/เวลา/ชื่อ จาก backend)
    // ของรายการที่เหลือ ไม่ว่าจะอยู่ในกลุ่ม pending HN ด้วยกัน หรือกลุ่มที่มี HN แล้วด้วยกัน
    .sort((a, b) => {
      const aPending = isBookingPendingHN(a) ? 0 : 1;
      const bPending = isBookingPendingHN(b) ? 0 : 1;
      return aPending - bPending;
    });

  // ตรวจสอบว่าวันที่ของการจองเป็นวันข้างหน้า (อนาคต) หรือไม่
  const isFutureBookingDate = (dateStr: string) => {
    const bookingDate = new Date(dateStr);
    bookingDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return bookingDate.getTime() > today.getTime();
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
      {/* ✅ ใหม่: ใช้เมนู hamburger กลางที่ใช้ร่วมกันทุกหน้า (app/components/HamburgerMenu.tsx)
          แทนโค้ดแถบเมนู/แผงเมนูที่เคยก็อปมาไว้ในไฟล์นี้เอง — แก้เมนูที่เดียวจบทุกหน้า
          ปุ่ม "ส่งออก Excel" เป็นของเฉพาะหน้านี้ จึงส่งผ่าน rightSlot ตามที่ HamburgerMenu ออกแบบไว้ */}
      <HamburgerMenu
        rightSlot={
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
        }
      />
      
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
            const isPendingHN = isBookingPendingHN(b);
            // ✅ ใหม่: เมื่อ booking นี้ "สำเร็จ" แล้ว ไม่ควรแก้ไข payment_status ได้อีก
            const isCompleted = getStatusLabel(b) === "สำเร็จ";
            // ✅ ใหม่: สิทธิ์แก้ไขรายการนี้ — แอดมิน (909) แก้ไขได้ทุกรายการ
            // ผู้ใช้ทั่วไปแก้ไขได้เฉพาะรายการของตนเอง (อิงจาก therapist ที่ผูกกับบัญชีผู้ใช้ เหมือนปุ่มยืนยัน/ยกเลิกเดิม)
            const canManageBooking =
              user?.role_id === 909 || (!!b?.therapist && b.therapist === user?.name);
            return (
            <li
              key={b.id}
              className={`border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center border-l-8 ${
                // ✅ ใหม่: ถ้ายังไม่มี HN (isPendingHN) ให้ใช้แถบสี/พื้นหลังที่ต่างจาก Rec. อื่นแทน
                // โดยไม่แตะ Logic เดิมของ getStatusColor / getStatusBgColor
                // (สถานะอื่นๆ ยังคำนวณจาก b.status เหมือนเดิมทุกกรณี)
                isPendingHN
                  ? "border-amber-500 bg-amber-50"
                  : `${getStatusColor(b)} ${getStatusBgColor(b)}`
              }`}
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
                    {/* ✅ ใหม่: แสดง HN ต่อท้ายชื่อ (แสดงเฉพาะเมื่อมีค่า HN เท่านั้น ไม่กระทบเงื่อนไข isPendingHN เดิม) */}
                    {b.hn && (
                      <span className="text-[11px] font-medium text-gray-500">
                        HN: {b.hn}
                      </span>
                    )}
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
                      <>
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-300"
                          title="ผู้มารับบริการรายใหม่ ยังไม่มี HN — รอเจ้าหน้าที่บันทึกข้อมูลให้สมบูรณ์"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                          <span>รอบันทึก HN</span>
                        </span>
                        {/* ✅ ใหม่: ข้อความแจ้งขั้นตอนถัดไปสำหรับผู้ที่ยังไม่มี HN */}
                        <span className="text-[11px] font-medium text-amber-700 leading-snug">
                          ตรวจสอบชื่อ-นามสกุล ให้ดูจากบัตรประชาชน หากไม่มีให้ทำประวัติที่เวชระเบียน ยกเลิกและจองคิวใหม่
                        </span>
                      </>
                    )}
                  </div>

                  {/* ปุ่ม toggle การจ่ายเงิน */}
                  <button
                    disabled={isCompleted || !canManageBooking}
                    onClick={async () => {
                      // ✅ ใหม่: กันเหนียวอีกชั้น ไม่ให้แก้ไขได้เมื่อ booking นี้ "สำเร็จ" แล้ว
                      // (ปุ่มถูก disable อยู่แล้ว แต่กันไว้เผื่อกรณี event หลุดผ่านมา)
                      if (isCompleted) return;
                      // ✅ ใหม่: กันเหนียวอีกชั้น ไม่ให้แก้ไขรายการของผู้อื่นได้ (เฉพาะแอดมิน หรือเจ้าของรายการเท่านั้น)
                      if (!canManageBooking) return;

                      // 1. กำหนด Logic การวนค่าใหม่: unpaid -> paid -> UC -> unpaid
                      const current = b.payment_status;
                      const newStatus = current === "paid" ? "UC" : current === "UC" ? "unpaid" : "paid";
                      
                      try {
                        const res = await fetch("/api/update-payment-status", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          // ✅ ใหม่: ส่ง userId/role ของผู้ใช้ที่ login ไปด้วย เพื่อให้ฝั่ง server ตรวจสอบสิทธิ์ได้
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
                      isCompleted
                        ? "รายการนี้สำเร็จแล้ว ไม่สามารถแก้ไขสถานะการจ่ายเงินได้"
                        : !canManageBooking
                        ? "ไม่สามารถแก้ไขได้ เนื่องจากไม่ใช่รายการของคุณ"
                        : undefined
                    }
                    className={`mt-1 px-2 py-1 text-xs rounded transition w-28 text-white font-bold ${
                      isCompleted || !canManageBooking
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    } ${
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