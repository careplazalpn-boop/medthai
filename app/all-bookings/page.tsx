"use client";

import { useEffect, useState } from "react";
import { User, Phone, UserCheck, Clock, CalendarDays, Trash2, XCircle, CheckCircle2, ChevronLeft, Home } from "lucide-react";
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

// Component สรุปมานวด / ไม่มานวด
interface SummaryProps { attended: number; cancelled: number; }
function BookingSummary({ attended, cancelled }: SummaryProps) {
  const total = attended + cancelled;
  const attendedPercent = total ? Math.round((attended / total) * 100) : 0;
  const cancelledPercent = total ? 100 - attendedPercent : 0;

  return (
    <div className="max-w-6xl mx-auto mb-6 grid grid-cols-2 gap-6">
      <div className="bg-emerald-100 text-emerald-800 rounded-xl p-4 shadow flex flex-col items-center">
        <span className="text-xl font-bold">{attended} คน</span>
        <span className="text-sm text-emerald-700 mb-2">มานวด</span>
        <div className="w-full h-3 bg-emerald-200 rounded-full overflow-hidden">
          <motion.div className="h-full bg-emerald-600" initial={{ width: 0 }} animate={{ width: `${attendedPercent}%` }} transition={{ duration: 0.8 }}></motion.div>
        </div>
        <span className="text-xs text-gray-600 mt-1">{attendedPercent}%</span>
      </div>
      <div className="bg-red-100 text-red-800 rounded-xl p-4 shadow flex flex-col items-center">
        <span className="text-xl font-bold">{cancelled} คน</span>
        <span className="text-sm text-red-700 mb-2">ไม่มานวด</span>
        <div className="w-full h-3 bg-red-200 rounded-full overflow-hidden">
          <motion.div className="h-full bg-red-600" initial={{ width: 0 }} animate={{ width: `${cancelledPercent}%` }} transition={{ duration: 0.8 }}></motion.div>
        </div>
        <span className="text-xs text-gray-600 mt-1">{cancelledPercent}%</span>
      </div>
    </div>
  );
}

export default function AllBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);

  const [filterName, setFilterName] = useState("");
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

  const filteredBookings = bookings.filter((b) => {
    const nameMatch = b.name.toLowerCase().includes(filterName.toLowerCase());
    const statusLabel = getStatusLabel(b);
    const bookingDateObj = new Date(b.date);
    const bookingDate = `${bookingDateObj.getFullYear()}-${(bookingDateObj.getMonth()+1).toString().padStart(2,"0")}-${bookingDateObj.getDate().toString().padStart(2,"0")}`;
    const dateMatch = filterDate ? bookingDate === filterDate : true;
    const timeSlotMatch = filterTimeSlot === "all" ? true : b.time_slot === filterTimeSlot;

    if (filterStatus === "all") return nameMatch && dateMatch && timeSlotMatch;
    if (filterStatus === "upcoming") return nameMatch && dateMatch && timeSlotMatch && statusLabel === "รอดำเนินการ";
    if (filterStatus === "in_queue") return nameMatch && dateMatch && timeSlotMatch && statusLabel === "อยู่ในคิว";
    if (filterStatus === "past") return nameMatch && dateMatch && timeSlotMatch && statusLabel === "สำเร็จ";
    if (filterStatus === "cancelled") return nameMatch && dateMatch && timeSlotMatch && statusLabel === "ยกเลิก";
    return nameMatch && dateMatch && timeSlotMatch;
  });

  const totalAttended = filteredBookings.filter((b) => getStatusLabel(b) === "สำเร็จ").length;
  const totalCancelled = filteredBookings.filter((b) => getStatusLabel(b) === "ยกเลิก").length;

  const confirmCancelBooking = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/delete-booking?id=${selectedId}`, { method: "DELETE" });
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
      {/* ปุ่มย้อนกลับ */}
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => router.back()}
        className="absolute top-6 left-6 flex items-center space-x-2 px-5 py-2 rounded-lg shadow-md transition z-10 text-white bg-emerald-600 hover:bg-emerald-700">
        <ChevronLeft className="w-5 h-5" /><span>ย้อนกลับ</span>
      </motion.button>
      {/* ปุ่มหน้าแรก */}
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => router.push("/")}
        className="absolute top-6 right-6 flex items-center space-x-2 px-5 py-2 rounded-lg shadow-md transition z-10 text-white bg-emerald-600 hover:bg-emerald-700">
        <Home className="w-5 h-5" /><span>หน้าแรก</span>
      </motion.button>

      <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-700 mb-10 text-center drop-shadow-sm">
        ประวัติการจองทั้งหมด (Admin)
      </h1>

      {/* ฟิลเตอร์ */}
      <div className="max-w-6xl mx-auto mb-8 flex gap-4 flex-wrap">
        <div className="flex-grow">
          <label className="block text-emerald-700 font-semibold mb-2">ค้นหาชื่อผู้จอง:</label>
          <input type="text" value={filterName} onChange={e => setFilterName(e.target.value)}
            placeholder="พิมพ์ชื่อเพื่อกรอง..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-400 text-gray-900" />
        </div>
        <div>
          <label className="block text-emerald-700 font-semibold mb-2">ช่วงเวลา:</label>
          <select value={filterTimeSlot} onChange={e => setFilterTimeSlot(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900">
            <option value="all">ทั้งหมด</option>
            <option value="8.00-9.30">8.00-9.30</option>
            <option value="9.30-11.00">9.30-11.00</option>
            <option value="11.00-12.30">11.00-12.30</option>
            <option value="13.00-14.30">13.00-14.30</option>
            <option value="14.30-16.00">14.30-16.00</option>
            <option value="16.00-17.30">16.00-17.30</option>
          </select>
        </div>
        <div>
          <label className="block text-emerald-700 font-semibold mb-2">วันที่:</label>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900" />
        </div>
        <div>
          <label className="block text-emerald-700 font-semibold mb-2">สถานะ:</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900">
            <option value="all">ทั้งหมด</option>
            <option value="upcoming">รอดำเนินการ</option>
            <option value="in_queue">อยู่ในคิว</option>
            <option value="past">สำเร็จ</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
        </div>
      </div>

      {/* สรุปจำนวนคน */}
      <BookingSummary attended={totalAttended} cancelled={totalCancelled} />

      {filteredBookings.length === 0 ? (
        <p className="text-center text-gray-500 italic select-none">ยังไม่มีประวัติ</p>
      ) : (
        <ul className="space-y-6 mx-auto" style={{ maxWidth: "75.5rem" }}>
          {filteredBookings.map((b) => (
            <li key={b.id} className={`bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition flex justify-between items-center border-l-8 ${getStatusColor(b)}`}>
              <div className="grid grid-cols-[150px_150px_150px_150px_150px_120px] gap-x-6 text-gray-700 flex-grow">
                <Label icon={<User className="w-4 h-4" />} text="ชื่อ" />
                <Label icon={<Phone className="w-4 h-4" />} text="เบอร์โทร" />
                <Label icon={<UserCheck className="w-4 h-4" />} text="ผู้ให้บริการ" />
                <Label icon={<Clock className="w-4 h-4" />} text="ช่วงเวลา" />
                <Label icon={<CalendarDays className="w-4 h-4" />} text="วันที่" />
                <Label icon={<CheckCircle2 className="w-4 h-4" />} text="สถานะ" />

                <span className="font-normal text-base">{b.name}</span>
                <span className="font-normal text-base">{b.phone}</span>
                <span className="font-normal text-base">{b.therapist}</span>
                <span className="font-normal text-base">{b.time_slot}</span>
                <span className="font-normal text-base">
                  {new Date(b.date).toLocaleDateString("th-TH", { year:"numeric", month:"2-digit", day:"2-digit", timeZone:"Asia/Bangkok" })}
                </span>
                <span className={`font-bold text-base ${
                  b.status==="ยกเลิก" ? "text-red-600" :
                  getStatusLabel(b)==="สำเร็จ" ? "text-emerald-600" :
                  getStatusLabel(b)==="อยู่ในคิว" ? "text-orange-600" : "text-gray-600"}`}>
                  {getStatusLabel(b)}
                </span>
              </div>

              {/* ปุ่มตามสถานะ */}
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
                        <motion.div initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.9}} transition={{duration:0.3}}
                          className="fixed z-50 left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg">
                          <div className="flex items-start gap-3">
                            <XCircle className="w-8 h-8 text-red-500 mt-1"/>
                            <div className="flex-1">
                              <Dialog.Title className="text-lg font-bold text-red-700 mb-1">ยืนยันการยกเลิก</Dialog.Title>
                              <Dialog.Description className="text-gray-600">คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองนี้?</Dialog.Description>
                              <div className="flex justify-end gap-3 mt-5">
                                <Dialog.Close className="px-4 py-2 rounded-md border border-gray-300">ยกเลิก</Dialog.Close>
                                <button onClick={confirmCancelBooking} className="px-4 py-2 bg-red-600 text-white rounded-md font-semibold hover:bg-red-700 transition">ยืนยัน</button>
                              </div>
                            </div>
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

      {/* Popup แสดงยกเลิกสำเร็จ */}
      <AnimatePresence>
        {showCancelSuccess && (
          <motion.div initial={{opacity:0, y:30}} animate={{opacity:1, y:0}} exit={{opacity:0, y:30}} transition={{duration:0.5}}
            className="fixed bottom-10 right-10 px-6 py-4 bg-emerald-600 text-white rounded-lg shadow-lg z-50">
            ยกเลิกการจองเรียบร้อยแล้ว
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Label Component
function Label({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-2">{icon}<span>{text}</span></div>;
}
