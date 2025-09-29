"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, LabelList } from "recharts";
import { FaHistory, FaCheckCircle, FaClock, FaSpa, FaTimesCircle } from "react-icons/fa";

type Booking = {
  id: number;
  therapist: string;
  status: string;
  date: string;
};

export default function SummaryHistoryPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [therapists, setTherapists] = useState<string[]>([]);
  const [filtered, setFiltered] = useState<Booking[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [months, setMonths] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | "all">("all");
  const [dayRange, setDayRange] = useState<"all" | "1-15" | "16-31">("all");
  const [statusFilter, setStatusFilter] = useState<"success" | "pending" | "cancelled">("success");
  const buddhistYear = (y: number) => y + 543;
  const monthNames = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

  // โหลด bookings
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/all-bookings");
        const data = await res.json();
        if (data.success) {
          setBookings(data.bookings);

          const yearSet = new Set<number>();
          data.bookings.forEach((b: Booking) => yearSet.add(new Date(b.date).getFullYear()));
          const yearArr = Array.from(yearSet).sort((a, b) => a - b);
          setYears(yearArr);
          if (yearArr.length > 0) setYear(yearArr[yearArr.length - 1]);
        }
      } catch (e) {
        console.error("โหลดข้อมูล bookings ล้มเหลว", e);
      }
    })();
  }, []);

  // โหลด therapists
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/therapists");
        const data = await res.json();
        if (data.success) setTherapists(data.therapists);
      } catch (e) {
        console.error("โหลดข้อมูล therapists ล้มเหลว", e);
      }
    })();
  }, []);

  // Filter bookings ตามปี+เดือน+วัน
  useEffect(() => {
    if (!year) return;
    const f = bookings.filter(b => {
      const d = new Date(b.date);
      const y = d.getFullYear();
      const m = d.getMonth();
      const day = d.getDate();
      if (y !== year) return false;
      if (month !== "all" && m !== month) return false;
      if (dayRange === "1-15" && day > 15) return false;
      if (dayRange === "16-31" && day <= 15) return false;
      return true;
    });
    setFiltered(f);
    setMonths(Array.from({ length: 12 }, (_, i) => i));
  }, [bookings, year, month, dayRange]);

  // Summary รายเดือน
  const monthlySummary = Array.from({ length: 12 }).map((_, idx) => {
    const monthBookings = filtered.filter(b => new Date(b.date).getMonth() === idx);
    return {
      month: monthNames[idx],
      สำเร็จ: monthBookings.filter(b => b.status === "สำเร็จ").length,
      รอดำเนินการ: monthBookings.filter(b => b.status === "รอดำเนินการ").length,
      ยกเลิก: monthBookings.filter(b => b.status === "ยกเลิก").length,
      total: monthBookings.length,
    };
  });

  // Summary ตามหมอนวด
  const therapistSummary: Record<string, { success: number; pending: number; cancelled: number }> = {};
  therapists.forEach(name => therapistSummary[name] = { success: 0, pending: 0, cancelled: 0 });
  filtered.forEach(b => {
    if (!therapists.includes(b.therapist)) return;
    if (!therapistSummary[b.therapist]) therapistSummary[b.therapist] = { success: 0, pending: 0, cancelled: 0 };
    if (b.status === "สำเร็จ") therapistSummary[b.therapist].success += 1;
    if (b.status === "รอดำเนินการ") therapistSummary[b.therapist].pending += 1;
    if (b.status === "ยกเลิก") therapistSummary[b.therapist].cancelled += 1;
  });

  const therapistChartData = Object.entries(therapistSummary).map(([name, counts]) => ({
    name,
    สำเร็จ: counts.success,
    รอดำเนินการ: counts.pending,
    ยกเลิก: counts.cancelled,
  }));

  return (
    <div className="min-h-screen bg-gray-50 pt-28">
      {/* Navbar */}
      <div className="fixed top-0 left-0 w-full z-50 bg-gradient-to-r from-emerald-600 to-green-500 shadow-md flex justify-between items-center px-4 py-2">
        <div className="text-white font-bold text-lg flex items-center gap-2 cursor-pointer" onClick={() => router.push("/")}>
          <FaSpa /> แพทย์แผนไทย
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/all-bookings")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-gray-200 text-emerald-700 font-semibold shadow transition"
          >
            <FaHistory className="w-5 h-6" />
          </button>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-emerald-800 mb-6 text-center">
        📊 Dashboard สรุปประวัติ
      </h1>

      {/* Dropdown สำหรับกราฟ/summary */}
      <div className="flex gap-4 mb-6 justify-center flex-wrap">
        {years.length > 0 && (
          <select className="border border-emerald-400 rounded px-3 py-2 bg-white text-emerald-800 shadow-sm" value={year ?? ""} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>พ.ศ. {buddhistYear(y)}</option>)}
          </select>
        )}
        {months.length > 0 && (
          <select className="border border-emerald-400 rounded px-3 py-2 bg-white text-emerald-800 shadow-sm" value={month} onChange={e => setMonth(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="all">ทั้งปี</option>
            {months.map(m => <option key={m} value={m}>{monthNames[m]}</option>)}
          </select>
        )}
        <select className="border border-emerald-400 rounded px-3 py-2 bg-white text-emerald-800 shadow-sm" value={dayRange} onChange={e => setDayRange(e.target.value as "all" | "1-15" | "16-31")}>
          <option value="all">ทั้งเดือน</option>
          <option value="1-15">วันที่ 1-15</option>
          <option value="16-31">วันที่ 16-31</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 max-w-6xl mx-auto px-4">
        <div className="bg-white shadow rounded-lg p-4 text-center border-l-4 border-green-800">
          <div className="text-gray-600 font-semibold">ทั้งหมด</div>
          <div className="text-3xl font-bold text-green-800">{filtered.length}</div>
        </div>
        <div className="bg-white shadow rounded-lg p-4 text-center border-l-4 border-green-400">
          <div className="flex justify-center items-center gap-1 text-gray-600 font-semibold"><FaCheckCircle className="text-green-500" /> สำเร็จ</div>
          <div className="text-3xl font-bold text-green-500">{filtered.filter(b => b.status === "สำเร็จ").length}</div>
        </div>
        <div className="bg-white shadow rounded-lg p-4 text-center border-l-4 border-gray-400">
          <div className="flex justify-center items-center gap-1 text-gray-600 font-semibold"><FaClock className="text-gray-500" /> รอดำเนินการ</div>
          <div className="text-3xl font-bold text-gray-500">{filtered.filter(b => b.status === "รอดำเนินการ").length}</div>
        </div>
        <div className="bg-white shadow rounded-lg p-4 text-center border-l-4 border-red-400">
          <div className="flex justify-center items-center gap-1 text-gray-600 font-semibold"><FaTimesCircle className="text-red-600" /> ยกเลิก</div>
          <div className="text-3xl font-bold text-red-600">{filtered.filter(b => b.status === "ยกเลิก").length}</div>
        </div>
      </div>

      {/* BarChart รายเดือน */}
      <div className="bg-white shadow rounded-lg p-4 mb-8 max-w-6xl mx-auto px-4">
        <h2 className="text-xl font-semibold text-emerald-700 mb-4 text-center">จำนวนการจองต่อเดือน</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlySummary}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => [`${value} ครั้ง`]} labelFormatter={(label) => `เดือน ${label}`} />
            <Legend />
            <Bar dataKey="สำเร็จ" stackId="a" fill="#22C55E" />
            <Bar dataKey="รอดำเนินการ" stackId="a" fill="#6B7280" />
            <Bar dataKey="ยกเลิก" stackId="a" fill="#EF4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* BarChart ตามหมอนวด */}
      <div className="bg-white shadow rounded-lg p-4 max-w-6xl mx-auto mt-8 px-4">
        <h2 className="text-xl font-semibold text-emerald-700 mb-4 text-center">จำนวนการจองต่อคน</h2>
        <ResponsiveContainer width="100%" height={Math.max(50 * therapistChartData.length, 300)}>
          <BarChart
            layout="vertical"
            data={therapistChartData.sort(
              (a, b) => (b.สำเร็จ + b.รอดำเนินการ + b.ยกเลิก) - (a.สำเร็จ + a.รอดำเนินการ + a.ยกเลิก)
            )}
            margin={{ top: 20, right: 120, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={200} />
            <Tooltip />
            <Legend />
            <Bar dataKey="สำเร็จ" stackId="b" fill="#22C55E" />
            <Bar dataKey="รอดำเนินการ" stackId="b" fill="#6B7280" />
            <Bar dataKey="ยกเลิก" stackId="b" fill="#EF4444">
              <LabelList dataKey={(d: any) => d.สำเร็จ + d.รอดำเนินการ + d.ยกเลิก} position="right" formatter={(v) => (v === 0 ? "" : v)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* รายละเอียดหมอนวด */}
        <div className="mt-4 max-w-6xl mx-auto">
          <h3 className="text-lg font-semibold text-emerald-700 mb-2 text-center">จำนวนครั้งสถานะทั้งหมดต่อคน</h3>
          {/* Dropdown เลือกสถานะ */}
          <div className="flex justify-center mb-4">
            <select
              className="border border-emerald-400 rounded px-3 py-2 bg-white text-emerald-800 shadow-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "success" | "pending" | "cancelled")}
            >
              <option value="success">สำเร็จ</option>
              <option value="pending">รอดำเนินการ</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(therapistSummary).map(([name, counts]) => (
              <div key={name} className="bg-white rounded shadow p-3 flex justify-between items-center">
                <span className="font-medium text-gray-600">{name}</span>
                <span className={`font-bold ${
                  statusFilter === "success" ? "text-green-600" :
                  statusFilter === "pending" ? "text-gray-600" :
                  "text-red-600"
                }`}>
                  {statusFilter === "success" ? counts.success :
                  statusFilter === "pending" ? counts.pending :
                  counts.cancelled} ครั้ง
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
