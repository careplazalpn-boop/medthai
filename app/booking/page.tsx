"use client";

import { useState, useEffect, useContext, useRef, createContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  User as UserIcon,
  Clock,
  AlertCircle,
  AlertTriangle,
  UserCheck,
  UserX,
  Search,
  Loader2,
  Check,
  CheckCircle2,
  X,
  BedDouble
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
        console.log("นำทางไปยัง:", path);
        window.location.href = path;
      }
    },
    refresh: () => {},
  });
}

// === AuthContext ===
let AuthContext: any;
try {
  AuthContext = require("@/context/AuthContext").AuthContext;
} catch (e) {
  AuthContext = createContext({
    user: { name: "นายดุสิทธิ์ ไชยศรีหา", role: "admin", role_id: 909, isAdmin: true },
    logout: () => console.log("Logout triggered"),
  });
}

interface UserInfo {
  hn?: string;
  name: string;
  phone: string;
  id_card_number?: string;
}

interface BookingInfo {
  time_slot: string;
  name: string;
  hn?: string | null; 
  is_new_user_pending?: number | boolean; 
  has_confirmed_hn?: number | boolean; 
  bookedbyrole?: string;
  has_special_bed?: number | boolean;
  bed_name?: string;
  status?: string; 
}

interface Therapist {
  id: number;
  name: string;
  shortname?: string;
  therapist_type?: number;
}

interface MedStaff {
  id: number;
  name: string;
  role_id: number;
}

// 🌟 ฟังก์ชันคำนวณวันที่ (Local Time) ป้องกันปฏิทินค้าง
const getLocalDateStr = (addDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const MIN_DATE_STR = getLocalDateStr(0);
const MAX_DATE_STR = getLocalDateStr(30);

// 🎨 (UI เท่านั้น) แปลงวันที่เป็นข้อความภาษาไทยเพื่อแสดงผล — ไม่ได้ใช้ในการคำนวณ/ส่งข้อมูล
const formatThaiDateLabel = (value: string) => {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  try {
    return new Date(y, m - 1, d).toLocaleDateString("th-TH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return value;
  }
};

export default function BookingPage() {
  const router = useRouterHook();
  const { user, logout } = (useContext(AuthContext) || {}) as { user: any; logout: () => void };
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isGuest = !user;

  const [idCardNumber, setIdCardNumber] = useState("");
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [medStaff, setMedStaff] = useState<MedStaff[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [selectedTherapist, setSelectedTherapist] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [bookedSlots, setBookedSlots] = useState<Record<string, BookingInfo[]>>({});
  const [disabledSlots, setDisabledSlots] = useState<Record<string, string[]>>({});
  const [showAlert, setShowAlert] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientHN, setClientHN] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [searchResults, setSearchResults] = useState<UserInfo[]>([]);
  const [dialogTherapist, setDialogTherapist] = useState<string>("");
  const [offTherapists, setOffTherapists] = useState<string[]>([]);
  const [addPatientDialog, setAddPatientDialog] = useState(false);
  const [noHN, setNoHN] = useState(false);
  const [hn, setHn] = useState("");
  const [patientPrefix, setPatientPrefix] = useState("");
  const [patientFirstName, setPatientFirstName] = useState("");
  const [patientLastName, setPatientLastName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");

  useEffect(() => {
    if (!showAlert) return;
    const timer = setTimeout(() => setShowAlert(false), 2000);
    return () => clearTimeout(timer);
  }, [showAlert]);

  useEffect(() => {
    const savedDate = localStorage.getItem("selectedDate");
    if (savedDate) {
      const today = new Date();
      const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const [year, month, day] = savedDate.split("-").map(Number);
      const selected = new Date(year, month - 1, day);

      if (selected.getTime() < todayLocal.getTime()) {
        localStorage.removeItem("selectedDate");
        setDate(getLocalDateStr(0));
      } else {
        setDate(savedDate);
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      setDialogTherapist(user.name);
    }
  }, [user]);

  useEffect(() => {
    fetch("/api/med-staff")
      .then(res => res.json())
      .then(data => {
        if (data?.success) {
          setMedStaff(data.staff);
        } else {
          setMedStaff([]);
        }
      })
      .catch(() => setMedStaff([]));
  }, []);

  useEffect(() => {
    if (user && medStaff.length > 0) {
      const matched = medStaff.find(
        s => s.role_id !== 0 && Number(s.role_id) === Number(user.role_id)
      );
      setDialogTherapist(matched ? matched.name : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role_id, medStaff]);

  useEffect(() => {
    const roleQuery = user ? `?role=${encodeURIComponent(user.role || "")}&role_id=${encodeURIComponent(user.role_id || "")}` : "";

    fetch(`/api/therapists${roleQuery}`)
      .then(res => res.json())
      .then(data => {
        if (data?.success) setTherapists(data.therapists);
      })
      .catch(() => {
        setTherapists([
          { id: 1, name: "นายดุสิทธิ์ ไชยศรีหา", therapist_type: 909 },
          { id: 2, name: "น.ส.พิมณ์วิไล สิงห์ชัย", therapist_type: 0 }
        ]);
      });          

    fetch("/api/time-slots")
      .then(res => res.json())
      .then(data => data?.success && setTimeSlots(data.timeSlots))
      .catch(() => {
        setTimeSlots([
          "8:00-9:30",
          "9:30-11:00",
          "11:00-12:30",
          "13:00-14:30",
          "14:30-16:00",
          "16:00-17:30"
        ]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.role_id]);

  useEffect(() => {
    if (!date) {
      setBookedSlots({});
      setOffTherapists([]);
      setDisabledSlots({});
      setSelectedTherapist("");
      setSelectedTime("");
      return;
    }

    const roleQuery = user ? `&role=${encodeURIComponent(user.role || "")}&role_id=${encodeURIComponent(user.role_id || "")}` : "";

    fetchWithLoading(`/api/bookings?date=${encodeURIComponent(date)}${roleQuery}`, data => {
      if (data?.success) {
        const grouped: Record<string, BookingInfo[]> = {};
        data.bookings.forEach((b: any) => {
          if (!grouped[b.therapist]) grouped[b.therapist] = [];
          grouped[b.therapist].push({
            time_slot: b.time_slot,
            name: b.name,
            hn: b.hn,
            is_new_user_pending: b.is_new_user_pending,
            has_confirmed_hn: b.has_confirmed_hn,
            bookedbyrole: b.bookedbyrole,
            has_special_bed: b.has_special_bed,
            bed_name: b.bed_name,
            status: b.status
          });
        });
        setBookedSlots(grouped);
      } else setBookedSlots({});
    });

    fetchWithLoading(`/api/off-therapists?date=${encodeURIComponent(date)}`, data => {
      setOffTherapists(data?.success ? data.offTherapists || [] : []);
      setDisabledSlots(data?.success ? data.disabledSlotsByTherapist || {} : {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, user?.role, user?.role_id]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    return digits.length <= 3 ? digits : `${digits.slice(0, 3)}-${digits.slice(3)}`;
  };
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => setClientPhone(formatPhone(e.target.value));

  const handleSelect = (therapist: string, time: string) => {
    if (!date) return setShowAlert(true);
    setSelectedTherapist(therapist);
    setSelectedTime(time);
  };

  const handleSubmit = () => {
    if (isGuest) {
      alert("โหมดดูอย่างเดียว ไม่สามารถบันทึกการจองได้");
      return;
    }
    if (!clientName || !clientPhone || !date || !selectedTherapist || !selectedTime) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    if (!clientHN && !noHN) {
      alert("กรุณากรอก HN ให้ครบ 9 ตัว");
      return;
    }

    router.push(`/confirm?${new URLSearchParams({
      hn: clientHN,
      name: clientName,
      phone: clientPhone,
      idCard: idCardNumber,
      date,
      therapist: selectedTherapist,
      provider: selectedTherapist,
      time: selectedTime,
      bookedbyrole: user?.role || "user"
    }).toString()}`);
  };

  const handleOpenDialog = () => {
    if (isGuest) {
      alert("โหมดดูอย่างเดียว ไม่สามารถเปิดการจองได้");
      return;
    }
    if (!selectedTime || !date) {
      setShowAlert(true);
      return;
    }

    setClientHN("");
    setClientName("");
    setClientPhone("");
    setSearchResults([]);
    setIdCardNumber("");
    setNoHN(false);

    setDialogOpen(true);
  };

  const handleSearchHN = async () => {
    if (!clientHN.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search-users?hn=${encodeURIComponent(clientHN.trim())}`);
      const data = await res.json();
      setSearchResults(data?.success ? data.users : []);
      if (!data?.success) alert("ไม่พบผู้ใช้");
    } catch {
      alert("เกิดข้อผิดพลาดในการค้นหา");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchName = async () => {
    if (!clientName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search-users?name=${encodeURIComponent(clientName.trim())}`);
      const data = await res.json();
      setSearchResults(data?.success ? data.users : []);
      if (!data?.success) alert("ไม่พบข้อมูลผู้ใช้");
    } catch {
      alert("เกิดข้อผิดพลาดในการค้นหา");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPatient = async () => {
    if (isGuest) {
      alert("โหมดดูอย่างเดียว ไม่สามารถเพิ่มคนไข้ได้");
      return;
    }

    const digitsPhone = patientPhone.replace(/\D/g, "");
    if (!hn || !patientPrefix || !patientFirstName || !patientLastName || !digitsPhone) {
      alert("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    if (hn.length !== 9) {
      alert("กรุณากรอก HN ให้ครบ 9 ตัว");
      return;
    }

    const fullName = `${patientPrefix}${patientFirstName} ${patientLastName}`;

    try {
      const res = await fetch("/api/add-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hn,
          pname: patientPrefix,
          fname: patientFirstName,
          lname: patientLastName,
          name: fullName,
          mobile_phone_number: patientPhone,
        }),
      });

      const data = await res.json();

      if (data?.success) {
        alert(data.message || "เพิ่มคนไข้เรียบร้อยแล้ว");
        setAddPatientDialog(false);
        setHn("");
        setPatientPrefix("");
        setPatientFirstName("");
        setPatientLastName("");
        setPatientPhone("");
      } else {
        alert(data?.message || "ไม่สามารถเพิ่มคนไข้ได้");
      }
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการเพิ่มคนไข้");
    }
  };

  const handleSelectUser = (user: UserInfo) => {
    setClientName(user.name);
    setClientHN(user.hn || "");
    setClientPhone(formatPhone(user.phone || ""));
    setIdCardNumber(user.id_card_number || "");
    setSearchResults([]);
  };

  // 🌟 ปรับปรุง 1: ส่ง Role ไปด้วย เพื่อให้ API เช็คสิทธิ์ว่าใครกดปิด (ทั้งวัน)
  const toggleOffTherapist = async (therapist: string) => {
    if (isGuest) {
      alert("โหมดดูอย่างเดียว ไม่สามารถอัปเดตหมอไม่มาได้");
      return;
    }
    if (!date) return alert("กรุณาเลือกวันที่ก่อน");
    try {
      const res = await fetch("/api/toggle-off-therapist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 🌟 ส่ง Role เข้าไปด้วย (Admin / 909 หรือ user)
        body: JSON.stringify({ therapist, date, role: user?.role || "user" }),
      });
      const data = await res.json();
      if (data?.success) {
        setOffTherapists(prev => prev.includes(therapist) ? prev.filter(t => t !== therapist) : [...prev, therapist]);
      } else {
        // 🌟 ดัก Alert แจ้งเตือนหากโดนแอดมินล็อค (API ส่ง error กลับมา)
        alert(data.error || "ไม่สามารถอัปเดตหมอไม่มาได้");
      }
    } catch { 
      alert("เกิดข้อผิดพลาดในการอัปเดตหมอไม่มา"); 
    }
  };

  // 🌟 ปรับปรุง 2: ส่ง Role ไปด้วย เพื่อให้ API เช็คสิทธิ์ว่าใครกดปิด (ราย Slot)
  const toggleSlot = async (therapist: string, slot: string) => {
    if (isGuest) {
      alert("โหมดดูอย่างเดียว ไม่สามารถอัปเดต slot ได้");
      return;
    }
    if (!date) return alert("กรุณาเลือกวันที่ก่อน");

    const slotInfo = bookedSlots[therapist]?.find(b => b.time_slot === slot);
    const hasSpecialBed = !!slotInfo?.has_special_bed;

    if (slotInfo?.status === "สำเร็จ") {
      alert(`ไม่สามารถเปิด/ปิดช่วงเวลา ${slot} ได้!\n\nเนื่องจากการให้บริการ "${slotInfo?.name}" ในช่วงเวลานี้สำเร็จไปแล้ว`);
      return;
    }

    if (hasSpecialBed) {
      const bedName = slotInfo?.bed_name ? ` (${slotInfo.bed_name})` : "";
      alert(`ไม่สามารถยกเลิกการให้บริการในช่วงเวลา ${slot} ได้!\n\nเนื่องจากมีการจองเตียงพิเศษ${bedName} ของคุณ "${slotInfo?.name}" ในช่วงเวลานี้แล้ว`);
      return;
    }

    // ✅ ใหม่: ห้ามปิดช่วงเวลาที่มีการจองคิวแล้ว (ไม่ว่าจะมีเตียงหรือไม่)
    // บล็อกเฉพาะกรณี "กำลังจะปิด" — ถ้าช่วงเวลานี้ถูกปิดอยู่แล้ว ยังกดเพื่อเปิดกลับได้ตามเดิม
    const isCurrentlyClosed = (disabledSlots[therapist] || []).includes(slot);
    if (slotInfo && !isCurrentlyClosed) {
      alert(`ไม่สามารถปิดช่วงเวลา ${slot} ได้!\n\nเนื่องจากมีการจองคิวของ "${slotInfo.name || "ไม่ระบุ"}" ในช่วงเวลานี้แล้ว`);
      return;
    }

    try {
      const res = await fetch("/api/toggle-off-therapist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 🌟 ส่ง Role เข้าไปด้วยเพื่อเช็คสิทธิ์บน Backend
        body: JSON.stringify({ therapist, date, slot, role: user?.role || "user" }),
      });
      const data = await res.json();
      if (data?.success) {
        setDisabledSlots(prev => {
          const current = prev[therapist] || [];
          const updated = current.includes(slot) ? current.filter(s => s !== slot) : [...current, slot];
          return { ...prev, [therapist]: updated };
        });
      } else {
        // 🌟 ดัก Alert แจ้งเตือน หาก Backend ส่งบอกว่าโดน Admin ล็อคไว้
        alert(data.error || "ไม่สามารถอัปเดตช่วงเวลาได้");
      }
    } catch { 
      alert("เกิดข้อผิดพลาดในการอัปเดต slot"); 
    }
  };

  const fetchWithLoading = async (url: string, setter: (data: any) => void) => {
    setLoading(true);
    try {
      const res = await fetch(url);
      const data = await res.json();
      setter(data);
    } catch (err) {
      console.error(err);
      setter(null);
    } finally {
      setLoading(false);
    }
  };

  const filteredTherapists = user
    ? user.role_id === 909
      ? therapists
      : therapists.filter(t => t.id === user.role_id)
    : therapists;

  // 🎨 ค่าคงที่สำหรับ UI (class ที่ใช้ซ้ำ)
  const inputBase =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-100";
  const labelBase = "mb-1.5 block text-sm font-semibold text-slate-700";

  const legendItems: { color: string; label: string; staffOnly?: boolean }[] = [
    { color: "bg-emerald-500", label: "ว่าง" },
    { color: "bg-rose-400", label: "ไม่ว่าง" },
    { color: "bg-violet-400", label: "จองโดยแอดมิน", staffOnly: true },
    { color: "bg-amber-400", label: "รอบันทึก HN / แพทย์พิเศษ", staffOnly: true },
    { color: "bg-sky-400", label: "ให้บริการสำเร็จ", staffOnly: true },
    { color: "bg-slate-300", label: "ปิด/หยุด" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-emerald-200 via-slate-200 to-teal-200">
      {/* พื้นหลังตกแต่ง */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 -left-32 h-96 w-96 rounded-full bg-teal-200/30 blur-3xl" />

      {loading && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-2xl">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-sm font-semibold text-slate-700">กำลังโหลดข้อมูล...</span>
          </div>
        </div>
      )}

      {/* ปุ่ม "HN ?" (เฉพาะ admin) — ย้ายมาเป็น element ของหน้าเอง
          เพราะ HamburgerMenu ย้ายไปอยู่ใน layout.tsx (global) แล้ว
          ไม่สามารถส่ง rightSlot เฉพาะหน้าเข้าไปได้อีกต่อไป */}
      {user?.role === "admin" && (
        <>
          <button
            onClick={() => setAddPatientDialog(true)}
            className="fixed top-16 right-3 z-40 flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-100 bg-white/90 px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-lg backdrop-blur transition hover:bg-emerald-50 hover:shadow-xl sm:right-4 sm:text-sm"
            title="คนไข้มี HN แต่หาไม่เจอ"
          >
            <Search className="h-3.5 w-3.5" />
            HN ?
          </button>
          <Dialog.Root
            open={addPatientDialog}
            onOpenChange={(open) => {
              setAddPatientDialog(open);
              if (!open) {
                setHn("");
                setPatientPrefix("");
                setPatientFirstName("");
                setPatientLastName("");
                setPatientPhone("");
              }
            }}
          >
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
                <Dialog.Title className="mb-1 text-xl font-bold text-emerald-800">
                  เพิ่มข้อมูลคนไข้
                </Dialog.Title>
                <p className="mb-5 text-sm text-slate-500">เพิ่มเสร็จแล้วให้จองใหม่อีกครั้ง</p>

                <label className="mb-4 block">
                  <span className={labelBase}>HN</span>
                  <input
                    type="text"
                    value={hn}
                    onChange={e => setHn(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    placeholder="กรอก HN (9 หลัก)"
                    maxLength={9}
                    className={inputBase}
                  />
                </label>

                <div className="mb-4 flex gap-2">
                  <label className="flex w-24 flex-col">
                    <span className={labelBase}>คำนำหน้า</span>
                    <input
                      type="text"
                      value={patientPrefix}
                      onChange={e => setPatientPrefix(e.target.value)}
                      placeholder="คำย่อ"
                      className={inputBase}
                    />
                  </label>
                  <label className="flex flex-1 flex-col">
                    <span className={labelBase}>ชื่อจริง</span>
                    <input
                      type="text"
                      value={patientFirstName}
                      onChange={e => setPatientFirstName(e.target.value)}
                      placeholder="ชื่อ"
                      className={inputBase}
                    />
                  </label>
                  <label className="flex flex-1 flex-col">
                    <span className={labelBase}>นามสกุล</span>
                    <input
                      type="text"
                      value={patientLastName}
                      onChange={e => setPatientLastName(e.target.value)}
                      placeholder="นามสกุล"
                      className={inputBase}
                    />
                  </label>
                </div>

                <label className="mb-2 block">
                  <span className={labelBase}>เบอร์โทร</span>
                  <input
                    type="text"
                    inputMode="tel"
                    value={patientPhone}
                    onChange={e => {
                      let digits = e.target.value.replace(/\D/g, "");
                      if (digits.length > 3) {
                        digits = digits.slice(0, 3) + "-" + digits.slice(3, 10);
                      }
                      setPatientPhone(digits.slice(0, 11));
                    }}
                    placeholder="กรอกเบอร์โทร"
                    maxLength={11}
                    className={inputBase}
                  />
                </label>

                <div className="mt-6 flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <button className="cursor-pointer rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">
                      ยกเลิก
                    </button>
                  </Dialog.Close>
                  <button
                    onClick={handleAddPatient}
                    className="cursor-pointer rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700"
                  >
                    ยืนยัน
                  </button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      )}

      <div className="relative z-10 mx-auto max-w-[1400px] px-4 pb-16 pt-24 sm:px-6">
        {/* ===== Header ===== */}
        <header className="mb-8 text-center">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            <CalendarIcon className="h-3.5 w-3.5" />
            {isGuest ? "โหมดดูอย่างเดียว" : "ระบบนัดหมาย"}
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-emerald-900 sm:text-4xl">
            {isGuest ? "ดูคิวจองนวดแผนไทย" : "ผู้ให้บริการแพทย์แผนไทยและช่วงเวลา"}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-700 sm:text-base">
            {isGuest ? "เลือกวันที่เพื่อดูช่วงเวลาที่ว่างของแต่ละท่าน" : "เลือกวันที่ ผู้ให้บริการ และช่วงเวลาที่ต้องการนัดหมาย"}
          </p>
        </header>

        {/* ===== Date picker card ===== */}
        <section className="mx-auto mb-6 max-w-md rounded-3xl border border-emerald-200 bg-white p-5 shadow-lg shadow-emerald-900/10">
          <label className="mb-2 flex items-center gap-2 text-base font-bold text-emerald-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100">
              <CalendarIcon className="h-4 w-4 text-emerald-700" />
            </span>
            {isGuest ? "เลือกวันที่ต้องการดู" : "เลือกวันที่ต้องการนวด"}
          </label>
          <input
            type="date"
            value={date || ""}
            min={MIN_DATE_STR}
            max={MAX_DATE_STR}
            onChange={e => {
              const val = e.target.value;
              setDate(val);
              if (val) {
                localStorage.setItem("selectedDate", val);
              } else {
                localStorage.removeItem("selectedDate");
              }
            }}
            className={`w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-100 ${!date ? "text-slate-400" : "text-slate-900"}`}
          />
          <p className="mt-2 min-h-[1.25rem] text-center text-sm font-medium text-emerald-700">
            {date ? formatThaiDateLabel(date) : "ยังไม่ได้เลือกวันที่"}
          </p>
        </section>

        {/* ===== Selection summary (แสดงเมื่อเลือกช่วงเวลาแล้ว) ===== */}
        <AnimatePresence>
          {!isGuest && selectedTherapist && selectedTime && date && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-auto mb-6 flex max-w-2xl flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-emerald-200 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20"
            >
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />เลือกแล้ว</span>
              <span className="flex items-center gap-1.5"><UserIcon className="h-4 w-4" />{selectedTherapist}</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{selectedTime}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== Legend ===== */}
        <div className="mx-auto mb-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-xs font-medium text-slate-700 shadow-sm sm:text-sm">
          {legendItems
            .filter(item => !item.staffOnly || !isGuest)
            .map(item => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                {item.label}
              </span>
            ))}
        </div>

        {/* ===== Therapist & slots rendering (แนวขวาง: 1 แถว = 1 ผู้ให้บริการ, ช่วงเวลาแบ่งคอลัมน์) ===== */}
        <div className="flex flex-col gap-4">
          {filteredTherapists.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-slate-500">
              <UserIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              ไม่พบรายชื่อผู้ให้บริการ
            </div>
          )}
          {filteredTherapists.map((t, idx) => {
            const isSelected = selectedTherapist === t.name;
            const isOff = offTherapists.includes(t.name);
            const disabled = disabledSlots[t.name] || [];
            const isSpecialType = t.therapist_type === 1;
            // 🎨 (UI เท่านั้น) นับช่วงเวลาที่ยังว่างเพื่อแสดงเป็นป้ายสรุป
            const freeCount = isOff
              ? 0
              : timeSlots.filter(
                  s => !disabled.includes(s) && !bookedSlots[t.name]?.some(b => b.time_slot === s)
                ).length;

            return (
              <div
                key={t.name}
                className={`flex flex-col gap-4 rounded-3xl border p-4 transition-all duration-300 sm:p-5 lg:flex-row lg:items-stretch lg:gap-5 ${
                  isOff
                    ? "border-slate-300 border-l-[6px] border-l-slate-400 bg-slate-100"
                    : isSpecialType
                    ? "border-amber-300 border-l-[6px] border-l-amber-500 bg-gradient-to-r from-amber-100 via-amber-50 to-white"
                    : "border-emerald-300 border-l-[6px] border-l-emerald-600 bg-gradient-to-r from-emerald-100 via-white to-white"
                } ${
                  isSelected
                    ? "shadow-xl shadow-emerald-700/20 ring-4 ring-emerald-300"
                    : "shadow-lg shadow-slate-900/10 hover:shadow-xl"
                }`}
              >
                {/* ===== ซ้าย: ข้อมูลผู้ให้บริการ + ปุ่มจัดการ ===== */}
                <div className="flex flex-col justify-between gap-3 lg:w-64 lg:flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-bold shadow-sm ${
                        isOff
                          ? "bg-slate-300 text-slate-600"
                          : isSpecialType
                          ? "bg-gradient-to-br from-amber-400 to-amber-500 text-white"
                          : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                      }`}
                    >
                      <UserIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        className={`text-base font-bold leading-snug sm:text-lg ${
                          isOff ? "text-slate-500" : isSpecialType ? "text-amber-700" : "text-emerald-900"
                        }`}
                      >
                        {idx + 1}. {t.shortname}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {isSpecialType && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">แพทย์พิเศษ</span>
                        )}
                        {isOff ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">วันนี้ไม่มา</span>
                        ) : date && timeSlots.length > 0 ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              freeCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"
                            }`}
                          >
                            ว่าง {freeCount}/{timeSlots.length}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {date && !isGuest && (
                      <button
                        onClick={() => toggleOffTherapist(t.name)}
                        className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-95 active:scale-95 ${
                          isOff
                            ? "bg-rose-500 hover:bg-rose-600"
                            : "bg-emerald-500 hover:bg-emerald-600"
                        }`}
                      >
                        {isOff ? "ไม่มา" : "มา"}{isOff ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    )}
                    {!isGuest && (
                      <button
                        onClick={handleOpenDialog}
                        disabled={!(isSelected && selectedTime && date) || isOff}
                        className={`w-full cursor-pointer rounded-xl py-2.5 text-center text-sm font-bold transition active:scale-[0.99] ${
                          isSelected && selectedTime && date && !isOff
                            ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700"
                            : "cursor-not-allowed bg-slate-100 text-slate-400"
                        }`}
                      >
                        เลือก
                      </button>
                    )}
                  </div>
                </div>

                {/* ===== ขวา: ช่วงเวลา แบ่งคอลัมน์ตามจำนวน time slot (ปกติ 6 คอลัมน์) ===== */}
                <div
                  style={{ ["--cols" as any]: timeSlots.length || 6 }}
                  className="grid flex-1 grid-cols-2 gap-2.5 border-t border-slate-300/70 pt-4 sm:grid-cols-3 lg:border-l lg:border-l-slate-300/70 lg:border-t-0 lg:pl-5 lg:pt-0 lg:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
                >
                  {timeSlots.map(slot => {
                    const slotInfo = bookedSlots[t.name]?.find(b => b.time_slot === slot);
                    const isBooked = !!slotInfo;
                    const isActive = isSelected && selectedTime === slot;
                    const isSlotDisabled = disabled.includes(slot);
                    const hasSpecialBed = !!slotInfo?.has_special_bed;
                    // ✅ ใหม่: คิวในช่วงเวลานี้ให้บริการสำเร็จแล้ว (bookings.status = "สำเร็จ")
                    const isServiceDone = isBooked && slotInfo?.status === "สำเร็จ";
                    // 📌 ผู้มารับบริการรายใหม่ที่จองโดยยังไม่มี HN (รอเจ้าหน้าที่บันทึกข้อมูลให้สมบูรณ์ในตาราง new_user)
                    // 📌 "รอบันทึก HN" = ตรงกับข้อมูลใน new_user (เบอร์โทร) และยังไม่พบว่ามี HN ยืนยันแล้วใน med_user
                    // (ไม่พึ่งพา bookings.hn อย่างเดียว เพราะอาจไม่ได้ถูกบันทึกไว้ครบทุกกรณี)
                    const isPendingHN = isBooked && !!slotInfo?.is_new_user_pending && !slotInfo?.has_confirmed_hn;

                    let bookedBg = "bg-rose-50 text-rose-600 border-rose-200";

                    if (!isGuest && slotInfo?.bookedbyrole === "admin") {
                      bookedBg = "bg-violet-50 text-violet-700 border-violet-200";
                    }
                    if (!isGuest && isServiceDone) {
                      bookedBg = "bg-sky-50 text-sky-700 border-sky-200";
                    }
                    if (!isGuest && isPendingHN) {
                      bookedBg = "bg-amber-50 text-amber-700 border-amber-200";
                    }
                    return (
                      <div key={slot} className="flex min-w-0 flex-col gap-1.5">
                        <button
                          disabled={isBooked || isOff || isSlotDisabled || isGuest}
                          onClick={() => handleSelect(t.name, slot)}
                          aria-pressed={isActive}
                          className={`flex min-h-[96px] min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-sm font-medium transition-all duration-150
                            ${
                              isSlotDisabled || isOff
                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                : isBooked
                                ? `${bookedBg} cursor-not-allowed`
                                : isActive
                                ? "scale-[1.03] cursor-pointer border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-600/25"
                                : isSpecialType
                                ? "cursor-pointer border-amber-200 bg-white text-amber-800 shadow-sm hover:border-amber-300 hover:bg-amber-50"
                                : "cursor-pointer border-slate-200 bg-white text-emerald-800 shadow-sm hover:border-emerald-300 hover:bg-emerald-50"
                            }`}
                        >
                          <div className="flex items-center gap-1 text-[13px] font-bold sm:text-sm">
                            <Clock className="h-3.5 w-3.5 flex-shrink-0" /> {slot}
                          </div>
                          {isBooked ? (
                            <div className="flex w-full min-w-0 flex-col items-center gap-1 text-xs">
                              <span className="w-full truncate text-center">{!isGuest ? `(${slotInfo?.name || "ไม่ระบุ"})` : "ไม่ว่าง"}</span>
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                {/* แสดงสัญลักษณ์เตือน: ผู้มารับบริการรายใหม่ยังไม่มี HN สมบูรณ์ (รอบันทึกจาก new_user) */}
                                {!isGuest && isPendingHN && (
                                  <span
                                    className="inline-flex items-center gap-0.5 rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
                                    title="ผู้มารับบริการรายใหม่ ยังไม่มี HN — รอเจ้าหน้าที่บันทึกข้อมูลให้สมบูรณ์"
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                                    <span className="hidden xl:inline">รอบันทึก HN</span>
                                  </span>
                                )}
                                {/* ✅ ใหม่: สัญลักษณ์ว่าบริการช่วงเวลานี้สำเร็จแล้ว (แสดงเฉพาะเจ้าหน้าที่ที่ login) */}
                                {!isGuest && isServiceDone && (
                                  <span
                                    className="inline-flex items-center gap-0.5 rounded-md border border-sky-300 bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800"
                                    title="ให้บริการในช่วงเวลานี้สำเร็จแล้ว"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 text-sky-700" />
                                    <span className="hidden xl:inline">สำเร็จแล้ว</span>
                                  </span>
                                )}
                                {/* แสดงสัญลักษณ์ไอคอนเตียงพิเศษ */}
                                {hasSpecialBed && (
                                  <span
                                    className="inline-flex items-center gap-0.5 rounded-md border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800"
                                    title={slotInfo?.bed_name ? `เตียงพิเศษ: ${slotInfo.bed_name}` : "ใช้เตียงพิเศษ"}
                                  >
                                    <BedDouble className="h-3.5 w-3.5 text-emerald-700" />
                                    {/* แสดงชื่อ/หมายเลขเตียงจาก special_beds.bed_name แทนข้อความ "เตียงพิเศษ" */}
                                    {slotInfo?.bed_name && <span>{slotInfo.bed_name}</span>}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : isOff || isSlotDisabled ? (
                            <span className="text-[11px] font-semibold text-slate-400">ปิดให้บริการ</span>
                          ) : isActive ? (
                            <span className="flex items-center gap-1 text-[11px] font-semibold">
                              <CheckCircle2 className="h-3 w-3" />เลือกอยู่
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />ว่าง
                            </span>
                          )}
                        </button>
                        {date && !isGuest && (
                          <button
                            onClick={() => toggleSlot(t.name, slot)}
                            disabled={isServiceDone}
                            className={`flex cursor-pointer items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-semibold text-white shadow-sm transition active:scale-95 ${
                              isServiceDone
                                ? "cursor-not-allowed bg-sky-400 opacity-70"
                                : isOff
                                ? "cursor-not-allowed bg-slate-400"
                                : isSlotDisabled
                                ? "bg-rose-500 hover:bg-rose-600"
                                : "bg-emerald-500 hover:bg-emerald-600"
                            } ${hasSpecialBed || (isBooked && !isSlotDisabled) ? "cursor-not-allowed opacity-60" : ""}`}
                            title={isServiceDone ? "ให้บริการสำเร็จแล้ว ไม่สามารถเปิด/ปิดช่องเวลานี้ได้" : hasSpecialBed ? "ไม่สามารถปิดช่องเวลานี้ได้เนื่องจากมีการจองเตียงพิเศษแล้ว" : isBooked && !isSlotDisabled ? "ไม่สามารถปิดช่องเวลานี้ได้เนื่องจากมีการจองคิวแล้ว" : "เปิด/ปิด การให้บริการช่องเวลานี้"}
                          >
                            {isServiceDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : isSlotDisabled ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                            <span>{isServiceDone ? "สำเร็จ" : isSlotDisabled ? "ปิดอยู่" : "เปิดอยู่"}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ===== Booking dialog ===== */}
        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
              <Dialog.Title className="mb-3 flex items-center justify-between gap-3 text-xl font-bold text-emerald-800">
                <span>กรอกข้อมูลผู้มารับบริการ</span>
                <button
                  type="button"
                  onClick={() => {
                    setNoHN(prev => !prev);
                    setClientHN("");
                    setClientName("");
                    setClientPhone("");
                    setIdCardNumber("");
                    setSearchResults([]);
                  }}
                  className="cursor-pointer whitespace-nowrap rounded-full bg-emerald-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                >
                  {noHN ? "กลับ" : "คนไข้ใหม่"}
                </button>
              </Dialog.Title>

              {/* สรุปรายการที่เลือก */}
              <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <span className="flex items-center gap-1.5"><UserIcon className="h-4 w-4" />{selectedTherapist}</span>
                <span className="flex items-center gap-1.5"><CalendarIcon className="h-4 w-4" />{date}</span>
                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{selectedTime}</span>
              </div>

              {["hn", "name", "phone"].map((field) => {
                if (field === "hn" && noHN) return null;

                return (
                  <label key={field} className="mb-4 block">
                    <span className={labelBase}>
                      {field === "hn" ? "HN" : field === "name" ? "ผู้มารับบริการ" : "เบอร์โทร"}
                    </span>
                    <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100">
                      <input
                        type="text"
                        value={
                          field === "hn" ? clientHN : field === "name" ? clientName : clientPhone
                        }
                        onChange={(e) =>
                          field === "hn"
                            ? setClientHN(e.target.value)
                            : field === "name"
                            ? setClientName(e.target.value)
                            : handlePhoneChange(e)
                        }
                        maxLength={field === "hn" ? 9 : field === "phone" ? 11 : undefined}
                        placeholder={
                          field === "hn" ? "กรอก HN" : field === "name" ? "กรอกชื่อ" : "กรอกเบอร์โทร"
                        }
                        className="flex-1 bg-transparent px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      />
                      {(field === "name" || field === "hn") && !noHN && (
                        <button
                          type="button"
                          onClick={() =>
                            field === "name" ? handleSearchName() : handleSearchHN()
                          }
                          disabled={loading}
                          className="flex cursor-pointer items-center justify-center bg-emerald-500 px-4 py-2 text-white transition hover:bg-emerald-600 disabled:opacity-60"
                          aria-label="ค้นหา"
                        >
                          <Search className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </label>
                );
              })}

              {noHN && (
                <label className="mb-4 block">
                  <span className={labelBase}>หมายเลขบัตรประชาชน</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={idCardNumber}
                    onChange={e =>
                      setIdCardNumber(e.target.value.replace(/\D/g, "").slice(0, 13))
                    }
                    maxLength={13}
                    placeholder="กรอกหมายเลขบัตรประชาชน"
                    className={inputBase}
                  />
                </label>
              )}

              {searchResults.length > 0 && (
                <div className="mb-4 max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-inner">
                  {searchResults.map(u => (
                    <button
                      key={u.hn || u.name}
                      onClick={() => handleSelectUser(u)}
                      className="flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-slate-900 transition hover:bg-emerald-50"
                    >
                      <span className="flex flex-col items-start text-left">
                        <span className="font-semibold">{u.name}</span>
                        {/* ✅ ใหม่: แสดง HN เพิ่มเติมใต้ชื่อ (แสดงเฉพาะเมื่อมีค่า HN เท่านั้น) */}
                        {u.hn ? (
                          <span className="text-xs text-slate-500">HN: {u.hn}</span>
                        ) : (
                          // ✅ ใหม่: ถ้ายังไม่มี HN ให้แจ้งว่าเป็นข้อมูลชั่วคราว/ยังไม่สมบูรณ์ แทนบรรทัด HN
                          <span
                            className="text-xs font-medium text-amber-600"
                            title="ยังไม่มี HN — รอเจ้าหน้าที่บันทึกข้อมูลให้สมบูรณ์"
                          >
                            ⚠ ข้อมูลชั่วคราว ยังไม่มี HN
                          </span>
                        )}
                      </span>
                      <span className="text-right text-sm text-slate-500">{u.phone || "ไม่มีเบอร์"}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button className="cursor-pointer rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">ยกเลิก</button>
                </Dialog.Close>
                <button
                  onClick={handleSubmit}
                  className="cursor-pointer rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700"
                >
                  ยืนยัน
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* ===== Alert popup ===== */}
        <AnimatePresence>
          {showAlert && (
            <motion.div
              key={Date.now()}
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-rose-500/30"
            >
              <AlertCircle className="h-5 w-5" />
              <span>กรุณาเลือกวันที่ก่อน</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
