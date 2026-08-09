"use client";

import { useState, useEffect, useContext, useRef, createContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BedDouble,
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Search,
  Menu,
  X,
  Sparkles,
  LogOut,
  LogIn,
  Users,
  ClipboardList,
  Building2,
  Trash2,
  Loader2,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Info,
  UserCheck,
  FileCheck,
  History,
  BarChart3,
  Facebook
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

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

// === Interface สำหรับ AuthContext ===
interface AuthContextType {
  user: {
    name: string;
    role: string;
    role_id: number;
    isAdmin: boolean;
  } | null;
  logout: () => void;
}

// === Context รับค่าผู้ใช้งานจริง ===
let AuthContext: any;
try {
  AuthContext = require("@/context/AuthContext").AuthContext;
} catch (e) {
  AuthContext = createContext<AuthContextType>({
    user: { name: "นายดุสิทธิ์ ไชยศรีหา", role: "admin", role_id: 909, isAdmin: true },
    logout: () => console.log("Logout triggered"),
  });
}

// === Interface ข้อมูล ===
interface SpecialBed {
  id: number;
  room_name: string;
  bed_code: string;
  bed_name: string;
  description?: string;
  status: number; // 0 = เปิดใช้งาน, 1 = ปิดซ่อม
}

interface BookingRecord {
  booking_id: number;
  hn: string;
  name: string;
  phone: string;
  therapist: string;
  provider: string;
  time_slot: string;
  date: string;
  status: string;
}

interface SpecialBedBooking {
  special_booking_id: number;
  bed_id: number;
  booking_id: number;
  date: string;
  time_slot: string;
  note?: string;
  created_by?: string;
  bed_code: string;
  bed_name: string;
  room_name: string;
  hn: string;
  patient_name: string;
  patient_phone: string;
  therapist: string;
  provider: string;
  booking_status: string;
  status?: number; // 0 = จอง, 1 = เสร็จสิ้น
}

// ตัดช่องว่างของเวลาเพื่อใช้เปรียบเทียบ
const normalizeSlot = (slotStr: string) => (slotStr || "").replace(/\s+/g, "");

// ตรวจสอบว่าช่วงเวลา/วันที่ของการจองผ่านไปแล้วหรือไม่
const isBookingPassed = (dateStr: string, slotStr: string) => {
  if (!dateStr || !slotStr) return false;
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;

  const parts = slotStr.split("-");
  if (parts.length >= 2) {
    const endTimeStr = parts[1].trim();
    const [endHour, endMinute] = endTimeStr.split(":").map(Number);
    if (!isNaN(endHour) && !isNaN(endMinute)) {
      const slotEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endHour, endMinute);
      return today >= slotEnd;
    }
  }
  return false;
};

export default function BedsSpecialPage() {
  const router = useRouterHook();
  
  const { user, logout } = (useContext(AuthContext) || {}) as {
    user: any;
    logout: () => void;
  };

  const isAuthenticated = !!user;
  const isUserAdmin = user?.isAdmin || user?.role_id === 909 || String(user?.role).toLowerCase() === "admin";

  const todayStr = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState<string>(todayStr);
  const isPastDate = date < todayStr;
  
  const [timeSlots, setTimeSlots] = useState<string[]>([
    "8:00-9:30",
    "9:30-11:00",
    "11:00-12:30",
    "13:00-14:30",
    "14:30-16:00",
    "16:00-17:30"
  ]);
  const [selectedSlot, setSelectedSlot] = useState<string>("16:00-17:30");
  
  const [specialBeds, setSpecialBeds] = useState<SpecialBed[]>([]);
  const [bedBookings, setBedBookings] = useState<SpecialBedBooking[]>([]);
  const [availableBookings, setAvailableBookings] = useState<BookingRecord[]>([]);

  const [selectedBed, setSelectedBed] = useState<SpecialBed | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<BookingRecord | null>(null);
  const [note, setNote] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [contactOpen, setContactOpen] = useState<boolean>(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTimeSlots();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBeds();
      fetchBedBookings();
    }
  }, [date, isAuthenticated, user]);

  const fetchTimeSlots = async () => {
    try {
      const res = await fetch("/api/time-slots");
      const data = await res.json();
      if (data?.success && Array.isArray(data.timeSlots) && data.timeSlots.length > 0) {
        setTimeSlots(data.timeSlots);
        if (!data.timeSlots.includes(selectedSlot)) {
          setSelectedSlot(data.timeSlots[0]);
        }
      }
    } catch (err) {
      console.warn("ใช้ Time slots มาตรฐานสำรอง:", err);
    }
  };

  const fetchBeds = async () => {
    try {
      const res = await fetch("/api/beds-special");
      const data = await res.json();
      if (data?.success) {
        setSpecialBeds(data.beds || []);
      } else {
        loadMockBeds();
      }
    } catch {
      loadMockBeds();
    }
  };

  const fetchBedBookings = async () => {
    setLoading(true);
    try {
      const roleId = user?.role_id?.toString() || "";
      const queryParams = new URLSearchParams({
        date: date,
        role_id: roleId,
        is_admin: isUserAdmin ? "true" : "false"
      });

      const res = await fetch(`/api/beds-special-bookings?${queryParams.toString()}`);
      const data = await res.json();
      if (data?.success) {
        setBedBookings(data.bedBookings || []);
        setAvailableBookings(data.availableBookings || []);
      } else {
        loadMockBookings();
      }
    } catch {
      loadMockBookings();
    } finally {
      setLoading(false);
    }
  };

  const loadMockBeds = () => {
    setSpecialBeds([
      { id: 1, room_name: "ห้องนวด VIP 1 (ชั้น 2)", bed_code: "BED-VIP-01", bed_name: "เตียงพิเศษ 1", description: "เตียงนวดไฟฟ้า ปรับองศาได้", status: 0 },
      { id: 2, room_name: "ห้องนวด VIP 1 (ชั้น 2)", bed_code: "BED-VIP-02", bed_name: "เตียงพิเศษ 2", description: "เตียงนวดไฟฟ้า ปรับองศาได้", status: 0 },
      { id: 3, room_name: "ห้องนวด VIP 2 (ชั้น 2)", bed_code: "BED-VIP-03", bed_name: "เตียงพิเศษ 3", description: "เตียงนวดกว้างพิเศษ รองรับผู้ป่วยฟื้นฟู", status: 0 },
      { id: 4, room_name: "ห้องนวด VIP 2 (ชั้น 2)", bed_code: "BED-VIP-04", bed_name: "เตียงพิเศษ 4", description: "เตียงนวดกว้างพิเศษ รองรับผู้ป่วยฟื้นฟู", status: 0 },
    ]);
  };

  const loadMockBookings = () => {
    setBedBookings([
      {
        special_booking_id: 1,
        bed_id: 1,
        booking_id: 27920,
        date: date,
        time_slot: "16:00-17:30",
        note: "คนไข้ขอหมอนรองขาพิเศษ",
        created_by: user?.name || "นายดุสิทธิ์ ไชยศรีหา",
        bed_code: "BED-VIP-01",
        bed_name: "เตียงพิเศษ 1",
        room_name: "ห้องนวด VIP 1 (ชั้น 2)",
        hn: "1826",
        patient_name: "นางรัชนีย์ เดชคง",
        patient_phone: "085-8633957",
        therapist: "นายดุสิทธิ์ ไชยศรีหา",
        provider: "นายดุสิทธิ์ ไชยศรีหา",
        booking_status: "รอดำเนินการ",
        status: isBookingPassed(date, "16:00-17:30") ? 1 : 0
      }
    ]);

    const allMockAvailable = [
      {
        booking_id: 27917,
        hn: "23023",
        name: "นายสนอง พงษ์สุวรรณ",
        phone: "082-1875209",
        therapist: "น.ส.พิมณ์วิไล สิงห์ชัย",
        provider: "น.ส.พิมณ์วิไล สิงห์ชัย",
        time_slot: "8:00-9:30",
        date: date,
        status: "รอดำเนินการ"
      },
      {
        booking_id: 27920,
        hn: "1826",
        name: "นางรัชนีย์ เดชคง",
        phone: "085-8633957",
        therapist: user?.name || "นายดุสิทธิ์ ไชยศรีหา",
        provider: user?.name || "นายดุสิทธิ์ ไชยศรีหา",
        time_slot: "16:00-17:30",
        date: date,
        status: "รอดำเนินการ"
      }
    ];

    if (isUserAdmin) {
      setAvailableBookings(allMockAvailable);
    } else {
      setAvailableBookings(
        allMockAvailable.filter(
          (b) => b.therapist === user?.name || b.provider === user?.name
        )
      );
    }
  };

  const getBedReservation = (bedId: number, slot: string) => {
    return bedBookings.find(
      (b) => b.bed_id === bedId && normalizeSlot(b.time_slot) === normalizeSlot(slot) && b.booking_status !== "ยกเลิก"
    );
  };

  const canCancelBooking = (booking: SpecialBedBooking) => {
    if (booking.status === 1 || isBookingPassed(booking.date, booking.time_slot)) {
      return false;
    }

    if (isUserAdmin) return true;
    if (!user?.name) return false;

    return (
      booking.created_by === user.name ||
      booking.therapist === user.name ||
      booking.provider === user.name
    );
  };

  const slotMatchingQueues = availableBookings.filter(
    (q) => normalizeSlot(q.time_slot) === normalizeSlot(selectedSlot)
  );

  const filteredSlotQueues = slotMatchingQueues.filter(
    (q) =>
      q.name.includes(searchTerm) ||
      q.hn.includes(searchTerm) ||
      q.therapist.includes(searchTerm)
  );

  const handleOpenBookingModal = (bed: SpecialBed) => {
    if (isPastDate) {
      alert("ไม่อนุญาตให้ทำการจองเตียงพิเศษย้อนหลังได้\n\n(คุณสามารถเลือกดูประวัติการจองย้อนหลังได้เท่านั้น)");
      return;
    }

    setSelectedBed(bed);
    setNote("");
    setSearchTerm("");

    if (slotMatchingQueues.length === 0) {
      alert(
        `ไม่พบคนไข้ของคุณในตาราง Bookings สำหรับช่วงเวลา ${selectedSlot}\n\nหมายเหตุ: คุณสามารถเลือกเตียงได้เฉพาะคิวคนไข้ที่คุณเป็นผู้ดูแลเท่านั้น`
      );
      return;
    }

    if (slotMatchingQueues.length === 1) {
      setSelectedQueue(slotMatchingQueues[0]);
    } else {
      setSelectedQueue(null);
    }

    setBookingDialogOpen(true);
  };

  const handleConfirmBedBooking = async () => {
    if (isPastDate) {
      alert("ไม่อนุญาตให้จองย้อนหลัง");
      return;
    }

    if (!selectedBed || !selectedQueue) {
      alert("กรุณาเลือกคิวจองคนไข้ที่ต้องการลงเตียงพิเศษ");
      return;
    }

    const payload = {
      bed_id: selectedBed.id,
      booking_id: selectedQueue.booking_id,
      date: date,
      time_slot: selectedQueue.time_slot,
      created_by: user?.name || "staff",
      note: note,
      status: 0
    };

    try {
      const res = await fetch("/api/beds-special-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data?.success) {
        alert("บันทึกการจองเตียงพิเศษเรียบร้อยแล้ว");
        fetchBedBookings();
      } else {
        alert(data?.error || "ไม่สามารถบันทึกการจองเตียงได้");
      }
    } catch {
      addMockReservation(payload);
    } finally {
      setBookingDialogOpen(false);
    }
  };

  const addMockReservation = (payload: any) => {
    if (!selectedBed || !selectedQueue) return;
    const newBooking: SpecialBedBooking = {
      special_booking_id: Date.now(),
      bed_id: selectedBed.id,
      booking_id: selectedQueue.booking_id,
      date: date,
      time_slot: selectedQueue.time_slot,
      note: payload.note,
      created_by: user?.name || "นายดุสิทธิ์ ไชยศรีหา",
      bed_code: selectedBed.bed_code,
      bed_name: selectedBed.bed_name,
      room_name: selectedBed.room_name,
      hn: selectedQueue.hn,
      patient_name: selectedQueue.name,
      patient_phone: selectedQueue.phone,
      therapist: selectedQueue.therapist,
      provider: selectedQueue.provider,
      booking_status: "รอดำเนินการ",
      status: 0
    };

    setBedBookings((prev) => [...prev, newBooking]);
    setAvailableBookings((prev) =>
      prev.filter((q) => q.booking_id !== selectedQueue.booking_id)
    );
    alert("บันทึกการจองเตียงพิเศษสำเร็จ (โหมดจำลอง)");
  };

  const handleCancelBedBooking = async (booking: SpecialBedBooking) => {
    if (!canCancelBooking(booking)) {
      alert("ไม่สามารถยกเลิกรายการจองนี้ได้!\n\n- รายการที่ให้บริการเสร็จสิ้น/ผ่านไปแล้วจะไม่สามารถลบย้อนหลังได้\n- หรือคุณต้องเป็นเจ้าของรายการจอง / ผู้ดูแลระบบ (Admin) เท่านั้น");
      return;
    }

    if (!confirm(`คุณแน่ใจว่าต้องการยกเลิกการจองเตียงพิเศษของ "${booking.patient_name}" ?\n\n(คิวนวดหลักในตาราง Bookings ยังคงอยู่)`)) return;

    try {
      const res = await fetch(
        `/api/beds-special-bookings?id=${booking.special_booking_id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data?.success) {
        alert("ยกเลิกการจองเตียงพิเศษเรียบร้อยแล้ว");
        fetchBedBookings();
      } else {
        setBedBookings((prev) =>
          prev.filter((b) => b.special_booking_id !== booking.special_booking_id)
        );
      }
    } catch {
      setBedBookings((prev) =>
        prev.filter((b) => b.special_booking_id !== booking.special_booking_id)
      );
    }
  };

  const handleLogoutNavigation = async () => {
    if (logout) await logout();
    router.push("/login");
  };

  const roomsGrouped = specialBeds.reduce((acc, bed) => {
    if (!acc[bed.room_name]) acc[bed.room_name] = [];
    acc[bed.room_name].push(bed);
    return acc;
  }, {} as Record<string, SpecialBed[]>);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border-2 border-slate-300">
          <div className="w-16 h-16 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-300">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-950 mb-2">เข้าถึงเฉพาะบุคลากร</h2>
          <p className="text-slate-800 font-bold text-sm mb-6">
            หน้าการจองเตียงพิเศษเปิดให้เฉพาะแพทย์แผนไทยและผู้ให้บริการที่เข้าสู่ระบบแล้วเท่านั้น
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-5 h-5" /> เข้าสู่ระบบสำหรับบุคลากร
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-950 pb-16" style={{ backgroundColor: '#ffffff', color: '#020617' }}>
      {loading && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs flex items-center justify-center z-[1000]">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
        </div>
      )}

      {/* Navbar บนสุด */}
      <div className="fixed top-0 left-0 w-full z-50 bg-slate-900 shadow-md flex justify-between items-center px-4 py-3 border-b border-slate-800 h-16" style={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-white p-1.5 hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="เมนู"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div
            className="text-white font-bold text-base sm:text-lg flex items-center gap-2 cursor-pointer hover:text-emerald-400 transition"
            onClick={() => router.push("/")}
            style={{ color: '#ffffff' }}
          >
            <Sparkles className="w-5 h-5 text-emerald-400" /> แพทย์แผนไทย - จองเตียงพิเศษ
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-100 text-xs sm:text-sm font-bold hidden sm:inline" style={{ color: '#f1f5f9' }}>
            ผู้ลงบันทึก: <strong className="text-emerald-400 font-black" style={{ color: '#34d399' }}>{user?.name}</strong>
          </span>
          <button
            onClick={handleLogoutNavigation}
            className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow font-extrabold text-xs transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> ลงชื่อออก
          </button>
        </div>
      </div>

      {/* 🌟 Hamburger Drawer เมนูด้านซ้าย ปรับปรุงตามแบบ app/booking/page.tsx */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 left-0 w-72 h-full bg-slate-800/95 backdrop-blur-md z-50 flex flex-col pt-16 overflow-y-auto shadow-2xl text-white"
            style={{ backgroundColor: '#1e293b' }}
          >
            {/* Header */}
            <div className="px-5 pb-4 border-b border-slate-600">
              <div className="flex items-center gap-2 text-xl font-bold text-white">
                <Sparkles className="text-emerald-400 w-5 h-5" />
                ระบบแพทย์แผนไทย
              </div>

              {user && (
                <div className="mt-2 text-sm text-slate-300">
                  ผู้ใช้งาน : <span className="font-semibold text-white">{user.name}</span>
                </div>
              )}
            </div>

            {/* ===================== เมนูหลัก ===================== */}
            <div className="py-2">
              <div
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/booking");
                }}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer"
              >
                <Calendar className="w-5 h-5 text-emerald-400" />
                <span>
                  {user ? "จองคิวนวดแผนไทย" : "ดูคิวจองนวดแผนไทย"}
                </span>
              </div>

              <div
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/booking-audit");
                }}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer"
              >
                <ClipboardList className="w-5 h-5 text-sky-400" />
                <span>ดูคิวนวดทั้งหมด</span>
              </div>

              <div
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/beds-special");
                }}
                className="flex items-center gap-3 px-5 py-3 text-white bg-emerald-600/30 hover:bg-emerald-600 transition cursor-pointer"
              >
                <BedDouble className="w-5 h-5 text-emerald-300" />
                <span>
                  {user ? "การจองเตียงพิเศษ" : "การจองเตียงพิเศษ"}
                </span>
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
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/all-bookings");
                  }}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer"
                >
                  <History className="w-5 h-5 text-amber-400" />
                  <span>ประวัติการจอง</span>
                </div>

                <div
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/summary-history");
                  }}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer"
                >
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  <span>สรุปรายงาน</span>
                </div>
              </>
            )}

            {/* ===================== Admin ===================== */}
            {isUserAdmin && (
              <>
                <div className="border-t border-slate-600 my-2" />

                <div className="px-5 py-2 text-xs font-semibold uppercase tracking-widest text-amber-300">
                  จัดการระบบ
                </div>

                <div
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/manage-therapists");
                  }}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-amber-600 transition cursor-pointer"
                >
                  <Users className="w-5 h-5 text-rose-400" />
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
              <Building2 className="w-5 h-5 text-teal-400" />

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
              <div className="bg-slate-900" style={{ backgroundColor: '#0f172a' }}>
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

      {/* 🌟 คอนเทนต์หลัก: pt-28 sm:pt-36 เว้นระยะลงมาจาก Navbar พ้นข้อความทับแน่นอน 100% */}
      <div className="max-w-6xl mx-auto p-4 sm:p-6 pt-28 sm:pt-36">
        
        {/* หัวข้อหน้า */}
        <div className="text-center mb-8 bg-slate-50 p-6 sm:p-8 rounded-3xl border-2 border-slate-300 shadow-2xs" style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}>
          <h1 className="text-2xl sm:text-4xl font-black flex items-center justify-center gap-3 tracking-tight mt-6"
          style={{ color: '#0f172a' }}
        >
          <BedDouble
            className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0"
            style={{ color: '#047857' }}
          />
          <span>ระบบจองเตียงพิเศษสำหรับผู้ให้บริการ</span>
        </h1>
          <p className="text-xs sm:text-sm mt-2 font-bold" style={{ color: '#334155' }}>
            จัดสรรเตียงพิเศษประจำวันและช่วงเวลา โดยระบบจะดึงเฉพาะคิวคนไข้ของคุณจากตาราง Bookings ให้อัตโนมัติ
          </p>
        </div>

        {/* แถบเตือนกรณีเลือกดูข้อมูลย้อนหลัง */}
        {isPastDate && (
          <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-400 rounded-2xl flex items-center gap-3 text-xs sm:text-sm shadow-2xs" style={{ backgroundColor: '#fffbeb', borderColor: '#f59e0b', color: '#78350f' }}>
            <Info className="w-5 h-5 flex-shrink-0" style={{ color: '#d97706' }} />
            <div>
              <span className="font-black">อยู่ในโหมดดูข้อมูลย้อนหลัง:</span> คุณกำลังดูข้อมูลการใช้เตียงประจำวันที่ <strong className="underline">{date}</strong> (ระบบไม่อนุญาตให้ทำการบันทึกจองเตียงย้อนหลังได้)
            </div>
          </div>
        )}

        {/* กรองวันที่และช่วงเวลา */}
        <div className="bg-white rounded-3xl shadow-2xs p-6 border-2 border-slate-300 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center" style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}>
          <div>
            <label className="block text-sm font-black mb-2 flex items-center gap-2" style={{ color: '#0f172a' }}>
              <Calendar className="w-4 h-4" style={{ color: '#047857' }} /> วันที่รับบริการ
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border-2 border-slate-400 rounded-2xl p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-black"
              style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#94a3b8' }}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-black mb-2 flex items-center gap-2" style={{ color: '#0f172a' }}>
              <Clock className="w-4 h-4" style={{ color: '#047857' }} /> เลือกช่วงเวลา
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {timeSlots.map((slot) => {
                const isSelected = selectedSlot === slot;
                const waitingCount = availableBookings.filter(
                  (q) => normalizeSlot(q.time_slot) === normalizeSlot(slot)
                ).length;

                return (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`px-2 py-2.5 rounded-2xl text-xs font-black border-2 transition text-center relative cursor-pointer ${
                      isSelected
                        ? "shadow-md scale-102"
                        : "hover:bg-emerald-100"
                    }`}
                    style={{
                      backgroundColor: isSelected ? '#047857' : '#f8fafc',
                      color: isSelected ? '#ffffff' : '#0f172a',
                      borderColor: isSelected ? '#065f46' : '#cbd5e1'
                    }}
                  >
                    <div>{slot}</div>
                    {waitingCount > 0 && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded-full font-black border"
                        style={{
                          backgroundColor: isSelected ? '#fde047' : '#d1fae5',
                          color: isSelected ? '#0f172a' : '#065f46',
                          borderColor: isSelected ? '#facc15' : '#34d399'
                        }}
                      >
                        คิวคุณ {waitingCount} คน
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ผังแสดงเตียงพิเศษ */}
        <div className="space-y-6 mb-10">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 sm:p-5 rounded-3xl shadow-2xs gap-2 border border-slate-800" style={{ backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#1e293b' }}>
            <h2 className="text-base sm:text-lg font-black flex items-center gap-2" style={{ color: '#ffffff' }}>
              <Building2 className="w-5 h-5 text-emerald-400" style={{ color: '#34d399' }} />
              ผังเตียงพิเศษ ประจำช่วงเวลา: <span className="font-black" style={{ color: '#fde047' }}>{selectedSlot}</span>
            </h2>

            <div className="flex items-center gap-3 text-xs">
              <span className="bg-slate-950 px-3.5 py-1.5 rounded-full font-extrabold flex items-center gap-1.5 border border-slate-700" style={{ backgroundColor: '#020617', color: '#ffffff', borderColor: '#334155' }}>
                <FileCheck className="w-3.5 h-3.5" style={{ color: '#fde047' }} />
                คนไข้ของคุณที่รอลงเตียงในเวลานี้: <strong className="text-sm font-black" style={{ color: '#fde047' }}>{slotMatchingQueues.length}</strong> ราย
              </span>
            </div>
          </div>

          {Object.keys(roomsGrouped).map((roomName) => (
            <div key={roomName} className="bg-white rounded-3xl shadow-2xs p-6 border-2 border-slate-300" style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}>
              <h3 className="text-base font-black mb-4 pb-2 border-b-2 border-slate-200 flex items-center gap-2" style={{ color: '#0f172a', borderColor: '#e2e8f0' }}>
                <Building2 className="w-4 h-4" style={{ color: '#047857' }} /> {roomName}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {roomsGrouped[roomName].map((bed) => {
                  const reservation = getBedReservation(bed.id, selectedSlot);
                  const isReserved = !!reservation;
                  
                  const isPassed = isReserved && (reservation.status === 1 || isBookingPassed(reservation.date, reservation.time_slot));
                  const userCanCancel = isReserved && !isPassed && canCancelBooking(reservation);

                  return (
                    <div
                      key={bed.id}
                      className="border-2 rounded-3xl p-4 transition duration-200 relative overflow-hidden flex flex-col justify-between"
                      style={{
                        backgroundColor: isReserved ? (isPassed ? '#f0fdfa' : '#fff1f2') : '#ecfdf5',
                        borderColor: isReserved ? (isPassed ? '#2dd4bf' : '#f43f5e') : '#34d399',
                        color: '#0f172a'
                      }}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-black text-base" style={{ color: '#0f172a' }}>{bed.bed_name}</span>
                          <span
                            className="text-[10px] px-2.5 py-0.5 rounded-full font-black border-2"
                            style={{
                              backgroundColor: isReserved ? (isPassed ? '#ccfbf1' : '#ffe4e6') : '#d1fae5',
                              color: isReserved ? (isPassed ? '#115e59' : '#9f1239') : '#065f46',
                              borderColor: isReserved ? (isPassed ? '#2dd4bf' : '#f43f5e') : '#34d399'
                            }}
                          >
                            {isReserved ? (isPassed ? "เสร็จสิ้น" : "ไม่ว่าง") : "เตียงว่าง"}
                          </span>
                        </div>
                        <p className="text-[11px] font-black mb-3" style={{ color: '#475569' }}>{bed.bed_code}</p>

                        {isReserved ? (
                          <div className="bg-white p-3 rounded-2xl border-2 space-y-1.5 text-xs mb-3 shadow-2xs" style={{ backgroundColor: '#ffffff', borderColor: isPassed ? '#99f6e4' : '#fca5a5' }}>
                            <p className="font-black truncate" style={{ color: isPassed ? '#115e59' : '#9f1239' }}>
                              คนไข้: {reservation.patient_name}
                            </p>
                            <p className="text-[11px] font-black" style={{ color: '#0f172a' }}>
                              HN: <span className="font-black" style={{ color: '#0f172a' }}>{reservation.hn || "-"}</span>
                            </p>
                            <p className="text-[11px] font-black" style={{ color: '#0f172a' }}>
                              ผู้ให้บริการ: <span className="font-black" style={{ color: '#047857' }}>{reservation.therapist}</span>
                            </p>
                            {reservation.note && (
                              <p className="text-[10px] italic border-t-2 pt-1.5 mt-1 font-bold" style={{ color: '#334155', borderColor: '#f1f5f9' }}>
                                หมายเหตุ: {reservation.note}
                              </p>
                            )}
                            <p className="text-[10px] pt-1 font-extrabold" style={{ color: '#0f172a' }}>
                              สถานะ:{" "}
                              <span className="font-black" style={{ color: isPassed ? '#0f172a' : '#b45309' }}>
                                {isPassed ? "สำเร็จ (เสร็จสิ้น)" : "จองแล้ว"}
                              </span>
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs mb-4 italic font-bold" style={{ color: '#334155' }}>
                            {bed.description || "เตียงพร้อมให้บริการ"}
                          </p>
                        )}
                      </div>

                      {/* การแสดงปุ่มจัดการตามสถานะการจอง */}
                      {isReserved ? (
                        isPassed ? (
                          <div className="w-full py-2 font-black text-[11px] rounded-2xl text-center border-2" style={{ backgroundColor: '#ccfbf1', color: '#0f172a', borderColor: '#5eead4' }}>
                            ✓ ให้บริการเสร็จสิ้น
                          </div>
                        ) : userCanCancel ? (
                          <button
                            onClick={() => handleCancelBedBooking(reservation)}
                            className="w-full py-2 font-black text-xs rounded-2xl border-2 transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                            style={{ backgroundColor: '#ffe4e6', color: '#9f1239', borderColor: '#fb7185' }}
                          >
                            <Trash2 className="w-3.5 h-3.5" style={{ color: '#9f1239' }} /> ยกเลิกการจองเตียงนี้
                          </button>
                        ) : (
                          <div className="w-full py-2 font-black text-[11px] rounded-2xl text-center border-2" style={{ backgroundColor: '#f1f5f9', color: '#64748b', borderColor: '#cbd5e1' }}>
                            (จองโดยผู้อื่น)
                          </div>
                        )
                      ) : isPastDate ? (
                        <button
                          disabled
                          className="w-full py-2 font-black text-xs rounded-2xl text-center cursor-not-allowed border-2"
                          style={{ backgroundColor: '#e2e8f0', color: '#64748b', borderColor: '#cbd5e1' }}
                        >
                          ไม่อนุญาตให้จองย้อนหลัง
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenBookingModal(bed)}
                          className="w-full py-2 font-black text-xs rounded-2xl transition flex items-center justify-center gap-1 border-2 shadow-2xs cursor-pointer"
                          style={{
                            backgroundColor: slotMatchingQueues.length > 0 ? '#047857' : '#f1f5f9',
                            color: slotMatchingQueues.length > 0 ? '#ffffff' : '#334155',
                            borderColor: slotMatchingQueues.length > 0 ? '#065f46' : '#cbd5e1'
                          }}
                        >
                          <Plus className="w-4 h-4" /> เลือกจองเตียงนี้
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ตารางสรุปเตียงพิเศษที่มีการจองในวันนี้ */}
        <div className="bg-white rounded-3xl shadow-xs p-6 border-2 border-slate-300" style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}>
          <h2 className="text-lg font-black mb-4 flex items-center gap-2 border-b-2 border-slate-200 pb-3" style={{ color: '#0f172a', borderColor: '#e2e8f0' }}>
            <ClipboardList className="w-5 h-5" style={{ color: '#047857' }} />
            ตารางเตียงพิเศษที่มีการจองประจำวันที่ {date}
          </h2>

          <div className="overflow-x-auto rounded-2xl border-2 border-slate-300" style={{ borderColor: '#cbd5e1' }}>
            <table className="min-w-full divide-y-2 divide-slate-200 text-sm">
              <thead className="bg-slate-900 text-white" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                <tr>
                  <th className="px-4 py-3.5 text-left font-black">ช่วงเวลา</th>
                  <th className="px-4 py-3.5 text-left font-black">เตียง / ห้อง</th>
                  <th className="px-4 py-3.5 text-left font-black">ชื่อผู้รับบริการ (HN)</th>
                  <th className="px-4 py-3.5 text-left font-black">เบอร์โทร</th>
                  <th className="px-4 py-3.5 text-left font-black">ผู้ให้บริการ (Therapist)</th>
                  <th className="px-4 py-3.5 text-left font-black">สถานะ / หมายเหตุ</th>
                  <th className="px-4 py-3.5 text-center font-black">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-100 bg-white" style={{ backgroundColor: '#ffffff' }}>
                {bedBookings.map((b) => {
                  const isPassed = b.status === 1 || isBookingPassed(b.date, b.time_slot);
                  const userCanCancel = !isPassed && canCancelBooking(b);

                  return (
                    <tr key={b.special_booking_id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5 font-black" style={{ color: '#047857' }}>{b.time_slot}</td>
                      <td className="px-4 py-3.5 font-black" style={{ color: '#0f172a' }}>
                        {b.bed_name}
                        <span className="block text-xs font-bold" style={{ color: '#475569' }}>{b.room_name}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-black" style={{ color: '#0f172a' }}>{b.patient_name}</span>
                        {b.hn && <span className="text-xs font-extrabold block" style={{ color: '#334155' }}>HN: {b.hn}</span>}
                      </td>
                      <td className="px-4 py-3.5 font-black" style={{ color: '#0f172a' }}>{b.patient_phone || "-"}</td>
                      <td className="px-4 py-3.5 font-black" style={{ color: '#047857' }}>{b.therapist || b.provider}</td>
                      <td className="px-4 py-3.5 text-xs font-bold" style={{ color: '#0f172a' }}>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black mr-1.5 border-2"
                          style={{
                            backgroundColor: isPassed ? '#ccfbf1' : '#fef3c7',
                            color: isPassed ? '#115e59' : '#78350f',
                            borderColor: isPassed ? '#2dd4bf' : '#f59e0b'
                          }}
                        >
                          {isPassed ? "สำเร็จ" : "จองแล้ว"}
                        </span>
                        {b.note || "-"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {isPassed ? (
                          <span className="text-xs font-black" style={{ color: '#0f172a' }}>เสร็จสิ้นแล้ว</span>
                        ) : userCanCancel ? (
                          <button
                            onClick={() => handleCancelBedBooking(b)}
                            className="p-1.5 rounded-xl transition cursor-pointer border-2"
                            style={{ backgroundColor: '#ffe4e6', color: '#9f1239', borderColor: '#f43f5e' }}
                            title="ยกเลิกการจองเตียงพิเศษ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-xs italic font-bold" style={{ color: '#64748b' }}>ไม่มีสิทธิ์</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {bedBookings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 italic font-bold" style={{ color: '#64748b' }}>
                      ยังไม่มีการจองเตียงพิเศษในวันที่ {date}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Dialog: เลือกคนไข้ของคุณลงเตียง */}
      <Dialog.Root open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50" />
          <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl p-6 shadow-2xl border-2 border-slate-300 max-h-[90vh] flex flex-col" style={{ backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1' }}>
            <Dialog.Title className="text-lg font-black mb-2 flex justify-between items-center border-b-2 border-slate-200 pb-3" style={{ color: '#0f172a', borderColor: '#e2e8f0' }}>
              <span>ลงเตียง: {selectedBed?.bed_name} ({selectedSlot})</span>
              <button onClick={() => setBookingDialogOpen(false)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Title>

            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-black flex items-center gap-1" style={{ color: '#0f172a' }}>
                  <FileCheck className="w-4 h-4" style={{ color: '#047857' }} />
                  เลือกคิวคนไข้ของคุณจากตาราง Bookings
                </label>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full border" style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#34d399' }}>
                  เวลา {selectedSlot}
                </span>
              </div>

              {slotMatchingQueues.length > 1 && (
                <div className="relative mt-2">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อคนไข้ หรือ HN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border-2 border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-black"
                    style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#94a3b8' }}
                  />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2 max-h-60">
              {filteredSlotQueues.map((q) => {
                const isSelected = selectedQueue?.booking_id === q.booking_id;
                return (
                  <div
                    key={q.booking_id}
                    onClick={() => setSelectedQueue(q)}
                    className="p-3.5 border-2 rounded-2xl cursor-pointer transition flex justify-between items-center"
                    style={{
                      backgroundColor: isSelected ? '#d1fae5' : '#f8fafc',
                      borderColor: isSelected ? '#059669' : '#cbd5e1',
                      color: '#0f172a'
                    }}
                  >
                    <div>
                      <p className="font-black text-sm flex items-center gap-2" style={{ color: '#0f172a' }}>
                        {q.name}
                        {q.hn && (
                          <span className="text-xs font-black px-1.5 py-0.5 rounded-md" style={{ backgroundColor: '#e2e8f0', color: '#0f172a' }}>
                            HN: {q.hn}
                          </span>
                        )}
                      </p>
                      <p className="text-xs font-black mt-1" style={{ color: '#047857' }}>
                        ผู้ให้บริการ: {q.therapist || q.provider}
                      </p>
                      {q.phone && (
                        <p className="text-[11px] font-extrabold mt-0.5" style={{ color: '#334155' }}>เบอร์โทร: {q.phone}</p>
                      )}
                    </div>
                    {isSelected ? (
                      <span className="px-3 py-1 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-2xs" style={{ backgroundColor: '#047857' }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> เลือกคนไข้นี้
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-xl text-xs font-black border" style={{ backgroundColor: '#e2e8f0', color: '#0f172a', borderColor: '#cbd5e1' }}>
                        เลือก
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2 pt-2 border-t-2 border-slate-200" style={{ borderColor: '#e2e8f0' }}>
              <label className="block text-xs font-black mb-1" style={{ color: '#0f172a' }}>หมายเหตุการใช้เตียงพิเศษเพิ่มเติม</label>
              <textarea
                rows={2}
                placeholder="เช่น ผู้ป่วยต้องการหมอนรองหลัง, ปวดเข่ามาก..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full border-2 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none font-black"
                style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#cbd5e1' }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t-2 border-slate-200 mt-3" style={{ borderColor: '#e2e8f0' }}>
              <button
                onClick={() => setBookingDialogOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-black cursor-pointer border"
                style={{ backgroundColor: '#e2e8f0', color: '#0f172a', borderColor: '#cbd5e1' }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmBedBooking}
                disabled={!selectedQueue}
                className="px-5 py-2 text-white rounded-xl text-xs font-black shadow-2xs transition"
                style={{
                  backgroundColor: selectedQueue ? '#047857' : '#cbd5e1',
                  color: selectedQueue ? '#ffffff' : '#64748b',
                  cursor: selectedQueue ? 'pointer' : 'not-allowed'
                }}
              >
                ยืนยันบันทึกการจองเตียง
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}