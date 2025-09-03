"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useContext } from "react";
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Home, User, Phone, Calendar, UserCheck, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { AuthContext } from "@/context/AuthContext";

export default function ConfirmPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useContext(AuthContext);

  const hn = params.get("hn");
  const name = params.get("name");
  const phone = params.get("phone");
  const date = params.get("date");
  const therapist = params.get("therapist");
  const time = params.get("time");
  const provider = params.get("provider"); // ✅ เพิ่มรับค่า provider

  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!hn || !name || !phone || !date || !therapist || !time) {
      router.push(isAdmin ? "/admin-booking" : "/booking");
    }
  }, [hn, name, phone, date, therapist, time, router, isAdmin]);

  const handleConfirm = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hn, name, phone, date, therapist, time, provider }), // ✅ ส่ง provider ด้วย
      });
      const data = await res.json();
      if (data.success) setSuccess(true);
      else setErrorMsg(data.error || "ผิดพลาดไม่ทราบสาเหตุ");
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดจากระบบ");
    } finally {
      setLoading(false);
    }
  };

  const backPage = () => router.push(isAdmin ? "/admin-booking" : "/booking");

  const InfoItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null }) => (
    <li className="flex items-center gap-3">
      <Icon className="text-emerald-600 w-5 h-5" />
      <span className="font-semibold text-emerald-600 min-w-[120px]">{label}</span>
      {value}
    </li>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-emerald-50 flex items-center justify-center p-6">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }} className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-emerald-200">
        <h2 className="text-3xl font-extrabold text-emerald-700 mb-6 tracking-wide">ข้อมูลการจองผู้รับบริการ</h2>

        <ul className="text-gray-700 space-y-4 mb-8 text-left">
          <InfoItem icon={UserCheck} label="ผู้ให้บริการ:" value={provider} /> {/* ✅ เพิ่มตรงนี้ */}
          <InfoItem icon={User} label="HN:" value={hn} />
          <InfoItem icon={User} label="ชื่อ-นามสกุล:" value={name} />
          <InfoItem icon={Phone} label="เบอร์โทร:" value={phone} />
          <InfoItem icon={Calendar} label="วันที่จอง:" value={date} />
          <InfoItem icon={UserCheck} label="ผู้บริการ:" value={therapist} />
          <InfoItem icon={Clock} label="ช่วงเวลา:" value={time} />
        </ul>

        {success ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col items-center gap-6 text-emerald-700">
            <CheckCircle2 className="w-12 h-12" />
            <p className="text-2xl font-semibold">จองสำเร็จแล้ว</p>
            <div className="flex gap-4 mt-6">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={backPage} className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg font-semibold shadow-sm hover:bg-emerald-200">
                <ArrowLeft className="w-5 h-5" /> กลับหน้าจองคิว
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => router.push("/")} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold shadow-sm hover:bg-emerald-700">
                <Home className="w-5 h-5" /> กลับหน้าหลัก
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <>
            {errorMsg && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="mb-6 flex items-center justify-center gap-2 text-red-600 font-semibold">
                <XCircle className="w-6 h-6" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            <div className="flex gap-4 justify-center">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={backPage} className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-emerald-800 bg-emerald-100 shadow-sm hover:bg-emerald-200">
                <ArrowLeft className="w-5 h-5" /> กลับหน้าจองคิว
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleConfirm} disabled={loading} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white shadow-sm transition ${loading ? "bg-emerald-300 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-5 h-5" /> กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" /> ยืนยันการจอง
                  </>
                )}
              </motion.button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
