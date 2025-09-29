"use client";

import { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { AuthContext } from "@/context/AuthContext";
import { CalendarIcon, UserIcon, Clock, AlertCircle, UserCheck, UserX, Search } from "lucide-react";
import { ImSpinner2 } from "react-icons/im";
import { FaHistory, FaCheck, FaSpa, FaTimes } from "react-icons/fa";
import * as Dialog from "@radix-ui/react-dialog";

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

export default function BookingPage() {
  const router = useRouter();
  const { user } = useContext(AuthContext);

  const isGuest = !user;

  const [idCardNumber, setIdCardNumber] = useState("");
  const [therapists, setTherapists] = useState<string[]>([]);
  const [medStaff, setMedStaff] = useState<string[]>([]);
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
  const [dialogTherapist, setDialogTherapist] = useState("");
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

  // ❌ ตัด redirect ออก
  // useEffect(() => {
  //   if (!user) router.push("/login");
  // }, [user, router]);

  useEffect(() => {
    const savedDate = localStorage.getItem("selectedDate");
    if (savedDate) {
      const today = new Date();
      const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const [year, month, day] = savedDate.split("-").map(Number);
      const selected = new Date(year, month - 1, day);

      if (selected.getTime() < todayLocal.getTime()) {
        localStorage.removeItem("selectedDate");
        setDate("");
      } else {
        setDate(savedDate);
      }
    }
  }, []);

  useEffect(() => {
    fetch("/api/med-staff")
      .then(res => res.json())
      .then(data => data.success && setMedStaff(data.staff.map((s: any) => s.name)))
      .catch(() => setMedStaff([]));
  }, []);

  useEffect(() => {
    fetch("/api/therapists")
      .then(res => res.json())
      .then(data => data.success && setTherapists(data.therapists))
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

  fetchWithLoading(`/api/bookings?date=${encodeURIComponent(date)}`, data => {
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
  if (!clientName || !clientPhone || !date || !selectedTherapist || !selectedTime || !dialogTherapist) {
    alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    return;
  }
  if (noHN) {
    // ไม่มี HN → ใช้บัตรประชาชนแทน
  } else {
    if (!clientHN || clientHN.length !== 9) {
      alert("กรุณากรอก HN ให้ครบ 9 ตัว");
      return;
    }
  }

  router.push(`/confirm?${new URLSearchParams({
    hn: clientHN,
    name: clientName,
    phone: clientPhone,
    idCard: idCardNumber,
    date,
    therapist: selectedTherapist,
    time: selectedTime,
    provider: dialogTherapist,
    bookedbyrole: user?.role || "user" // เพิ่มตรงนี้
  }).toString()}`);
};

  const handleOpenDialog = () => {
    if (isGuest) {
      alert("โหมดดูอย่างเดียว ไม่สามารถเปิดการจองได้");
      return;
    }
    if (!selectedTherapist || !selectedTime || !date) return setShowAlert(true);
    setClientHN(""); setClientName(""); setClientPhone(""); setDialogTherapist(""); setSearchResults([]); setIdCardNumber(""); setNoHN(false);
    setDialogOpen(true);
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
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-emerald-100 relative overflow-hidden">
      {loading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[1000]">
          <ImSpinner2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}
      <div className="fixed top-0 left-0 w-full z-50 bg-gradient-to-r from-emerald-600 to-green-500 shadow-md flex justify-between items-center px-4 py-2">
        <div
          className="text-white font-bold text-lg flex items-center gap-2 cursor-pointer"
          onClick={() => router.push("/")}
          title="หน้าหลัก"
        >
          <FaSpa /> แพทย์แผนไทย
        </div>
        <div className="flex gap-2 sm:gap-2 flex-wrap sm:flex-nowrap">
          {user?.role === "admin" && (
            <>
              <button
                onClick={() => setAddPatientDialog(true)}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1 sm:py-2 rounded-lg bg-white text-emerald-700 font-semibold shadow text-sm sm:text-base transition hover:bg-gray-300"
                title="คนไข้มี HN แต่หาไม่เจอ"
              >
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
                  <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
                  <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg">
                    <Dialog.Title className="text-xl font-bold mb-4 text-emerald-700">เพิ่มข้อมูลคนไข้ (เพิ่มเสร็จแล้วให้จองใหม่)</Dialog.Title>

                    {/* HN */}
                    <label className="block mb-3">
                      <span className="text-sm font-medium text-emerald-800">HN</span>
                      <input
                        type="text"
                        value={hn}
                        onChange={e => setHn(e.target.value.replace(/\D/g, "").slice(0, 9))}
                        placeholder="กรอก HN"
                        maxLength={9}
                        className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-gray-900"
                      />
                    </label>

                    {/* ชื่อ */}
                    <div className="flex gap-2 mb-3">
                      <label className="flex flex-col w-20">
                        <span className="text-sm font-medium text-emerald-800">คำนำหน้า</span>
                        <input
                          type="text"
                          value={patientPrefix}
                          onChange={e => setPatientPrefix(e.target.value)}
                          placeholder="คำย่อ"
                          className="mt-1 w-full border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-gray-900"
                        />
                      </label>
                      <label className="flex-1 flex flex-col">
                        <span className="text-sm font-medium text-emerald-800">ชื่อจริง</span>
                        <input
                          type="text"
                          value={patientFirstName}
                          onChange={e => setPatientFirstName(e.target.value)}
                          placeholder="ชื่อ"
                          className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-gray-900"
                        />
                      </label>
                      <label className="flex-1 flex flex-col">
                        <span className="text-sm font-medium text-emerald-800">นามสกุล</span>
                        <input
                          type="text"
                          value={patientLastName}
                          onChange={e => setPatientLastName(e.target.value)}
                          placeholder="นามสกุล"
                          className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-gray-900"
                        />
                      </label>
                    </div>

                    {/* เบอร์โทร */}
                    <label className="block mb-3">
                      <span className="text-sm font-medium text-emerald-800">เบอร์โทร</span>
                      <input
                        type="text"
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
                        className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-gray-900"
                      />
                    </label>

                    {/* ปุ่มยืนยัน/ยกเลิก */}
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        onClick={handleAddPatient}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        ยืนยัน
                      </button>
                      <Dialog.Close asChild>
                        <button className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800">
                          ยกเลิก
                        </button>
                      </Dialog.Close>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </>
          )}
          {!isGuest && (
            <button
              onClick={() => router.push("/all-bookings")}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1 sm:py-2 rounded-lg bg-white text-emerald-700 font-semibold shadow text-sm sm:text-base transition hover:bg-gray-300"
              title="สรุปประวัติ"
            >
              <FaHistory className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 pt-27 relative z-10">
        <h1
          className="text-3xl sm:text-4xl font-extrabold text-emerald-700 mb-12 sm:mb-12 text-center drop-shadow-sm"
        >
          {isGuest ? "ดูคิวจองนวดแผนไทย" : "เลือกหมอนวดและช่วงเวลา"}
        </h1>

        <div className="mb-8 max-w-sm mx-auto">
          <label className="flex items-center gap-2 text-emerald-700 font-semibold mb-2 text-lg">
            <CalendarIcon className="w-4 h-4" /> {isGuest ? "เลือกวันที่ต้องการดู" : "เลือกวันที่ต้องการนวด"}
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
            className={`border border-gray-300 rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-emerald-400 transition ${!date ? "text-gray-400" : "text-gray-900"}`}
          />
        </div>

        {/* Therapist & slots rendering */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {therapists.map(t => {
            const isSelected = selectedTherapist === t;
            const isOff = offTherapists.includes(t);
            const disabled = disabledSlots[t] || [];

            return (
              <div key={t} className={`border p-5 rounded-2xl shadow-lg ${isOff ? "bg-gray-200" : "bg-white"} ${isSelected ? "ring-4 ring-emerald-300" : ""}`}>
                <div className="flex items-center gap-2 mb-3">
                  <UserIcon className={`w-5 h-5 ${isOff ? "text-gray-500" : "text-emerald-600"}`} />
                  <h2 className={`text-lg font-semibold ${isOff ? "text-gray-500" : "text-emerald-700"}`}>{t}</h2>
                  <div className="ml-auto flex items-center gap-2">
                    {date && !isGuest && (
                    <button
                      onClick={() => toggleOffTherapist(t)}
                      className={`px-3 py-1.5 text-sm rounded flex items-center gap-2 font-semibold text-white hover:brightness-90 ${
                        isOff
                          ? "bg-red-500 hover:bg-red-600"
                          : "bg-emerald-500 hover:bg-emerald-600"
                      }`}
                    >
                      {isOff ? "ไม่มา" : "มา"}{isOff ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                {timeSlots.map(slot => {
                  const slotInfo = bookedSlots[t]?.find(b => b.time_slot === slot);
                  const isBooked = !!slotInfo;
                  const isActive = isSelected && selectedTime === slot;
                  const isSlotDisabled = disabled.includes(slot);

                  // กำหนดสีตาม bookedbyrole
                  let bookedBg = "bg-red-100 text-red-600 border-red-400"; // default user

                  if (!isGuest && slotInfo?.bookedbyrole === "admin") {
                    bookedBg = "bg-purple-100 text-purple-700 border-purple-400";
                  }
                  return (
                    <div key={slot} className="flex gap-1 items-center">
                      <button
                        disabled={isBooked || isOff || isSlotDisabled || isGuest}
                        onClick={() => handleSelect(t, slot)}
                        className={`text-sm px-3 py-2 rounded-lg font-medium border flex-1 flex flex-col items-center justify-center gap-1 transition shadow-sm
                          ${
                            isSlotDisabled || isOff
                              ? "bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed"
                              : isBooked
                              ? bookedBg
                              : isActive
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white hover:bg-gray-200 text-emerald-800 border-gray-400"
                          }`}
                      >
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" /> {slot}
                        </div>
                        {isBooked && (
                          <div className="text-xs">
                            ({slotInfo?.name || "ไม่ระบุ"})
                          </div>
                        )}
                      </button>

                      {/* ปุ่ม admin toggle slot */}
                      {date && !isGuest && (
                        <button
                          onClick={() => toggleSlot(t, slot)}
                          className={`px-2 py-1 rounded text-white ${
                            isOff
                              ? "bg-gray-400 cursor-not-allowed"
                              : isSlotDisabled
                              ? "bg-red-500 hover:bg-red-600"
                              : "bg-emerald-500 hover:bg-emerald-600"
                          }`}
                        >
                          {isSlotDisabled ? <FaTimes /> : <FaCheck />}
                        </button>
                      )}
                    </div>
                  );
                })}
                </div>
                {!isGuest && (
                  <button
                    onClick={handleOpenDialog}
                    disabled={!(isSelected && selectedTime && date) || isOff}
                    className={`mt-5 w-full py-2 rounded-xl font-bold shadow transition text-center ${
                      isSelected && selectedTime && date && !isOff
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    เลือก
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Dialog */}
        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
            <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg">
              <Dialog.Title className="text-xl font-bold mb-4 text-emerald-700 flex justify-between items-center">
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
                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 rounded text-white text-sm"
                >
                  {noHN ? "กลับ" : "คนไข้ใหม่"}
                </button>
              </Dialog.Title>

              <label className="block mb-3">
                <span className="text-sm font-medium text-emerald-800">ผู้ให้บริการ</span>
                <select
                  value={dialogTherapist}
                  onChange={e => setDialogTherapist(e.target.value)}
                  className={`mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${dialogTherapist === "" ? "text-gray-400" : "text-gray-900"}`}
                >
                  <option value="" disabled>-- เลือก --</option>
                  {medStaff.map(name => (
                    <option key={name} value={name} className="text-gray-900">{name}</option>
                  ))}
                </select>
              </label>

              {["hn", "name", "phone"].map((field) => {
                if (field === "hn" && noHN) return null; // ซ่อน HN ถ้าเลือก "ไม่มี HN"

                return (
                  <label key={field} className="block mb-3">
                    <span className="text-sm font-medium text-emerald-800">
                      {field === "hn" ? "HN" : field === "name" ? "ผู้มารับบริการ" : "เบอร์โทร"}
                    </span>
                    <div className="flex border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-emerald-400 transition">
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
                        className="flex-1 px-3 py-2 rounded-l-md focus:outline-none text-gray-900"
                      />
                      {(field === "name" || field === "hn") && !noHN && (
                      <button
                        type="button"
                        onClick={() =>
                          field === "name" ? handleSearchName() : handleSearchHN()
                        }
                        disabled={loading}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-r-md hover:bg-emerald-600 flex items-center justify-center"
                      >
                        <Search className="w-5 h-5" />
                      </button>
                      )}
                    </div>
                  </label>
                );
              })}

              {/* ฟิลด์หมายเลขบัตรประชาชน */}
              {noHN && (
                <label className="block mb-3">
                  <span className="text-sm font-medium text-emerald-800">หมายเลขบัตรประชาชน</span>
                  <input
                    type="text"
                    value={idCardNumber}
                    onChange={e =>
                      setIdCardNumber(e.target.value.replace(/\D/g, "").slice(0, 13))
                    }
                    maxLength={13}
                    placeholder="กรอกหมายเลขบัตรประชาชน"
                    className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-gray-900"
                  />
                </label>
              )}

              {searchResults.length > 0 && (
                <div className="border p-2 rounded max-h-40 overflow-y-auto mb-3">
                  {searchResults.map(u => (
                    <button key={u.hn || u.name} onClick={() => handleSelectUser(u)} className="w-full flex justify-between items-center px-2 py-1 hover:bg-emerald-100 rounded text-gray-900">
                      <span className="font-medium text-left">{u.name}</span>
                      <span className="text-sm text-gray-500 text-right">{u.phone || "ไม่มีเบอร์"}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">ยืนยัน</button>
                <Dialog.Close asChild>
                  <button className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800">ยกเลิก</button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* Alert popup */}
        <AnimatePresence>
          {showAlert && (
            <div key={Date.now()} className="fixed top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow z-50 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>กรุณาเลือกวันที่ก่อน</span>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}