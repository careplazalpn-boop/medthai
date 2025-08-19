"use client";

import { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "@/context/AuthContext";
import { CalendarIcon, UserIcon, Clock, Home, AlertCircle } from "lucide-react";
import { FaHistory } from "react-icons/fa";
import * as Dialog from "@radix-ui/react-dialog";

const therapists = [
  "นายดุสิทธิ์  ไชยศรีหา",
  "นางสาววรรณนิสา เนตรษุ",
  "นางสาววรานันทน์ ยอดลิลา",
  "นางยุพิน พรมสนธิ",
  "นางวิไลวรรณ กิติกาศ",
  "นางสุมัชยา ชัยพนัส",
  "นางรัตนาภรณ์ รวยกร",
  "นางรุจิรา ถาน้อย",
  "นางสาวณิชาภา ณชนกกรณัฐ",
  "นางสาววัชรีพันธุ์  อุณเวทย์วานิช",
  "นางสาวกนกรดา สินสุวรรณ",
  "นางวราภรณ์ เทศสันเทียะ",
];

const timeSlots = ["8.00-9.30","9.30-11.00","11.00-12.30","13.00-14.30","14.30-16.00","16.00-17.30"];

export default function AdminBookingPage() {
  const router = useRouter();
  const { user } = useContext(AuthContext);

  const [date, setDate] = useState("");
  const [selectedTherapist, setSelectedTherapist] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({});
  const [showAlert, setShowAlert] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [clientHN, setClientHN] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

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
  }, [date]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits.length <= 3 ? digits : digits.slice(0,3) + "-" + digits.slice(3,10);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => setClientPhone(formatPhone(e.target.value));

  const isTimeSlotPast = (slot: string) => {
    if (!date) return false;
    const [startStr] = slot.split("-");
    const [hourStr, minStr = "00"] = startStr.split(".");
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
    const params = new URLSearchParams({ hn: clientHN, name: clientName, phone: clientPhone, date, therapist: selectedTherapist, time: selectedTime });
    router.push(`/confirm?${params.toString()}`);
  };

  const handleOpenDialog = () => {
    setClientHN("");
    setClientName("");
    setClientPhone("");
    setDialogOpen(true);
  };

  const handleAutoFillName = async () => {
    if (!clientName.trim()) return;
    try {
      const res = await fetch(`/api/user-info?name=${encodeURIComponent(clientName.trim())}`);
      const data = await res.json();
      if (data.success && data.name === clientName.trim()) {
        setClientHN(data.hn);
        setClientPhone(data.phone || "");
      } else alert("ไม่พบข้อมูลผู้ใช้ตรงกับชื่อที่กรอก");
    } catch { alert("เกิดข้อผิดพลาดในการดึงข้อมูล"); }
  };

  const handleAutoFillHN = async () => {
    if (clientHN.trim().length !== 9) return alert("กรุณากรอก HN ให้ครบ 9 หลัก");
    try {
      const res = await fetch(`/api/user-info?hn=${encodeURIComponent(clientHN.trim())}`);
      const data = await res.json();
      if (data.success) { setClientName(data.name); setClientPhone(data.phone || ""); } 
      else alert("ไม่พบข้อมูลผู้ใช้ตรงกับ HN ที่กรอก");
    } catch { alert("เกิดข้อผิดพลาดในการดึงข้อมูล"); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-emerald-100 relative overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.15 }} transition={{ duration: 2 }} className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_#a7f3d0,_transparent_70%)]"/>

      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => router.push("/")} className="absolute top-6 left-6 flex items-center space-x-2 px-5 py-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700 transition z-10">
        <Home className="w-5 h-5"/>
        <span>หน้าแรก</span>
      </motion.button>

      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => router.push("/all-bookings")} className="absolute top-6 right-6 flex items-center space-x-2 px-5 py-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700 transition z-10">
        <FaHistory className="w-5 h-5"/>
        <span>ประวัติการจองทั้งหมด</span>
      </motion.button>

      <div className="max-w-6xl mx-auto p-6 pt-20 relative z-10">
        <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl font-bold text-center mb-6 text-emerald-700">
          จองคิวนวดแผนไทย (Admin)
        </motion.h1>

        <div className="mb-8 max-w-sm mx-auto">
          <label className="block mb-2 font-medium text-gray-700 flex items-center gap-2"><CalendarIcon className="w-4 h-4"/> วันที่ต้องการนวด</label>
          <input type="date" value={date} min={new Date().toISOString().split("T")[0]} onChange={e => setDate(e.target.value)} className={`border border-gray-300 rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-emerald-400 transition ${!date ? "text-gray-400" : "text-gray-900"}`}/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {therapists.map(t => {
            const booked = bookedSlots[t] || [];
            const isSelected = selectedTherapist === t;
            return (
              <motion.div key={t} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`border p-5 rounded-2xl bg-white shadow-lg ${isSelected ? "ring-4 ring-emerald-300" : ""}`}>
                <div className="flex items-center gap-2 mb-3">
                  <UserIcon className="w-5 h-5 text-emerald-600"/>
                  <h2 className="text-lg font-semibold text-emerald-700">{t}</h2>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {timeSlots.map(slot => {
                    const isBooked = booked.includes(slot);
                    const isPast = isTimeSlotPast(slot);
                    const isActive = isSelected && selectedTime === slot;

                    return (
                      <button key={slot} disabled={isBooked || isPast} onClick={() => handleSelect(t, slot)}
                        className={`text-sm px-3 py-2 rounded-lg font-medium border flex items-center justify-center gap-1 transition shadow-sm ${
                          isBooked ? "bg-red-100 text-red-600 border-red-400 cursor-not-allowed" :
                          isPast ? "bg-yellow-100 text-yellow-700 border-yellow-400 cursor-not-allowed" :
                          isActive ? "bg-emerald-600 text-white border-emerald-600" :
                          "bg-white hover:bg-emerald-50 text-emerald-800 border-gray-300"
                        }`}>
                        <Clock className="w-4 h-4"/>
                        <span>{slot}</span>
                        {(isBooked || isPast) && <span className="text-xs font-semibold">({isBooked ? "ถูกจองแล้ว" : "หมดเวลาจอง"})</span>}
                      </button>
                    );
                  })}
                </div>

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleOpenDialog} disabled={!(isSelected && selectedTime && date)}
                  className={`mt-5 w-full py-2 rounded-xl font-bold shadow transition text-center ${isSelected && selectedTime && date ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
                  เลือก
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40"/>
            <Dialog.Content className="fixed z-50 left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg">
              <Dialog.Title className="text-xl font-bold mb-4 text-emerald-700">กรอกข้อมูลผู้รับบริการ</Dialog.Title>

              <label className="block mb-3 relative">
                <span className="text-sm font-medium text-emerald-800">HN</span>
                <input type="text" value={clientHN} onChange={e=>setClientHN(e.target.value)} maxLength={9} placeholder="กรอก HN" className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-gray-900"/>
                <button type="button" onClick={handleAutoFillHN} className="absolute top-0 right-0 mt-1 mr-1 px-2 py-1 bg-emerald-600 text-white rounded-md text-xs hover:bg-emerald-700">Auto-fill</button>
              </label>

              <label className="block mb-3 relative">
                <span className="text-sm font-medium text-emerald-800">ชื่อผู้รับบริการ</span>
                <input type="text" value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="กรอกชื่อ" className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-gray-900"/>
                <button type="button" onClick={handleAutoFillName} className="absolute top-0 right-0 mt-1 mr-1 px-2 py-1 bg-emerald-600 text-white rounded-md text-xs hover:bg-emerald-700">Auto-fill</button>
              </label>

              <label className="block mb-4">
                <span className="text-sm font-medium text-emerald-800">เบอร์โทร</span>
                <input type="text" value={clientPhone} onChange={handlePhoneChange} maxLength={11} placeholder="กรอกเบอร์โทร" className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-gray-900"/>
              </label>

              <div className="flex justify-end gap-3">
                <Dialog.Close asChild>
                  <button className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">ยกเลิก</button>
                </Dialog.Close>
                <button onClick={handleSubmit} className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700">ยืนยัน</button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <AnimatePresence>
          {showAlert && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-20 left-1/2 -translate-x-1/2 bg-yellow-50 border border-yellow-400 text-yellow-700 px-6 py-4 rounded-lg flex items-center gap-3 shadow-lg max-w-md z-50">
              <AlertCircle className="w-6 h-6"/>
              <span>กรุณาเลือกวันที่ก่อนจองคิว</span>
              <button onClick={() => setShowAlert(false)} className="ml-auto text-yellow-700 font-bold hover:text-yellow-900">✕</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
