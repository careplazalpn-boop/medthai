"use client";

import { useState, useEffect, useContext, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AuthContext } from "@/context/AuthContext";
import { CalendarIcon, UserIcon, Clock, AlertCircle, UserCheck, UserX, Search, Eye, Loader2 } from "lucide-react";
import { FaCheck, FaTimes } from "react-icons/fa";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2 } from "lucide-react";
// ❌ ไม่ import/render <HamburgerMenu /> ในหน้านี้ เพราะ app/layout.tsx render ให้ทุกหน้าอยู่แล้ว
// (ดู layout.tsx: <AuthProvider><HamburgerMenu />{children}</AuthProvider>)
// การ import ซ้ำในหน้านี้จะทำให้เมนูขึ้นซ้อนกัน 2 แถบ — เมนูเดิมของหน้านี้ (ทั้ง state/JSX
// แถบเมนูบนสุด + แผง dropdown) จึงถูกลบออกทั้งหมด ให้ใช้เมนูกลางจาก HamburgerMenu.tsx แทน

interface UserInfo {
  hn?: string;
  name: string;
  phone: string;
  id_card_number?: string;
}

interface BookingInfo {
  time_slot: string;
  name: string;
  bookedbyrole?: string;
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
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const isReadOnly = true;
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

  // --- State สำหรับ Dashboard สรุปคิวแพทย์ทั่วไป (UI เหมือนหน้า booking) ---
  const [generalStats, setGeneralStats] = useState({
    totalCapacity: 0,
    booked: 0,
    available: 0,
    disabled: 0
  });

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
      setDialogTherapist(user.name); // ใช้ชื่อ user เป็น provider/therapist
    }
  }, [user]);

  useEffect(() => {
  fetch("/api/med-staff")
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // data.staff ต้องเป็น MedStaff[]
        setMedStaff(data.staff);
      } else {
        setMedStaff([]);
      }
    })
    .catch(() => setMedStaff([]));
}, []);

 // ✅ ตั้งค่าเริ่มต้นให้ dialogTherapist เมื่อ user และ medStaff พร้อมแล้ว
    useEffect(() => {
      if (user && medStaff.length > 0) {
        const matched = medStaff.find(
          s => s.role_id !== 0 && Number(s.role_id) === Number(user.role_id)
        );
      setDialogTherapist(matched ? matched.name : "");
      }
    }, [user, medStaff]);

  useEffect(() => {
      fetch("/api/therapists")
      .then(res => res.json())
      .then(data => {
        console.log("Fetched therapists:", data.therapists);
        if (data.success) setTherapists(data.therapists);
      })
      .catch(() => setTherapists([]));
      fetch("/api/time-slots")
      .then(res => res.json())
      .then(data => data.success && setTimeSlots(data.timeSlots))
      .catch(() => setTimeSlots([]));
  }, []);

  useEffect(() => {
    if (!date) {
      setBookedSlots({});
      setOffTherapists([]);
      setDisabledSlots({});
      setSelectedTherapist("");
      setSelectedTime("");
      return;
    }

  fetchWithLoading(`/api/bookings-audit?date=${encodeURIComponent(date)}`, data => {
    if (data?.success) {
      const grouped: Record<string, BookingInfo[]> = {};
      data.bookings.forEach((b: any) => {
        if (!grouped[b.therapist]) grouped[b.therapist] = [];
        grouped[b.therapist].push({ time_slot: b.time_slot, name: b.name, bookedbyrole: b.bookedbyrole });
      });
      setBookedSlots(grouped);
    } else setBookedSlots({});
  });

  fetchWithLoading(`/api/off-therapists?date=${encodeURIComponent(date)}`, data => {
    setOffTherapists(data?.success ? data.offTherapists || [] : []);
    setDisabledSlots(data?.success ? data.disabledSlotsByTherapist || {} : {});
  });
}, [date]);

  // 🌟 Logic คำนวณสรุปข้อมูลแพทย์ทั่วไป (เหมือนหน้า booking)
  useEffect(() => {
    if (!date || therapists.length === 0 || timeSlots.length === 0) return;

    let totalCap = 0;
    let totalBooked = 0;
    let totalDisabled = 0;
    let totalAvailable = 0;

    const generalTherapists = therapists.filter(t => t.therapist_type !== 1);

    generalTherapists.forEach(t => {
      if (offTherapists.includes(t.name)) return;

      const disabledByT = disabledSlots[t.name] || [];
      const bookedByT = bookedSlots[t.name] || [];

      totalCap += timeSlots.length;

      timeSlots.forEach(slot => {
        const isSlotDisabled = disabledByT.includes(slot);
        const isSlotBooked = bookedByT.some(b => b.time_slot === slot);

        if (isSlotDisabled) {
          totalDisabled += 1;
        } else if (isSlotBooked) {
          totalBooked += 1;
        } else {
          totalAvailable += 1;
        }
      });
    });

    setGeneralStats({
      totalCapacity: totalCap,
      booked: totalBooked,
      available: totalAvailable,
      disabled: totalDisabled
    });
  }, [date, therapists, timeSlots, bookedSlots, disabledSlots, offTherapists]);

  // 🌟 สรุปรายช่วงเวลา (เฉพาะแพทย์ทั่วไป) — ใช้กับการ์ดด้านล่าง
  const slotStats = useMemo(() => {
    const generalTherapists = therapists.filter(t => t.therapist_type !== 1);
    return timeSlots.map(slot => {
      let capacity = 0;
      let booked = 0;
      generalTherapists.forEach(t => {
        if (offTherapists.includes(t.name)) return;
        const disabled = disabledSlots[t.name] || [];
        if (disabled.includes(slot)) return;
        capacity += 1;
        if (bookedSlots[t.name]?.some(b => b.time_slot === slot)) booked += 1;
      });
      return { slot, capacity, booked, available: capacity - booked };
    });
  }, [timeSlots, therapists, bookedSlots, disabledSlots, offTherapists]);

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

  const handleSubmit = () => {
   if (isReadOnly) {
    alert("โหมดดูอย่างเดียว ไม่สามารถบันทึกการจองได้");
    return;
    }
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

  // บันทึก therapist.name ทั้งใน booking.therapist และ booking.provider
  router.push(`/confirm?${new URLSearchParams({
    hn: clientHN,
    name: clientName,
    phone: clientPhone,
    idCard: idCardNumber,
    date,
    therapist: selectedTherapist, // ← therapist.name
    provider: selectedTherapist,  // ← ใช้ค่าเดียวกัน
    time: selectedTime,
    bookedbyrole: user?.role || "user"
  }).toString()}`);
};


const handleOpenDialog = () => {
   if (isReadOnly) {
    alert("โหมดดูอย่างเดียว ไม่สามารถเปิดการจองได้");
    return;
  }
  if (isGuest) {
    alert("โหมดดูอย่างเดียว ไม่สามารถเปิดการจองได้");
    return;
  }
  if (!selectedTime || !date) {
    setShowAlert(true);
    return;
  }

  // reset dialog fields
  setClientHN("");
  setClientName("");
  setClientPhone("");
  setSearchResults([]);
  setIdCardNumber("");
  setNoHN(false);

  setDialogOpen(true); // ✅ เปิด popup
};

  const handleSearchHN = async () => {
    if (!clientHN.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search-users?hn=${encodeURIComponent(clientHN.trim())}`);
      const data = await res.json();
      setSearchResults(data.success ? data.users : []);
      if (!data.success) alert("ไม่พบผู้ใช้");
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
      setSearchResults(data.success ? data.users : []);
      if (!data.success) alert("ไม่พบข้อมูลผู้ใช้");
    } catch {
      alert("เกิดข้อผิดพลาดในการค้นหา");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPatient = async () => {
    if (isReadOnly) {
    alert("โหมดดูอย่างเดียว ไม่สามารถเพิ่มคนไข้ได้");
    return;
    }
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

      if (data.success) {
        alert(data.message || "เพิ่มคนไข้เรียบร้อยแล้ว");
        setAddPatientDialog(false);
        setHn("");
        setPatientPrefix("");
        setPatientFirstName("");
        setPatientLastName("");
        setPatientPhone("");
      } else {
        alert(data.message || "ไม่สามารถเพิ่มคนไข้ได้");
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

  const toggleOffTherapist = async (therapist: string) => {
    if (isReadOnly) {
    alert("โหมดดูอย่างเดียว ไม่สามารถอัปเดตหมอไม่มาได้");
    return;
    }
    if (isGuest) {
      alert("โหมดดูอย่างเดียว ไม่สามารถอัปเดตหมอไม่มาได้");
      return;
    }
    if (!date) return alert("กรุณาเลือกวันที่ก่อน");
    try {
      const res = await fetch("/api/toggle-off-therapist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapist, date }),
      });
      const data = await res.json();
      if (data.success) {
        setOffTherapists(prev => prev.includes(therapist) ? prev.filter(t => t !== therapist) : [...prev, therapist]);
      } else alert("ไม่สามารถอัปเดตหมอไม่มาได้");
    } catch { alert("เกิดข้อผิดพลาดในการอัปเดตหมอไม่มา"); }
  };

  const toggleSlot = async (therapist: string, slot: string) => {
    if (isReadOnly) {
    alert("โหมดดูอย่างเดียว ไม่สามารถอัปเดตช่องเวลาได้");
    return;
    }
    if (isGuest) {
      alert("โหมดดูอย่างเดียว ไม่สามารถอัปเดต slot ได้");
      return;
    }
    if (!date) return alert("กรุณาเลือกวันที่ก่อน");
    try {
      const res = await fetch("/api/toggle-off-therapist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapist, date, slot }),
      });
      const data = await res.json();
      if (data.success) {
        setDisabledSlots(prev => {
          const current = prev[therapist] || [];
          const updated = current.includes(slot) ? current.filter(s => s !== slot) : [...current, slot];
          return { ...prev, [therapist]: updated };
        });
      } else alert("ไม่สามารถอัปเดต slot ได้");
    } catch { alert("เกิดข้อผิดพลาดในการอัปเดต slot"); }
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


const filteredTherapists = therapists;

  // 🎨 ค่าคงที่สำหรับ UI (class ที่ใช้ซ้ำ)
  const inputBase =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-100";
  const labelBase = "mb-1.5 block text-sm font-semibold text-slate-700";

  const legendItems: { color: string; label: string; staffOnly?: boolean }[] = [
    { color: "bg-emerald-500", label: "ว่าง" },
    { color: "bg-rose-400", label: "จองแล้ว / ไม่ว่าง" },
    { color: "bg-violet-400", label: "จองโดยแอดมิน", staffOnly: true },
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
      {/* ✅ แถบเมนูบนสุด + แผงเมนู hamburger ถูกลบออก เพราะ app/layout.tsx render
          <HamburgerMenu /> ให้ทุกหน้าอยู่แล้ว (ดูคอมเมนต์ที่ import ด้านบนของไฟล์)
          ปุ่ม "HN ?" ซึ่งเป็นฟีเจอร์เฉพาะหน้านี้ (เฉพาะแอดมิน) ถูกย้ายไปไว้ในพื้นที่เนื้อหา
          ด้านล่างแทน โดย state/handler/Dialog ทั้งหมดยังเหมือนเดิมทุกประการ ไม่มีการแก้ไข logic */}
      <div className="relative z-10 mx-auto max-w-[1400px] px-4 pb-16 pt-24 sm:px-6">
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
                  // รีเซ็ตค่าเมื่อ dialog ปิด
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
                  <Dialog.Title className="mb-1 text-xl font-bold text-emerald-800">เพิ่มข้อมูลคนไข้</Dialog.Title>
                  <p className="mb-5 text-sm text-slate-500">เพิ่มเสร็จแล้วให้จองใหม่อีกครั้ง</p>

                  {/* HN */}
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

                  {/* ชื่อ */}
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

                  {/* เบอร์โทร */}
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

                  {/* ปุ่มยืนยัน/ยกเลิก */}
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

        {/* ===== Header ===== */}
        <header className="mb-8 text-center">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            <CalendarIcon className="h-3.5 w-3.5" />
            โหมดดูข้อมูลเท่านั้น
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-emerald-900 sm:text-4xl">
            ตรวจสอบคิวว่าง
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-700 sm:text-base">
            หน้าดูข้อมูลเท่านั้น — เลือกวันที่เพื่อดูช่วงเวลาว่างของพนักงานนวดแต่ละท่าน
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
            min={new Date().toISOString().split("T")[0]}
            onChange={e => {
              const val = e.target.value;
              setDate(val);
              if (val) {
                localStorage.setItem("selectedDate", val);
              } else {
                localStorage.removeItem("selectedDate"); // ลบเมื่อกด clear
              }
            }}
            className={`w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-100 ${!date ? "text-slate-400" : "text-slate-900"}`}
          />
          <p className="mt-2 min-h-[1.25rem] text-center text-sm font-medium text-emerald-700">
            {date ? formatThaiDateLabel(date) : "ยังไม่ได้เลือกวันที่"}
          </p>
        </section>

        {/* ===== Legend ===== */}
        <div className="mx-auto mb-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-xs font-medium text-slate-700 shadow-sm sm:text-sm">
          {legendItems.map(item => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
              {item.label}
            </span>
          ))}
        </div>

        {/* ===== Therapist & slots rendering (แนวขวาง: 1 แถว = 1 ผู้ให้บริการ, ช่วงเวลาแบ่งคอลัมน์) ===== */}
        <div className="flex flex-col gap-4">
          {filteredTherapists.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-400 bg-white/70 p-10 text-center text-slate-500">
              <UserIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              ไม่พบรายชื่อผู้ให้บริการ
            </div>
          )}
          {filteredTherapists.map((t, idx) => {
            const isSelected = selectedTherapist === t.name;
            const isOff = offTherapists.includes(t.name);
            const disabled = disabledSlots[t.name] || [];

            // ✅ เพิ่มบรรทัดนี้
            const isAdminLike = !isGuest && (user.role_id === 909 || user.role_id === t.id);

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
                          : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                      }`}
                    >
                      <UserIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        className={`text-base font-bold leading-snug sm:text-lg ${
                          isOff ? "text-slate-500" : "text-emerald-900"
                        }`}
                      >
                        {idx + 1}. {t.shortname}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
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
                    {/* ✅ ใช้ isAdminLike แทน !isGuest */}
                    {date && isAdminLike && (
                      <button
                        disabled={isReadOnly}
                        onClick={() => toggleOffTherapist(t.name)}
                        className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold shadow-sm transition ${
                          isReadOnly ? "cursor-not-allowed bg-slate-300 text-slate-500" : "cursor-pointer bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95"
                        }`}
                      >
                        {isOff ? "ไม่มา" : "มา"}{isOff ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    )}
                    {/* ✅ ใช้ isAdminLike */}
                    {isAdminLike && (
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

                    let bookedBg = "bg-rose-50 text-rose-600 border-rose-200";
                    if (isAdminLike && slotInfo?.bookedbyrole === "admin") {
                      bookedBg = "bg-violet-50 text-violet-700 border-violet-200";
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
                                : "cursor-pointer border-slate-200 bg-white text-emerald-800 shadow-sm hover:border-emerald-300 hover:bg-emerald-50"
                            }`}
                        >
                          <div className="flex items-center gap-1 text-[13px] font-bold sm:text-sm">
                            <Clock className="h-3.5 w-3.5 flex-shrink-0" /> {slot}
                          </div>
                          {isBooked ? (
                            <div className="w-full min-w-0 truncate px-1 text-center text-xs">
                              {!isGuest ? `(${slotInfo?.name || "ไม่ระบุ"})` : "ไม่ว่าง"}
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

                        {/* ✅ ใช้ isAdminLike แทน !isGuest */}
                        {date && isAdminLike && (
                          <button
                            onClick={() => toggleSlot(t.name, slot)}
                            className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold text-white shadow-sm transition active:scale-95 ${
                              isOff
                                ? "cursor-not-allowed bg-slate-400"
                                : isSlotDisabled
                                ? "bg-rose-500 hover:bg-rose-600"
                                : "bg-emerald-500 hover:bg-emerald-600"
                            }`}
                          >
                            {isSlotDisabled ? <FaTimes /> : <FaCheck />}
                            <span>{isSlotDisabled ? "ปิดอยู่" : "เปิดอยู่"}</span>
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

        {/* Dialog */}
        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
              <Dialog.Title className="mb-4 flex items-center justify-between gap-3 text-xl font-bold text-emerald-800">
                <span>กรอกข้อมูลผู้มารับบริการ</span>
                <button
                  type="button"
                  onClick={() => {
                    setNoHN(prev => !prev);       // สลับโหมด HN / บัตรประชาชน
                    setClientHN("");               // รีเซ็ต HN
                    setClientName("");             // รีเซ็ตชื่อ
                    setClientPhone("");            // รีเซ็ตเบอร์
                    setIdCardNumber("");           // รีเซ็ตหมายเลขบัตร
                    setSearchResults([]);          // ล้างผลการค้นหา
                  }}
                  className="cursor-pointer whitespace-nowrap rounded-full bg-emerald-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                >
                  {noHN ? "กลับ" : "คนไข้ใหม่"}
                </button>
              </Dialog.Title>
              {["hn", "name", "phone"].map((field) => {
                if (field === "hn" && noHN) return null; // ซ่อน HN ถ้าเลือก "ไม่มี HN"

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

              {/* ฟิลด์หมายเลขบัตรประชาชน */}
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
                      <span className="text-left font-semibold">{u.name}</span>
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

        {/* Alert popup */}
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
