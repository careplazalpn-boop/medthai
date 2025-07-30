"use client";

import { useEffect, useState, useContext } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import {
  UserCheck,
  CalendarDays,
  Clock,
  Trash2,
  XCircle,
  CheckCircle2,
  ChevronLeft,
  Home,
  CheckCircle,
} from "lucide-react";

interface Booking {
  id: number;
  date: string;
  therapist: string;
  time_slot: string;
  status: string;
}

export default function BookingHistoryPage() {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);

  useEffect(() => {
    if (!user) return router.push("/login");
    const phone = user.phone ?? "";
    if (!phone) return alert("ไม่พบเบอร์โทรของผู้ใช้");

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/my-bookings?phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        if (data.success) {
          const sorted = data.bookings.sort((a: Booking, b: Booking) => b.id - a.id);
          setBookings(sorted);
        }
      } catch (err) {
        console.error("Failed to fetch booking history:", err);
      }
    };
    fetchHistory();
  }, [user, router]);

  function getBookingStatus(booking: Booking): string {
    if (booking.status === "ยกเลิก") return "ยกเลิก";

    const now = new Date();
    const [startStr, endStr] = booking.time_slot.split("-");
    const [startHour, startMin = "00"] = startStr.split(".");
    const [endHour, endMin = "00"] = endStr.split(".");

    const startTime = new Date(booking.date);
    startTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);

    const endTime = new Date(booking.date);
    endTime.setHours(parseInt(endHour), parseInt(endMin), 0, 0);

    if (now < startTime) return "รอดำเนินการ";
    if (now >= startTime && now < endTime) return "อยู่ในคิว";
    return "สำเร็จ";
  }

  const confirmCancelBooking = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/delete-booking?id=${selectedId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        const updated = bookings.map((b) =>
          b.id === selectedId ? { ...b, status: "ยกเลิก" } : b
        );
        setBookings(updated);
        setOpen(false);
        setSelectedId(null);
        setShowCancelSuccess(true);
        setTimeout(() => setShowCancelSuccess(false), 3000);
      } else {
        alert("เกิดข้อผิดพลาดในการยกเลิก");
      }
    } catch (err) {
      alert("ไม่สามารถยกเลิกการจองได้");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen px-6 py-12 bg-gradient-to-br from-white to-emerald-50 relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.back()}
        className="absolute top-6 left-6 flex items-center space-x-2 px-5 py-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700 transition z-10"
      >
        <ChevronLeft className="w-5 h-5" />
        <span>ย้อนกลับ</span>
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.push("/")}
        className="absolute top-6 right-6 flex items-center space-x-2 px-5 py-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700 transition z-10"
      >
        <Home className="w-5 h-5" />
        <span>หน้าแรก</span>
      </motion.button>

      <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-700 mb-10 text-center drop-shadow-sm">
        ประวัติการจองของคุณ
      </h1>

      {bookings.length === 0 ? (
        <p className="text-center text-gray-500 italic select-none">ยังไม่มีประวัติการจอง</p>
      ) : (
        <ul className="space-y-6 mx-auto" style={{ maxWidth: "61.5rem" }}>
          {bookings.map((b) => {
            const status = getBookingStatus(b);

            return (
              <li
                key={b.id}
                className={`bg-white border-l-8 rounded-xl shadow-md p-6 hover:shadow-lg transition flex items-center justify-between ${
                  status === "ยกเลิก"
                    ? "border-red-500"
                    : status === "สำเร็จ"
                    ? "border-emerald-500"
                    : status === "อยู่ในคิว"
                    ? "border-orange-500"
                    : "border-gray-500"
                }`}
              >
                <div className="grid grid-cols-[150px_150px_150px_150px] gap-x-6 text-gray-700 flex-grow">
                  <Label icon={<CalendarDays className="w-4 h-4" />} text="วันที่" />
                  <Label icon={<UserCheck className="w-4 h-4" />} text="ผู้ให้บริการ" />
                  <Label icon={<Clock className="w-4 h-4" />} text="ช่วงเวลา" />
                  <Label icon={<CheckCircle className="w-4 h-4" />} text="สถานะ" />

                  <span className="font-normal text-base">
                    {new Date(b.date).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      timeZone: "Asia/Bangkok",
                    })}
                  </span>
                  <span className="font-normal text-base">{b.therapist}</span>
                  <span className="font-normal text-base">{b.time_slot}</span>
                  <span
                    className={`font-bold text-base ${
                      status === "ยกเลิก"
                        ? "text-red-600"
                        : status === "สำเร็จ"
                        ? "text-emerald-600"
                        : status === "อยู่ในคิว"
                        ? "text-orange-600"
                        : "text-gray-600"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                <div className="flex-shrink-0 ml-6">
                  {["สำเร็จ", "ยกเลิก", "อยู่ในคิว"].includes(status) ? (
                    <button
                      disabled
                      className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-600 rounded-md font-semibold cursor-not-allowed"
                      title={
                        status === "สำเร็จ"
                          ? "หมดเวลาแล้ว ไม่สามารถยกเลิกได้"
                          : status === "ยกเลิก"
                          ? "ยกเลิกแล้ว"
                          : "อยู่ในคิว ไม่สามารถยกเลิกได้"
                      }
                    >
                      {status === "สำเร็จ"
                        ? "⏰ หมดเวลา"
                        : status === "ยกเลิก"
                        ? "✔️ ยกเลิกแล้ว"
                        : "⌛ อยู่ในคิว"}
                    </button>
                  ) : (
                    <Dialog.Root open={open && selectedId === b.id} onOpenChange={setOpen}>
                      <Dialog.Trigger asChild>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setSelectedId(b.id);
                            setOpen(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md font-semibold shadow hover:bg-red-700 transition"
                        >
                          <Trash2 className="w-5 h-5" />
                          ยกเลิก
                        </motion.button>
                      </Dialog.Trigger>

                      <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
                        <Dialog.Content asChild>
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.3 }}
                            className="fixed z-50 left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg"
                          >
                            <div className="flex items-start gap-3">
                              <XCircle className="w-8 h-8 text-red-500 mt-1" />
                              <div className="flex-1">
                                <Dialog.Title className="text-lg font-bold text-red-700 mb-1">
                                  ยืนยันการยกเลิก
                                </Dialog.Title>
                                <Dialog.Description className="text-gray-600">
                                  คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองนี้?
                                </Dialog.Description>
                                <div className="flex justify-end gap-3 mt-5">
                                  <Dialog.Close asChild>
                                    <button className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition">
                                      ยกเลิก
                                    </button>
                                  </Dialog.Close>
                                  <button
                                    onClick={confirmCancelBooking}
                                    className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 transition font-semibold"
                                  >
                                    ยืนยัน
                                  </button>
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
            );
          })}
        </ul>
      )}

      <AnimatePresence>
        {showCancelSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.4 }}
            className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-white border border-emerald-400 rounded-xl shadow-lg px-10 py-8 flex flex-col items-center gap-4"
          >
            <CheckCircle2 className="w-16 h-16 text-emerald-600" />
            <p className="text-xl font-semibold text-emerald-700">ยกเลิกการจองสำเร็จ</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Label({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1 font-semibold text-emerald-700">
      {icon}
      <span>{text}:</span>
    </div>
  );
}
