"use client";

import { useEffect, useState, useContext } from "react";
import { User, Phone, UserCheck, Clock, CalendarDays, CheckCircle2, ChevronLeft, Home, Smile, Frown } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { FaCheck, FaTimes } from "react-icons/fa";
import { AuthContext } from "@/context/AuthContext";

interface Booking {
  id: number;
  provider: string;
  name: string;
  phone: string;
  therapist: string;
  time_slot: string;
  date: string;
  status: string;
}

const getStatusLabel = (b: Booking) => {
  if (b.status) return b.status;
  const [startStr, endStr] = b.time_slot.split("-");
  const [startHour, startMin = "00"] = startStr.split(".");
  const [endHour, endMin = "00"] = endStr.split(".");
  const startDateTime = new Date(b.date); startDateTime.setHours(+startHour, +startMin);
  const endDateTime = new Date(b.date); endDateTime.setHours(+endHour, +endMin);
  const now = new Date();
  if (now >= startDateTime && now < endDateTime) return "อยู่ในคิว";
  if (now < startDateTime) return "รอดำเนินการ";
  return "สำเร็จ";
};

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
    <div className="flex gap-3">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-4 bg-emerald-50 text-emerald-900 rounded-xl p-4 shadow-sm border-2 border-emerald-200 min-w-[396px]"
      >
        <Smile className="w-12 h-10 text-emerald-500 flex-shrink-0" />
        <div className="flex flex-col flex-grow justify-center">
          <div className="flex justify-center items-baseline gap-2">
            <span className="text-lg text-emerald-700">มานวด :</span>
            <span className="text-lg font-bold">{totalAttended} คน</span>
          </div>
          <div className="w-full h-4 bg-emerald-200 rounded-full mt-2 relative overflow-hidden">
            <motion.div
              className="h-full bg-emerald-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${attendedPercent}%` }}
              transition={{ duration: 1 }}
            />
            <div className="absolute inset-0 flex justify-center items-center text-white font-semibold text-xs">
              {attendedPercent}%
            </div>
          </div>
        </div>
      </motion.div>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex items-center gap-4 bg-red-50 text-red-900 rounded-xl p-4 shadow-sm border-2 border-red-200 min-w-[397px]"
      >
        <Frown className="w-12 h-10 text-red-500 flex-shrink-0" />
        <div className="flex flex-col flex-grow justify-center">
          <div className="flex justify-center items-baseline gap-2">
            <span className="text-lg text-red-700">ไม่มานวด :</span>
            <span className="text-lg font-bold">{totalCancelled} คน</span>
          </div>
          <div className="w-full h-4 bg-red-200 rounded-full mt-2 relative overflow-hidden">
            <motion.div
              className="h-full bg-red-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${cancelledPercent}%` }}
              transition={{ duration: 1 }}
            />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-semibold text-xs">
              {cancelledPercent}%
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function AllBookingsPage() {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [therapists, setTherapists] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);
  const [showConfirmSuccess, setShowConfirmSuccess] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);

  const [filterName, setFilterName] = useState("");
  const [filterTherapist, setFilterTherapist] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterTimeSlot, setFilterTimeSlot] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  useEffect(() => {
    if (!filterDate) {setBookings([]); return;}
    (async () => {
      try {
        const res = await fetch(`/api/all-bookings?date=${filterDate}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "เกิดข้อผิดพลาด");
        setBookings(data.bookings);
      } catch (e: any) {
        setError(e.message || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ");
      }
    })();
  }, [filterDate]);

  useEffect(() => {
    (async () => {
      try {
        const [res1, res2] = await Promise.all([fetch("/api/therapists"), fetch("/api/time-slots")]);
        const data1 = await res1.json(); if (data1.success) setTherapists(data1.therapists);
        const data2 = await res2.json(); if (data2.success) setTimeSlots(data2.timeSlots);
      } catch { setTherapists([]); setTimeSlots([]); }
    })();
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,"0")}-${d.getDate().toString().padStart(2,"0")}`;
  };

  const filteredBookings = bookings.filter(b => {
    const nameMatch = b.name.toLowerCase().includes(filterName.toLowerCase());
    const therapistMatch = filterTherapist === "all" || b.therapist === filterTherapist;
    const providerMatch = filterProvider === "all" || b.provider === filterProvider;
    const dateMatch = !filterDate || formatDate(b.date) === filterDate;
    const timeMatch = filterTimeSlot === "all" || b.time_slot === filterTimeSlot;
    const statusLabel = getStatusLabel(b);

    switch(filterStatus) {
      case "upcoming": return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch && statusLabel==="รอดำเนินการ";
      case "in_queue": return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch && statusLabel==="อยู่ในคิว";
      case "past": return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch && statusLabel==="สำเร็จ";
      case "cancelled": return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch && statusLabel==="ยกเลิก";
      default: return nameMatch && therapistMatch && providerMatch && dateMatch && timeMatch;
    }
  });

const attendedKeys = new Set<string>();
const cancelledKeys = new Set<string>();

bookings.forEach(b => {
  if (filterDate && formatDate(b.date) !== filterDate) return; // กรองตามวันที่ก่อน

  const key = `${b.name}-${formatDate(b.date)}`;
  const status = getStatusLabel(b);

  if (status === "สำเร็จ") {
    attendedKeys.add(key);  // มานวด
  } else if (status === "ยกเลิก" && !attendedKeys.has(key)) {
    cancelledKeys.add(key); // ไม่มานวด
  }
});

const attendedBookings = Array.from(attendedKeys).map(k => {
  const [name, date] = k.split("-");
  return bookings.find(b => b.name === name && formatDate(b.date) === date)!;
});

const cancelledBookings = Array.from(cancelledKeys).map(k => {
  const [name, date] = k.split("-");
  return bookings.find(b => b.name === name && formatDate(b.date) === date)!;
});

  const selectedBooking = bookings.find(b => b.id === selectedId);

  const handleBookingAction = async (action: "confirm"|"cancel") => {
    if (!selectedId) return;
    try {
      const url = action==="cancel" ? `/api/cancel-booking?id=${selectedId}` : `/api/all-bookings?confirmId=${selectedId}`;
      const method = action==="cancel" ? "DELETE" : "GET";
      const res = await fetch(url, { method });
      const data = await res.json();
      if (data.success) {
        setBookings(prev => prev.map(b => b.id===selectedId ? {...b, status: action==="cancel" ? "ยกเลิก":"อยู่ในคิว"} : b));
        setSelectedId(null);
        if (action==="cancel") setShowCancelSuccess(true);
        else setShowConfirmSuccess(true);
        setTimeout(() => (action === "cancel" ? setShowCancelSuccess(false) : setShowConfirmSuccess(false)), 3000);
      } else alert(`เกิดข้อผิดพลาดในการ${action==="cancel"?"ยกเลิก":"ยืนยัน"}`);
    } catch { alert(`ไม่สามารถ${action==="cancel"?"ยกเลิก":"ยืนยัน"}การจองได้`); }
  };

  if (error) return <p className="p-4 text-center text-red-600 font-semibold">Error: {error}</p>;

  return (
    <div className="min-h-screen px-6 py-12 bg-gradient-to-br from-white to-emerald-50 relative">
      <div className="max-w-[92rem] mx-auto relative">
        <div className="fixed top-4 left-4 z-50">
          <motion.button 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }} 
            onClick={() => router.back()} 
            className="flex items-center space-x-2 px-5 py-2 rounded-lg shadow-md text-white bg-emerald-600 hover:bg-emerald-700"
          >
            <ChevronLeft className="w-5 h-5"/>
            <span>ย้อนกลับ</span>
          </motion.button>
        </div>
        <div className="fixed top-4 right-4 z-50">
          <motion.button 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }} 
            onClick={() => router.push("/")} 
            className="flex items-center space-x-2 px-5 py-2 rounded-lg shadow-md text-white bg-emerald-600 hover:bg-emerald-700"
          >
            <Home className="w-5 h-5"/>
            <span>หน้าแรก</span>
          </motion.button>
        </div>
      </div>
      <h1 className="text-4xl font-extrabold text-emerald-700 mb-12 text-center drop-shadow-sm">ประวัติการจองทั้งหมด</h1>
      <div className="max-w-6xl mx-auto mb-5 flex flex-wrap gap-4 items-end">
        <div className="min-w-[356px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">ผู้มารับบริการ:</label>
          <input 
            type="text" 
            placeholder="พิมพ์ชื่อเพื่อกรอง..." 
            value={filterName} 
            onChange={e => setFilterName(e.target.value)}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          />
        </div>
        <div className="min-w-[256px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">ผู้รับผิดชอบ:</label>
          <select 
            value={filterProvider} 
            onChange={e => setFilterProvider(e.target.value)}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          >
            <option value="all">ทั้งหมด</option>
            {therapists.map((t,i)=><option key={i} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="min-w-[256px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">ผู้ให้บริการ:</label>
          <select 
            value={filterTherapist} 
            onChange={e => setFilterTherapist(e.target.value)}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          >
            <option value="all">ทั้งหมด</option>
            {therapists.map((t,i)=><option key={i} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">สถานะ:</label>
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          >
            <option value="all">ทั้งหมด</option>
            <option value="upcoming">รอดำเนินการ</option>
            <option value="in_queue">อยู่ในคิว</option>
            <option value="past">สำเร็จ</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
        </div>
        <div className="flex items-end">
          <motion.button 
            whileHover={{scale:1.05}} 
            whileTap={{scale:0.95}}
            onClick={() => {
              setFilterName(""); 
              setFilterTherapist("all"); 
              setFilterStatus("all"); 
              setFilterDate(""); 
              setFilterTimeSlot("all"); 
              setFilterProvider("all");
            }}
            className="h-10 px-4 bg-emerald-600 text-white rounded-md font-semibold hover:bg-emerald-700 transition"
          >
            รีเซ็ต
          </motion.button>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mb-5 flex flex-wrap gap-4 items-end">
        <div className="min-w-[150px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">วันที่:</label>
          <input 
            type="date" 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)}
            className={`w-full px-4 h-10 border rounded-md focus:outline-none focus:ring-2 
              ${filterDate 
                ? "border-emerald-500 text-gray-900 focus:ring-emerald-500" 
                : "border-gray-300 text-gray-400"
              }`}
          />
        </div>
        <div className="min-w-[150px]">
          <label className="block text-emerald-700 font-semibold mb-2 text-lg">ช่วงเวลา:</label>
          <select 
            value={filterTimeSlot} 
            onChange={e => setFilterTimeSlot(e.target.value)}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 placeholder-gray-400"
          >
            <option value="all">ทั้งหมด</option>
            {timeSlots.map((slot,i)=><option key={i} value={slot}>{slot}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[337px] -mt-1">
          <BookingSummary attended={attendedBookings} cancelled={cancelledBookings} />
        </div>
      </div>
      
      {filteredBookings.length===0?(
        <p className="text-center text-gray-500 italic select-none">ยังไม่มีประวัติ</p>
      ):(
        <ul className="space-y-4 w-full max-w-[92rem] mx-auto px-6">
          {filteredBookings.map(b=>(
            <li key={b.id} className={`bg-white border rounded-xl p-5 flex justify-between items-center border-l-8 ${getStatusColor(b)}`}>
              <div className="grid grid-cols-[205px_185px_110px_205px_130px_130px_130px] gap-x-6 text-gray-700 flex-grow">
                <Label icon={<UserCheck className="w-4 h-4"/>} text="ผู้รับผิดชอบ"/>
                <Label icon={<User className="w-4 h-4"/>} text="ผู้มารับบริการ"/>
                <Label icon={<Phone className="w-4 h-4"/>} text="เบอร์โทร"/>
                <Label icon={<UserCheck className="w-4 h-4"/>} text="ผู้ให้บริการ"/>
                <Label icon={<CalendarDays className="w-4 h-4"/>} text="วันที่"/>
                <Label icon={<Clock className="w-4 h-4"/>} text="ช่วงเวลา"/>
                <Label icon={<CheckCircle2 className="w-4 h-4"/>} text="สถานะ"/>

                <span className="font-normal text-base">{b.provider}</span>
                <span className="font-normal text-base">{b.name}</span>
                <span className="font-normal text-base">{b.phone}</span>
                <span className="font-normal text-base">{b.therapist}</span>
                <span className="font-normal text-base">{new Date(b.date).toLocaleDateString("th-TH",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Bangkok"})}</span>
                <span className="font-normal text-base">{b.time_slot}</span>
                <span className={`font-bold text-base ${
                  b.status==="ยกเลิก"?"text-red-600":
                  getStatusLabel(b)==="สำเร็จ"?"text-emerald-600":
                  getStatusLabel(b)==="อยู่ในคิว"?"text-orange-600":"text-gray-600"
                }`}>{getStatusLabel(b)}</span>
              </div>
              <div className="flex gap-2">
                {user?.role !== "user" && getStatusLabel(b) === "ยกเลิก" && (
                  <Dialog.Root open={cancelDialogOpen && selectedId===b.id} onOpenChange={setCancelDialogOpen}>
                    <Dialog.Trigger asChild>
                      <motion.button
                        whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                        onClick={()=>{setSelectedId(b.id); setCancelDialogOpen(true);}}
                        className="px-4 py-2 rounded-md flex items-center gap-2 bg-gray-300 text-gray-600"
                      >
                        <FaTimes className="text-red-500"/>
                        ยกเลิกแล้ว
                      </motion.button>
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
                            setBookings(prev => prev.filter(x => x.id !== b.id));
                            setSelectedId(null);
                            setShowDeleteSuccess(true); // เพิ่มตรงนี้
                            setTimeout(() => setShowDeleteSuccess(false), 3000); // ปิดหลัง 3 วินาที
                          } else alert("เกิดข้อผิดพลาดในการลบรายการ");
                        } catch {
                          alert("ไม่สามารถลบรายการได้");
                        }
                      }}
                    />
                  </Dialog.Root>
                )}

                {user?.role !== "user" && getStatusLabel(b) === "รอดำเนินการ" && (
                  <Dialog.Root>
                    <Dialog.Trigger asChild>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedId(b.id)}
                        className="flex items-center justify-center w-15 h-10 bg-emerald-600 rounded-md shadow hover:bg-emerald-700 transition"
                      >
                        <FaCheck className="text-white w-5 h-5" />
                      </motion.button>
                    </Dialog.Trigger>
                    <BookingDialog
                      title="ต้องการยืนยันรายการนี้หรือไม่?"
                      color="emerald"
                      booking={b}
                      onConfirm={() => handleBookingAction("confirm")}
                    />
                  </Dialog.Root>
                )}

                {user?.role !== "user" && (getStatusLabel(b) === "รอดำเนินการ" || getStatusLabel(b) === "อยู่ในคิว") && (
                  <Dialog.Root>
                    <Dialog.Trigger asChild>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedId(b.id)}
                        className="flex items-center justify-center w-15 h-10 bg-red-500 rounded-md shadow hover:bg-red-600 transition"
                      >
                        <FaTimes className="text-white w-5 h-5" />
                      </motion.button>
                    </Dialog.Trigger>
                    <BookingDialog
                      title="ต้องการยกเลิกรายการนี้หรือไม่?"
                      color="red"
                      booking={b}
                      onConfirm={() => handleBookingAction("cancel")}
                    />
                  </Dialog.Root>
                )}

                {/* ปุ่มสำเร็จแล้ว ไม่ต้องเช็ก role */}
                {getStatusLabel(b) === "สำเร็จ" && (
                  <button disabled className="px-4 py-2 rounded-md text-gray-600 flex items-center gap-2 bg-gray-300">
                    <FaCheck className="text-emerald-600"/>
                    สำเร็จแล้ว
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <AnimatePresence>
        {showCancelSuccess && <Toast key="cancel" message="ยกเลิกการจองสำเร็จ" />}
        {showConfirmSuccess && <Toast key="confirm" message="ยืนยันการจองสำเร็จ" />}
        {showDeleteSuccess && <Toast key="delete" message="ลบรายการสำเร็จ" />}
      </AnimatePresence>
    </div>
  );
}

function Label({ icon, text }: { icon: React.ReactNode, text: string }) {
  return <div className="flex items-center gap-1 text-emerald-700 font-medium text-sm">{icon} {text}</div>;
}

function Toast({ message }: { message: string }) {
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg z-50">{message}</motion.div>
  );
}

function BookingDialog({ title, color, booking, onConfirm }: any) {
  if (!booking) return null;
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40"/>
      <Dialog.Content asChild>
        <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.9}} transition={{duration:0.2}} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-xl shadow-lg z-50 w-96">
          <Dialog.Title className={`text-xl font-bold text-${color}-600 mb-4`}>{title}</Dialog.Title>
          <div className="mb-4 text-sm grid grid-cols-1 gap-2">
            {[
              {icon:<UserCheck className="w-5 h-5 text-emerald-700"/>, label:"ผู้รับผิดชอบ", value:booking.provider},
              {icon:<User className="w-5 h-5 text-emerald-700"/>, label:"ชื่อ", value:booking.name},
              {icon:<Phone className="w-5 h-5 text-emerald-700"/>, label:"เบอร์โทร", value:booking.phone},
              {icon:<UserCheck className="w-5 h-5 text-emerald-700"/>, label:"ผู้ให้บริการ", value:booking.therapist},
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
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}