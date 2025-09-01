"use client";

import { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "@/context/AuthContext";
import { CalendarIcon, UserIcon, Clock, Home, AlertCircle, UserCheck, UserX } from "lucide-react";
import { FaHistory } from "react-icons/fa";
import * as Dialog from "@radix-ui/react-dialog";

interface UserInfo {
  hn: string;
  name: string;
  phone: string;
}

export default function AdminBookingPage() {
  const router = useRouter();
  const { user } = useContext(AuthContext);

  const [therapists, setTherapists] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [selectedTherapist, setSelectedTherapist] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({});
  const [showAlert, setShowAlert] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [clientHN, setClientHN] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [searchResults, setSearchResults] = useState<UserInfo[]>([]);

  // **เพิ่ม state หมอไม่มา**
  const [offTherapists, setOffTherapists] = useState<string[]>([]);

  // ตรวจสอบ login
  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  // ดึง therapist + time_slot
  useEffect(() => {
    fetch("/api/therapists").then(res => res.json()).then(data => data.success && setTherapists(data.therapists)).catch(() => setTherapists([]));
    fetch("/api/time-slots").then(res => res.json()).then(data => data.success && setTimeSlots(data.timeSlots)).catch(() => setTimeSlots([]));
  }, []);

  // ดึงเวลาที่ถูกจองของแต่ละ therapist
  useEffect(() => {
    if (!date) return setBookedSlots({});
    fetch(`/api/bookings?date=${encodeURIComponent(date)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const grouped: Record<string, string[]> = {};
          data.bookings.forEach((b: any) => {
            if (!grouped[b.therapist]) grouped[b.therapist] = [];
            grouped[b.therapist].push(b.time_slot);
          });
          setBookedSlots(grouped);
        } else setBookedSlots({});
      })
      .catch(() => setBookedSlots({}));
    setSelectedTherapist("");
    setSelectedTime("");

    // **ดึงหมอไม่มาของวันที่เลือก**
    if (!date) return setOffTherapists([]);
    fetch(`/api/off-therapists?date=${encodeURIComponent(date)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setOffTherapists(data.offTherapists || []);
        else setOffTherapists([]);
      })
      .catch(() => setOffTherapists([]));
  }, [date]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    return digits.length <= 3 ? digits : `${digits.slice(0, 3)}-${digits.slice(3)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => setClientPhone(formatPhone(e.target.value));

  const isTimeSlotPast = (slot: string) => {
    if (!date) return false;
    const [hourStr, minStr = "00"] = slot.split("-")[0].split(".");
    const slotStart = new Date(date);
    slotStart.setHours(parseInt(hourStr), parseInt(minStr), 0, 0);
    return new Date() > slotStart;
  };

  const handleSelect = (therapist: string, time: string) => {
    if (!date) return setShowAlert(true);
    setSelectedTherapist(therapist);
    setSelectedTime(time);
  };

  const handleSubmit = () => {
    if (!clientHN || !clientName || !clientPhone || !date || !selectedTherapist || !selectedTime) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    router.push(`/confirm?${new URLSearchParams({
      hn: clientHN,
      name: clientName,
      phone: clientPhone,
      date,
      therapist: selectedTherapist,
      time: selectedTime,
    }).toString()}`);
  };

  const handleOpenDialog = () => {
    setClientHN("");
    setClientName("");
    setClientPhone("");
    setSearchResults([]);
    setDialogOpen(true);
  };

  const handleAutoFill = async (field: "hn" | "name" | "phone") => {
    let query = "";
    if (field === "hn" && clientHN.trim().length !== 9) return alert("กรุณากรอก HN ให้ครบ 9 หลัก");
    if (field === "name" && !clientName.trim()) return;
    if (field === "phone" && !clientPhone.trim()) return alert("กรุณากรอกเบอร์โทร");

    query = encodeURIComponent(field === "hn" ? clientHN : field === "name" ? clientName : clientPhone);
    try {
      const res = await fetch(`/api/user-info?${field}=${query}`);
      const data = await res.json();
      if (data.success) {
        setClientHN(data.hn);
        setClientName(data.name);
        setClientPhone(formatPhone(data.phone || ""));
      } else {
        if (field === "phone") alert("ไม่พบข้อมูลผู้ใช้ตรงกับเบอร์โทรที่กรอก");
        else if (field === "hn") alert("ไม่พบข้อมูลผู้ใช้ตรงกับ HN ที่กรอก");
        else alert("ไม่พบข้อมูลผู้ใช้ตรงกับชื่อที่กรอก");
      }
    } catch { alert("เกิดข้อผิดพลาดในการดึงข้อมูล"); }
  };

  const handleSearchName = async () => {
    if (!clientName.trim()) return;
    try {
      const res = await fetch(`/api/search-users?name=${encodeURIComponent(clientName.trim())}`);
      const data = await res.json();
      setSearchResults(data.success ? data.users : []);
      if (!data.success) alert("ไม่พบข้อมูลผู้ใช้");
    } catch { alert("เกิดข้อผิดพลาดในการค้นหา"); }
  };

  const handleSelectUser = (user: UserInfo) => {
    setClientName(user.name);
    setClientHN(user.hn);
    setClientPhone(formatPhone(user.phone || ""));
    setSearchResults([]);
  };

  // **ฟังก์ชัน toggle หมอไม่มา**
  const toggleOffTherapist = async (therapist: string) => {
    if (!date) return alert("กรุณาเลือกวันที่ก่อน");
    try {
      const res = await fetch("/api/toggle-off-therapist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapist, date }),
      });
      const data = await res.json();
      if (data.success) {
        if (offTherapists.includes(therapist)) {
          setOffTherapists(prev => prev.filter(t => t !== therapist));
        } else {
          setOffTherapists(prev => [...prev, therapist]);
        }
      } else alert("ไม่สามารถอัปเดตหมอไม่มาได้");
    } catch {
      alert("เกิดข้อผิดพลาดในการอัปเดตหมอไม่มา");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-emerald-100 relative overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.15 }} transition={{ duration: 2 }} className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_#a7f3d0,_transparent_70%)]" />

      {/* Navigation */}
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => router.push("/")} className="absolute top-6 left-6 flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700 z-10">
        <Home className="w-5 h-5" /> หน้าแรก
      </motion.button>
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => router.push("/all-bookings")} className="absolute top-6 right-6 flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700 z-10">
        <FaHistory className="w-5 h-5" /> ประวัติการจองทั้งหมด
      </motion.button>

      <div className="max-w-6xl mx-auto p-6 pt-20 relative z-10">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl font-bold text-center mb-6 text-emerald-700">
          จองคิวนวดแผนไทย (Admin)
        </motion.h1>

        {/* เลือกวันที่ */}
        <div className="mb-8 max-w-sm mx-auto">
          <label className="block mb-2 font-medium text-gray-700 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" /> วันที่ต้องการนวด
          </label>
          <input type="date" value={date} min={new Date().toISOString().split("T")[0]} onChange={e => setDate(e.target.value)} className={`border border-gray-300 rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-emerald-400 transition ${!date ? "text-gray-400" : "text-gray-900"}`} />
        </div>

        {/* เลือกหมอ + เวลา */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {therapists.map(t => {
            const booked = bookedSlots[t] || [];
            const isSelected = selectedTherapist === t;
            const isOff = offTherapists.includes(t);
            return (
                <motion.div key={t} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`border p-5 rounded-2xl shadow-lg ${isOff ? "bg-gray-200" : "bg-white"} ${isSelected ? "ring-4 ring-emerald-300" : ""}`}>
                <div className="flex items-center gap-2 mb-3">
                  <UserIcon className={`w-5 h-5 ${isOff ? "text-gray-500" : "text-emerald-600"}`} />
                  <h2 className={`text-lg font-semibold ${isOff ? "text-gray-500" : "text-emerald-700"}`}>{t}</h2>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-base text-emerald-800 font-semibold">วันนี้หมอ :</span>
                    {date && (
                      <button
                        onClick={() => toggleOffTherapist(t)}
                        className={`px-3 py-1.5 text-sm rounded flex items-center gap-2 font-semibold text-white hover:brightness-90
                          ${isOff ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}
                      >
                        {isOff ? "ไม่มา" : "มา"}
                        {isOff ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {timeSlots.map(slot => {
                    const isBooked = booked.includes(slot);
                    const isPast = isTimeSlotPast(slot);
                    const isActive = isSelected && selectedTime === slot;
                    return (
                      <button key={slot} disabled={isBooked || isPast || isOff} onClick={() => handleSelect(t, slot)} className={`text-sm px-3 py-2 rounded-lg font-medium border flex items-center justify-center gap-1 transition shadow-sm
                        ${isOff ? "bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed" 
                        : isBooked ? "bg-red-100 text-red-600 border-red-400 cursor-not-allowed" 
                        : isPast ? "bg-yellow-100 text-yellow-700 border-yellow-400 cursor-not-allowed" 
                        : isActive ? "bg-emerald-600 text-white border-emerald-600" 
                        : "bg-white hover:bg-emerald-50 text-emerald-800 border-gray-300"}`}>
                        <Clock className="w-4 h-4" /> {slot} {(isBooked || isPast) && <span className="text-xs font-semibold">({isBooked ? "ถูกจองแล้ว" : "หมดเวลาจอง"})</span>}
                      </button>
                    );
                  })}
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleOpenDialog} disabled={!(isSelected && selectedTime && date) || isOff} className={`mt-5 w-full py-2 rounded-xl font-bold shadow transition text-center ${isSelected && selectedTime && date && !isOff ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
                  เลือก
                </motion.button>
              </motion.div>
            );
          })}
        </div>
        {/* Dialog กรอกข้อมูลผู้ป่วย */}
        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
            <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg">
              <Dialog.Title className="text-xl font-bold mb-4 text-emerald-700">กรอกข้อมูลผู้รับบริการ</Dialog.Title>

              {["hn", "name", "phone"].map(field => (
                <label key={field} className="block mb-3 relative">
                  <span className="text-sm font-medium text-emerald-800">{field === "hn" ? "HN" : field === "name" ? "ชื่อผู้รับบริการ" : "เบอร์โทร"}</span>
                  <input
                    type="text"
                    value={field === "hn" ? clientHN : field === "name" ? clientName : clientPhone}
                    onChange={e => field === "hn" ? setClientHN(e.target.value) : field === "name" ? setClientName(e.target.value) : handlePhoneChange(e)}
                    maxLength={field === "hn" ? 9 : field === "phone" ? 11 : undefined}
                    placeholder={field === "hn" ? "กรอก HN" : field === "name" ? "กรอกชื่อ" : "กรอกเบอร์โทร"}
                    className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-gray-900"
                  />
                  <div className="absolute top-0 right-0 mt-1 mr-1 flex gap-1">
                    {field === "hn" && <button type="button" onClick={() => handleAutoFill("hn")} className="px-2 py-1 bg-emerald-600 text-white rounded-md text-xs hover:bg-emerald-700">Auto-fill</button>}
                    {field === "name" && <>
                      <button type="button" onClick={handleSearchName} className="px-2 py-1 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700">ค้นหา</button>
                      <button type="button" onClick={() => handleAutoFill("name")} className="px-2 py-1 bg-emerald-600 text-white rounded-md text-xs hover:bg-emerald-700">Auto-fill</button>
                    </>}
                    {field === "phone" && <button type="button" onClick={() => handleAutoFill("phone")} className="px-2 py-1 bg-emerald-600 text-white rounded-md text-xs hover:bg-emerald-700">Auto-fill</button>}
                  </div>
                </label>
              ))}

              {searchResults.length > 0 && (
                <ul className="border rounded mt-2 mb-3 max-h-48 overflow-auto bg-white shadow">
                  {searchResults.map((u, idx) => (
                    <li key={idx} className="p-2 hover:bg-gray-100 cursor-pointer text-sm text-black" onClick={() => handleSelectUser(u)}>
                      {u.name} {u.phone && `(${formatPhone(u.phone)})`}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex justify-end gap-3">
                <Dialog.Close asChild>
                  <button className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">ยกเลิก</button>
                </Dialog.Close>
                <button onClick={handleSubmit} className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700">ยืนยัน</button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* Alert */}
        <AnimatePresence>
          {showAlert && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-20 left-1/2 -translate-x-1/2 bg-yellow-50 border border-yellow-400 text-yellow-700 px-6 py-4 rounded-lg flex items-center gap-3 shadow-lg max-w-md z-50">
              <AlertCircle className="w-6 h-6" />
              <span>กรุณาเลือกวันที่ก่อนจองคิว</span>
              <button onClick={() => setShowAlert(false)} className="ml-auto text-yellow-700 font-bold hover:text-yellow-900">✕</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}