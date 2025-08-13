"use client";

import { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "@/context/AuthContext";
import {
  CalendarIcon,
  UserIcon,
  Clock,
  Home,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { FaHistory } from "react-icons/fa";

const therapists = [
  "นายโอภาส ทาแก้ว",
  "นางสาววรรณนิสา เนตรษุ",
  "นางสาวเพ็ญนภา นุ่มนวล",
  "นางสาววรานันทน์ ยอดลิลา",
  "นางสาวเรนุกา เขียววงศ์ตัน",
  "นางสาวอารยา  พิหก",
  "นางสาวกานต์พิชา จุมป๋าน้ำ",
  "นางสาวธิดารัตน์ ใจชื้น",
  "นางสาวภัทรวดี จันทร์น้อย",
  "นายนฤเทพ แสงสุวรรณ",
];

const timeSlots = [
  "8.00-9.30",
  "9.30-11.00",
  "11.00-12.30",
  "13.00-14.30",
  "14.30-16.00",
  "16.00-17.30",
];

// Popup แจ้งว่าจองไปแล้ว
function BookedPopup({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-black z-40"
        onClick={onClose}
      />
      <motion.div
        key="popup"
        initial={{ opacity: 0, scale: 0.8, y: -50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -50 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-sm w-full bg-gradient-to-tr from-emerald-50 to-white rounded-2xl p-8 shadow-2xl border border-emerald-300 flex flex-col items-center"
      >
        <CheckCircle2 className="text-emerald-500 w-16 h-16 mb-4 animate-pulse" />
        <h3 className="text-2xl font-extrabold text-emerald-700 mb-2 select-none">
          คุณได้จองคิวไปแล้ว
        </h3>
        <p className="text-center text-emerald-600 mb-6 max-w-xs">
          ขอขอบคุณที่ใช้บริการ สามารถตรวจสอบสถานะการจองของคุณได้ที่ประวัติการจอง
        </p>
        <motion.button
          onClick={onClose}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-full px-8 py-3 font-semibold shadow-md transition-shadow select-none"
        >
          ปิด
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}

export default function BookingPage() {
  const router = useRouter();
  const { user } = useContext(AuthContext);

  const [date, setDate] = useState("");
  const [selectedTherapist, setSelectedTherapist] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({});
  const [showAlert, setShowAlert] = useState(false);
  const [hasReservation, setHasReservation] = useState(false);
  const [loadingReservation, setLoadingReservation] = useState(true);
  const [showBookedPopup, setShowBookedPopup] = useState(false);

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    async function checkReservation() {
      if (!user?.phone) {
        setHasReservation(false);
        setLoadingReservation(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/check-reservation-status?phone=${encodeURIComponent(user.phone)}`
        );
        const data = await res.json();
        setHasReservation(data.success ? data.hasActiveBooking : false);
      } catch {
        setHasReservation(false);
      } finally {
        setLoadingReservation(false);
      }
    }
    checkReservation();
  }, [user]);

  useEffect(() => {
    if (!date) {
      setBookedSlots({});
      setSelectedTherapist("");
      setSelectedTime("");
      return;
    }

    async function fetchBooked() {
      try {
        const res = await fetch(`/api/bookings?date=${encodeURIComponent(date)}`);
        const data = await res.json();
        if (data.success) {
          const grouped: Record<string, string[]> = {};
          data.bookings.forEach((b: any) => {
            if (!grouped[b.therapist]) grouped[b.therapist] = [];
            grouped[b.therapist].push(b.time_slot);
          });
          setBookedSlots(grouped);
        } else {
          setBookedSlots({});
        }
      } catch {
        setBookedSlots({});
      }
      setSelectedTherapist("");
      setSelectedTime("");
    }

    fetchBooked();
  }, [date]);

  useEffect(() => {
    if (showAlert) {
      const timer = setTimeout(() => setShowAlert(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showAlert]);

  function isTimeSlotPast(slot: string): boolean {
    if (!date) return false;

    const [startStr] = slot.split("-");
    const [hourStr, minuteStr] = startStr.split(".");
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr.padEnd(2, "0"), 10);

    const now = new Date();
    const selectedDate = new Date(date);
    selectedDate.setHours(hour, minute, 0, 0);

    return now > selectedDate && now.toDateString() === selectedDate.toDateString();
  }

  const handleSelect = (therapist: string, time: string) => {
    if (!date) {
      setShowAlert(true);
      return;
    }
    if (hasReservation) {
      setShowBookedPopup(true);
      return;
    }
    setSelectedTherapist(therapist);
    setSelectedTime(time);
  };

  const handleSubmit = (therapist: string) => {
    if (loadingReservation) {
      alert("กำลังตรวจสอบสถานะการจอง กรุณารอสักครู่...");
      return;
    }
    if (hasReservation) {
      alert("คุณมีการจองที่ยังไม่เสร็จสิ้น ไม่สามารถจองเพิ่มได้");
      return;
    }
    if (!user || !date || !therapist || selectedTherapist !== therapist || !selectedTime) {
      alert("กรุณาเลือกวันที่ หมอ และช่วงเวลาก่อนจอง");
      return;
    }
    const params = new URLSearchParams();
    params.append("name", user.name);
    params.append("phone", user.phone ?? "");
    params.append("date", date);
    params.append("therapist", therapist);
    params.append("time", selectedTime);

    router.push(`/confirm?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-emerald-100 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.15 }}
        transition={{ duration: 2 }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_#a7f3d0,_transparent_70%)]"
      />

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.push("/")}
        className="absolute top-6 left-6 flex items-center space-x-2 px-5 py-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700 transition z-10"
      >
        <Home className="w-5 h-5" />
        <span>หน้าแรก</span>
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => router.push("/booking-history")}
        className="absolute top-6 right-6 flex items-center space-x-2 px-5 py-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700 transition z-10"
      >
        <FaHistory />
        <span>ประวัติการจอง</span>
      </motion.button>

      <div className="max-w-6xl mx-auto p-6 pt-20 relative z-10">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl font-bold text-center mb-6 text-emerald-700"
        >
          จองคิวนวดแผนไทย
        </motion.h1>

        <div className="mb-8 max-w-sm mx-auto relative">
          <label className="block mb-2 font-medium text-gray-700 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            วันที่ต้องการนวด
          </label>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setDate(e.target.value)}
            className={`border border-gray-300 rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-emerald-400 transition ${
              !date ? "text-gray-400" : "text-gray-900"
            }`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {therapists.map((t) => {
            const booked = bookedSlots[t] || [];
            const isSelected = selectedTherapist === t;

            return (
              <motion.div
                key={t}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`border p-5 rounded-2xl bg-white shadow-lg flex flex-col justify-between ${
                  isSelected ? "ring-4 ring-emerald-300" : ""
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <UserIcon className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-lg font-semibold text-emerald-700">{t}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {timeSlots.map((slot) => {
                      const isBooked = booked.includes(slot);
                      const isPast = isTimeSlotPast(slot);
                      const isActive = isSelected && selectedTime === slot;

                      return (
                        <button
                          key={slot}
                          disabled={isBooked || isPast}
                          onClick={() => handleSelect(t, slot)}
                          className={`relative text-sm px-3 py-2 rounded-lg font-medium border transition shadow-sm flex items-center justify-center gap-1
                            ${
                              isBooked
                                ? "bg-red-100 text-red-600 border-red-400 cursor-not-allowed"
                                : isPast
                                ? "bg-yellow-100 text-yellow-700 border-yellow-400 cursor-not-allowed"
                                : isActive
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white hover:bg-emerald-50 text-emerald-800 border-gray-300"
                            }`}
                        >
                          <Clock
                            className={`w-4 h-4 ${
                              isBooked
                                ? "text-red-600"
                                : isPast
                                ? "text-yellow-700"
                                : isActive
                                ? "text-white"
                                : "text-emerald-700"
                            }`}
                          />
                          <span>{slot}</span>
                          {(isBooked || isPast) && (
                            <span className="text-xs font-semibold">
                              ({isBooked ? "ถูกจองแล้ว" : "หมดเวลาจอง"})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSubmit(t)}
                  disabled={!(isSelected && selectedTime && date) || hasReservation}
                  className={`mt-5 w-full py-2 rounded-xl font-bold shadow transition text-center
                    ${
                      isSelected && selectedTime && date && !hasReservation
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                >
                  เลือก
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        {showBookedPopup && <BookedPopup onClose={() => setShowBookedPopup(false)} />}

        <AnimatePresence>
          {showAlert && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 bg-yellow-50 border border-yellow-400 text-yellow-700 px-6 py-4 rounded-lg flex items-center gap-3 shadow-lg max-w-md z-50"
            >
              <AlertCircle className="w-6 h-6" />
              <span>กรุณาเลือกวันที่ก่อนจองคิว</span>
              <button
                onClick={() => setShowAlert(false)}
                className="ml-auto text-yellow-700 font-bold hover:text-yellow-900"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
