"use client";

import { useEffect, useState } from "react";
import { User, Phone, UserCheck, Clock, CalendarDays, Trash2, CheckCircle2, ChevronLeft, Home, Smile, Frown } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface Booking {
  id: number;
  name: string;
  phone: string;
  therapist: string;
  time_slot: string;
  date: string;
  status: string;
}

function getStatusLabel(b: Booking) {
  if (b.status === "ยกเลิก") return "ยกเลิก";
  const [startStr, endStr] = b.time_slot.split("-");
  const [startHour, startMin = "00"] = startStr.split(".");
  const [endHour, endMin = "00"] = endStr.split(".");
  const startDateTime = new Date(b.date);
  startDateTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
  const endDateTime = new Date(b.date);
  endDateTime.setHours(parseInt(endHour), parseInt(endMin), 0, 0);
  const now = new Date();
  if (now >= startDateTime && now < endDateTime) return "อยู่ในคิว";
  if (now < startDateTime) return "รอดำเนินการ";
  return "สำเร็จ";
}

const getStatusColor = (b: Booking) => {
  switch (getStatusLabel(b)) {
    case "ยกเลิก": return "border-red-500";
    case "อยู่ในคิว": return "border-orange-500";
    case "สำเร็จ": return "border-emerald-500";
    default: return "border-gray-500";
  }
};

interface SummaryProps { attended: Booking[]; cancelled: Booking[]; }
function BookingSummary({ attended, cancelled }: SummaryProps) {
  const totalAttended = attended.length;
  const totalCancelled = cancelled.length;
  const total = totalAttended + totalCancelled;
  const attendedPercent = total ? Math.round((totalAttended / total) * 100) : 0;
  const cancelledPercent = total ? 100 - attendedPercent : 0;

  return (
    <div className="max-w-6xl mx-auto mb-5 grid grid-cols-2 gap-2">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}
        className="relative bg-emerald-50 text-emerald-900 rounded-2xl p-4 shadow-md flex flex-col items-center border-2 border-emerald-200 transition-transform">
        <Smile className="w-8 h-8 text-emerald-500 mb-1" />
        <span className="text-xl font-bold">{totalAttended} คน</span>
        <span className="text-sm font-medium text-emerald-700 mb-2">มานวด</span>
        <div className="w-full h-3 bg-emerald-200 rounded-full overflow-hidden">
          <motion.div className="h-full bg-emerald-600 rounded-full" initial={{ width: 0 }} animate={{ width: `${attendedPercent}%` }} transition={{ duration: 1 }} />
        </div>
        <span className="text-xs text-gray-600 mt-1">{attendedPercent}%</span>
      </motion.div>

      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}
        className="relative bg-red-50 text-red-900 rounded-2xl p-4 shadow-md flex flex-col items-center border-2 border-red-200 transition-transform">
        <Frown className="w-8 h-8 text-red-500 mb-1" />
        <span className="text-xl font-bold">{totalCancelled} คน</span>
        <span className="text-sm font-medium text-red-700 mb-2">ไม่มานวด</span>
        <div className="w-full h-3 bg-red-200 rounded-full overflow-hidden">
          <motion.div className="h-full bg-red-600 rounded-full" initial={{ width: 0 }} animate={{ width: `${cancelledPercent}%` }} transition={{ duration: 1 }} />
        </div>
        <span className="text-xs text-gray-600 mt-1">{cancelledPercent}%</span>
      </motion.div>
    </div>
  );
}

export default function AllBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // dropdown data จาก API
  const [therapists, setTherapists] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);

  const [filterName, setFilterName] = useState("");
  const [filterTherapist, setFilterTherapist] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterTimeSlot, setFilterTimeSlot] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/all-bookings");
        if (!res.ok) throw new Error("Failed to fetch data");
        const data = await res.json();
        if (data.success) setBookings(data.bookings);
        else setError(data.error || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } catch (e: any) {
        setError(e.message || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ");
      } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res1 = await fetch("/api/therapists");
        const data1 = await res1.json();
        if (data1.success) setTherapists(data1.therapists);

        const res2 = await fetch("/api/time-slots");
        const data2 = await res2.json();
        if (data2.success) setTimeSlots(data2.timeSlots);
      } catch {
        setTherapists([]);
        setTimeSlots([]);
      }
    })();
  }, []);

  const filteredBookings = bookings.filter((b) => {
    const nameMatch = b.name.toLowerCase().includes(filterName.toLowerCase());
    const therapistMatch = filterTherapist === "all" ? true : b.therapist === filterTherapist;
    const statusLabel = getStatusLabel(b);
    const bookingDateObj = new Date(b.date);
    const bookingDate = `${bookingDateObj.getFullYear()}-${(bookingDateObj.getMonth()+1).toString().padStart(2,"0")}-${bookingDateObj.getDate().toString().padStart(2,"0")}`;
    const dateMatch = filterDate ? bookingDate === filterDate : true;
    const timeSlotMatch = filterTimeSlot === "all" ? true : b.time_slot === filterTimeSlot;

    if (filterStatus === "all") return nameMatch && therapistMatch && dateMatch && timeSlotMatch;
    if (filterStatus === "upcoming") return nameMatch && therapistMatch && dateMatch && timeSlotMatch && statusLabel === "รอดำเนินการ";
    if (filterStatus === "in_queue") return nameMatch && therapistMatch && dateMatch && timeSlotMatch && statusLabel === "อยู่ในคิว";
    if (filterStatus === "past") return nameMatch && therapistMatch && dateMatch && timeSlotMatch && statusLabel === "สำเร็จ";
    if (filterStatus === "cancelled") return nameMatch && therapistMatch && dateMatch && timeSlotMatch && statusLabel === "ยกเลิก";
    return nameMatch && therapistMatch && dateMatch && timeSlotMatch;
  });

  const attendedBookings = filteredBookings.filter(b => getStatusLabel(b) === "สำเร็จ");
  const cancelledBookings = filteredBookings.filter(b => getStatusLabel(b) === "ยกเลิก");

  const selectedBooking = bookings.find(b => b.id === selectedId);

  const confirmCancelBooking = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/cancel-booking?id=${selectedId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setBookings(prev => prev.map(b => b.id === selectedId ? { ...b, status: "ยกเลิก" } : b));
        setOpen(false);
        setSelectedId(null);
        setShowCancelSuccess(true);
        setTimeout(() => setShowCancelSuccess(false), 3000);
      } else alert("เกิดข้อผิดพลาดในการยกเลิก");
    } catch { alert("ไม่สามารถยกเลิกการจองได้"); }
  };

  if (loading) return <p className="p-4 text-center text-gray-600">กำลังโหลดข้อมูล...</p>;
  if (error) return <p className="p-4 text-center text-red-600 font-semibold">Error: {error}</p>;

  return (
    <div className="min-h-screen px-6 py-12 bg-gradient-to-br from-white to-emerald-50 relative">
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => router.back()}
        className="absolute top-6 left-6 flex items-center space-x-2 px-5 py-2 rounded-lg shadow-md transition z-10 text-white bg-emerald-600 hover:bg-emerald-700">
        <ChevronLeft className="w-5 h-5" /><span>ย้อนกลับ</span>
      </motion.button>
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => router.push("/")}
        className="absolute top-6 right-6 flex items-center space-x-2 px-5 py-2 rounded-lg shadow-md transition z-10 text-white bg-emerald-600 hover:bg-emerald-700">
        <Home className="w-5 h-5" /><span>หน้าแรก</span>
      </motion.button>

      <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-700 mb-10 text-center drop-shadow-sm">ประวัติการจองทั้งหมด (Admin)</h1>

      <div className="max-w-6xl mx-auto mb-5 flex gap-4 flex-wrap items-end">
        <div className="flex-grow flex gap-2 items-end">
          <div className="flex-grow">
            <label className="block text-emerald-700 font-semibold mb-2">ผู้มารับบริการ:</label>
            <input type="text" value={filterName} onChange={e => setFilterName(e.target.value)}
              placeholder="พิมพ์ชื่อเพื่อกรอง..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-400 text-gray-900" />
          </div>
          <div>
            <label className="block text-emerald-700 font-semibold mb-2">ผู้ให้บริการ:</label>
            <select value={filterTherapist} onChange={e => setFilterTherapist(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900">
              <option value="all">ทั้งหมด</option>
              {therapists.map((t,i) => <option key={i} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-emerald-700 font-semibold mb-2">วันที่:</label>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900" />
        </div>
        <div>
          <label className="block text-emerald-700 font-semibold mb-2">ช่วงเวลา:</label>
          <select value={filterTimeSlot} onChange={e => setFilterTimeSlot(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900">
            <option value="all">ทั้งหมด</option>
            {timeSlots.map((slot,i) => <option key={i} value={slot}>{slot}</option>)}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="block text-emerald-700 font-semibold mb-2">สถานะ:</label>
          <div className="flex gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900">
              <option value="all">ทั้งหมด</option>
              <option value="upcoming">รอดำเนินการ</option>
              <option value="in_queue">อยู่ในคิว</option>
              <option value="past">สำเร็จ</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => {
              setFilterName(""); setFilterTherapist("all"); setFilterStatus("all"); setFilterDate(""); setFilterTimeSlot("all");
            }} className="px-4 py-2 bg-emerald-600 text-white rounded-md font-semibold hover:bg-emerald-700 transition">รีเซ็ต</motion.button>
          </div>
        </div>
      </div>

      <BookingSummary attended={attendedBookings} cancelled={cancelledBookings} />

      {filteredBookings.length === 0 ? (
        <p className="text-center text-gray-500 italic select-none">ยังไม่มีประวัติ</p>
      ) : (
        <ul className="space-y-6 mx-auto" style={{ maxWidth: "77.5rem" }}>
          {filteredBookings.map((b) => (
            <li key={b.id} className={`bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition flex justify-between items-center border-l-8 ${getStatusColor(b)}`}>
              <div className="grid grid-cols-[200px_135px_202px_135px_135px_135px] gap-x-6 text-gray-700 flex-grow">
                <Label icon={<User className="w-4 h-4" />} text="ชื่อ" />
                <Label icon={<Phone className="w-4 h-4" />} text="เบอร์โทร" />
                <Label icon={<UserCheck className="w-4 h-4" />} text="ผู้ให้บริการ" />
                <Label icon={<CalendarDays className="w-4 h-4" />} text="วันที่" />
                <Label icon={<Clock className="w-4 h-4" />} text="ช่วงเวลา" />
                <Label icon={<CheckCircle2 className="w-4 h-4" />} text="สถานะ" />

                <span className="font-normal text-base">{b.name}</span>
                <span className="font-normal text-base">{b.phone}</span>
                <span className="font-normal text-base">{b.therapist}</span>
                <span className="font-normal text-base">{new Date(b.date).toLocaleDateString("th-TH", { year:"numeric", month:"2-digit", day:"2-digit", timeZone:"Asia/Bangkok" })}</span>
                <span className="font-normal text-base">{b.time_slot}</span>
                <span className={`font-bold text-base ${
                  b.status==="ยกเลิก" ? "text-red-600" :
                  getStatusLabel(b)==="สำเร็จ" ? "text-emerald-600" :
                  getStatusLabel(b)==="อยู่ในคิว" ? "text-orange-600" : "text-gray-600"}`}>
                  {getStatusLabel(b)}
                </span>
              </div>

              <div>
                {getStatusLabel(b) === "สำเร็จ" || getStatusLabel(b) === "ยกเลิก" ? (
                  <button disabled className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md cursor-not-allowed">
                    {getStatusLabel(b)==="สำเร็จ" ? "✔️ สำเร็จแล้ว" : "❌ ยกเลิกแล้ว"}
                  </button>
                ) : (
                  <Dialog.Root open={open && selectedId===b.id} onOpenChange={setOpen}>
                    <Dialog.Trigger asChild>
                      <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }} onClick={()=>{setSelectedId(b.id); setOpen(true);}}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md font-semibold shadow hover:bg-red-700 transition">
                        <Trash2 className="w-5 h-5"/>ยกเลิก
                      </motion.button>
                    </Dialog.Trigger>
                    <Dialog.Portal>
                      <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40"/>
                      <Dialog.Content asChild>
                        <motion.div initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.9}} transition={{duration:0.2}}
                          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-xl shadow-lg z-50 w-96">
                          <Dialog.Title className="text-xl font-bold text-red-600 mb-4">ต้องการยกเลิกรายการนี้หรือไม่?</Dialog.Title>
                            {selectedBooking && (
                              <div className="mb-4 text-sm">
                                <div className="grid grid-cols-1 gap-2">
                                  <div className="flex items-center gap-2 p-2 rounded-md border border-gray-200">
                                    <User className="w-5 h-5 text-emerald-700" />
                                    <span className="font-medium text-emerald-700">ชื่อ:</span>
                                    <span className="ml-auto font-semibold text-emerald-700">{selectedBooking.name}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 p-2 rounded-md border border-gray-200">
                                    <Phone className="w-5 h-5 text-emerald-700" />
                                    <span className="font-medium text-emerald-700">เบอร์โทร:</span>
                                    <span className="ml-auto font-semibold text-emerald-700">{selectedBooking.phone}</span>
                                  </div>

                                  <div className="flex items-center gap-2 p-2 rounded-md border border-gray-200">
                                    <UserCheck className="w-5 h-5 text-emerald-700" />
                                    <span className="font-medium text-emerald-700">ผู้ให้บริการ:</span>
                                    <span className="ml-auto font-semibold text-emerald-700">{selectedBooking.therapist}</span>
                                  </div>

                                  <div className="flex items-center gap-2 p-2 rounded-md border border-gray-200">
                                    <CalendarDays className="w-5 h-5 text-emerald-700" />
                                    <span className="font-medium text-emerald-700">วันที่:</span>
                                    <span className="ml-auto font-semibold text-emerald-700">
                                      {new Date(selectedBooking.date).toLocaleDateString("th-TH", { year:"numeric", month:"2-digit", day:"2-digit", timeZone:"Asia/Bangkok" })}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 p-2 rounded-md border border-gray-200">
                                    <Clock className="w-5 h-5 text-emerald-700" />
                                    <span className="font-medium text-emerald-700">ช่วงเวลา:</span>
                                    <span className="ml-auto font-semibold text-emerald-700">{selectedBooking.time_slot}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          <div className="flex justify-end gap-4">
                            <Dialog.Close asChild>
                              <button className="px-4 py-2 rounded-md bg-gray-500 hover:bg-gray-600 transition">ยกเลิก</button>
                            </Dialog.Close>
                            <button onClick={confirmCancelBooking} className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition">ยืนยัน</button>
                          </div>
                        </motion.div>
                      </Dialog.Content>
                    </Dialog.Portal>
                  </Dialog.Root>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {showCancelSuccess && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg z-50">
            ยกเลิกการจองสำเร็จ
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Label({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="flex items-center gap-1 text-emerald-700 font-medium text-sm">
      {icon} {text}
    </div>
  );
}
