"use client";

import { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "@/context/AuthContext";
import { CalendarIcon, UserIcon, Clock, Home, AlertCircle, UserCheck, UserX } from "lucide-react";
import { FaHistory, FaCheck, FaTimes } from "react-icons/fa";
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
  const [disabledSlots, setDisabledSlots] = useState<Record<string, string[]>>({});
  const [showAlert, setShowAlert] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [clientHN, setClientHN] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [searchResults, setSearchResults] = useState<UserInfo[]>([]);

  const [dialogTherapist, setDialogTherapist] = useState("");
  const [offTherapists, setOffTherapists] = useState<string[]>([]);

  useEffect(() => {
    if (!showAlert) return;
    const timer = setTimeout(() => setShowAlert(false), 2000);
    return () => clearTimeout(timer);
  }, [showAlert]);

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    fetch("/api/therapists").then(res => res.json()).then(data => data.success && setTherapists(data.therapists)).catch(() => setTherapists([]));
    fetch("/api/time-slots").then(res => res.json()).then(data => data.success && setTimeSlots(data.timeSlots)).catch(() => setTimeSlots([]));
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

    fetch(`/api/off-therapists?date=${encodeURIComponent(date)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setOffTherapists(data.offTherapists || []);
          setDisabledSlots(data.disabledSlotsByTherapist || {});
        } else {
          setOffTherapists([]);
          setDisabledSlots({});
        }
      })
      .catch(() => { setOffTherapists([]); setDisabledSlots({}); });

    setSelectedTherapist("");
    setSelectedTime("");
  }, [date]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    return digits.length <= 3 ? digits : `${digits.slice(0, 3)}-${digits.slice(3)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => setClientPhone(formatPhone(e.target.value));

  const isTimeSlotPast = (slot: string) => {
    if (!date) return false;
    const [start] = slot.split("-"); // เวลาต้นของ slot
    let [hourStr, minStr = "00"] = start.split(":");
    if (hourStr.length === 1) hourStr = "0" + hourStr;
    if (minStr.length === 1) minStr = "0" + minStr;
    const slotStart = new Date(`${date}T${hourStr}:${minStr}:00`);
    return new Date() > slotStart;
  };

  const handleSelect = (therapist: string, time: string) => {
    if (!date) return setShowAlert(true);
    setSelectedTherapist(therapist);
    setSelectedTime(time);
  };

  const handleSubmit = () => {
    if (!clientHN || !clientName || !clientPhone || !date || !selectedTherapist || !selectedTime || !dialogTherapist) {
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
      provider: dialogTherapist || "",
    }).toString()}`);
  };

  const handleOpenDialog = () => {
    setClientHN("");
    setClientName("");
    setClientPhone("");
    setDialogTherapist("");
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
        if (offTherapists.includes(therapist)) setOffTherapists(prev => prev.filter(t => t !== therapist));
        else setOffTherapists(prev => [...prev, therapist]);
      } else alert("ไม่สามารถอัปเดตหมอไม่มาได้");
    } catch { alert("เกิดข้อผิดพลาดในการอัปเดตหมอไม่มา"); }
  };

  const toggleSlot = async (therapist: string, slot: string) => {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-emerald-100 relative overflow-hidden">
      <div className="max-w-[92rem] mx-auto relative">
        <div className="absolute top-12 left-1 right-1 flex justify-between px-6 z-50">
          <motion.button 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }} 
            onClick={() => router.push("/")} 
            className="flex items-center gap-2 px-5 py-2 rounded-lg shadow-md text-white bg-emerald-600 hover:bg-emerald-700"
          >
            <Home className="w-5 h-5"/><span>หน้าแรก</span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }} 
            onClick={() => router.push("/all-bookings")} 
            className="flex items-center gap-2 px-5 py-2 rounded-lg shadow-md text-white bg-emerald-600 hover:bg-emerald-700"
          >
            <FaHistory className="w-5 h-5"/><span>ประวัติการจองทั้งหมด</span>
          </motion.button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 pt-12 relative z-10">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl font-extrabold text-emerald-700 mb-12 text-center drop-shadow-sm">
          จองคิวนวดแผนไทย (Admin)
        </motion.h1>

        <div className="mb-8 max-w-sm mx-auto">
          <label className="flex items-center gap-2 text-emerald-700 font-semibold mb-2 text-lg">
            <CalendarIcon className="w-4 h-4" /> วันที่ต้องการนวด
          </label>
          <input type="date" value={date} min={new Date().toISOString().split("T")[0]} onChange={e => setDate(e.target.value)} className={`border border-gray-300 rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-emerald-400 transition ${!date ? "text-gray-400" : "text-gray-900"}`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {therapists.map(t => {
            const booked = bookedSlots[t] || [];
            const isSelected = selectedTherapist === t;
            const isOff = offTherapists.includes(t);
            const disabled = disabledSlots[t] || [];

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
                          ${isOff ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
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
                    const isSlotDisabled = disabled.includes(slot);

                    return (
                      <div key={slot} className="flex gap-1 items-center">
                        <button
                          disabled={isBooked || isPast || isOff || isSlotDisabled}
                          onClick={() => handleSelect(t, slot)}
                          className={`text-sm px-3 py-2 rounded-lg font-medium border flex-1 flex items-center justify-center gap-1 transition shadow-sm
                            ${isSlotDisabled ? "bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed"
                            : isOff ? "bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed"
                            : isBooked ? "bg-red-100 text-red-600 border-red-400 cursor-not-allowed"
                            : isPast ? "bg-yellow-100 text-yellow-700 border-yellow-400 cursor-not-allowed"
                            : isActive ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white hover:bg-emerald-50 text-emerald-800 border-gray-300"}`}>
                          <Clock className="w-4 h-4" /> {slot} {(isBooked || isPast) && <span className="text-xs font-semibold">({isBooked ? "ถูกจองแล้ว" : "หมดเวลาจอง"})</span>}
                        </button>
                        {date && (
                          <button
                            disabled={isOff}
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

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleOpenDialog} disabled={!(isSelected && selectedTime && date) || isOff} className={`mt-5 w-full py-2 rounded-xl font-bold shadow transition text-center ${isSelected && selectedTime && date && !isOff ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
                  เลือก
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
            <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg">
              <Dialog.Title className="text-xl font-bold mb-4 text-emerald-700">กรอกข้อมูลผู้รับบริการ</Dialog.Title>

              <label className="block mb-3">
                <span className="text-sm font-medium text-emerald-800">ผู้รับผิดชอบ</span>
                <select value={dialogTherapist} onChange={(e) => setDialogTherapist(e.target.value)} className={`mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${dialogTherapist === "" ? "text-gray-400" : "text-gray-900"}`}>
                  <option value="" disabled className="text-gray-400">-- เลือก --</option>
                  {therapists.map((t) => <option key={t} value={t} className="text-black">{t}</option>)}
                </select>
              </label>

              {["hn", "name", "phone"].map(field => (
                <label key={field} className="block mb-3 relative">
                  <span className="text-sm font-medium text-emerald-800">{field === "hn" ? "HN" : field === "name" ? "ชื่อผู้รับบริการ" : "เบอร์โทร"}</span>
                  <input type="text" value={field === "hn" ? clientHN : field === "name" ? clientName : clientPhone} onChange={e => field === "hn" ? setClientHN(e.target.value) : field === "name" ? setClientName(e.target.value) : handlePhoneChange(e)} maxLength={field === "hn" ? 9 : field === "phone" ? 11 : undefined} placeholder={field === "hn" ? "กรอก HN" : field === "name" ? "กรอกชื่อ" : "กรอกเบอร์โทร"} className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-gray-900" />
                  <div className="absolute top-0 right-0 mt-1 mr-1 flex gap-1">
                    {field === "hn" && <button type="button" onClick={() => handleAutoFill("hn")} className="px-2 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 text-xs">auto-fill</button>}
                    {field === "name" && (
                      <>
                        <button type="button" onClick={handleSearchName} className="px-2 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 text-xs">ค้นหา</button>
                        <button type="button" onClick={() => handleAutoFill("name")} className="px-2 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 text-xs">auto-fill</button>
                      </>
                    )}
                    {field === "phone" && <button type="button" onClick={() => handleAutoFill("phone")} className="px-2 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 text-xs">auto-fill</button>}
                  </div>
                </label>
              ))}

              {searchResults.length > 0 && (
                <div className="border p-2 rounded max-h-40 overflow-y-auto mb-3">
                  {searchResults.map(u => (
                    <button key={u.hn || u.name} onClick={() => handleSelectUser(u)} className="w-full flex justify-between items-center px-2 py-1 hover:bg-emerald-100 rounded text-gray-900">
                    <span className="font-medium text-left">{u.name}</span><span className="text-sm text-gray-500 text-right">{u.phone || "ไม่มีเบอร์"}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800">ยกเลิก</button>
                </Dialog.Close>
                <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">ยืนยัน</button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <AnimatePresence>
          {showAlert && (
            <motion.div
              key={Date.now()}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow z-50 flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5" />
              <span>กรุณาเลือกวันที่ก่อน</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}