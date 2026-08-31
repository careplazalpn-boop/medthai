"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FaFileExcel,
} from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";

interface TherapistRow {
  name: string; // bookings.therapist เก็บเป็นชื่อข้อความ ไม่มี id แยก
  counts: Record<string, number>; // key = YYYY-MM-DD
  total: number;
}

interface SummaryResponse {
  start: string;
  end: string;
  dates: string[];
  therapists: TherapistRow[];
  dailyTotals: Record<string, number>;
  grandTotal: number;
  error?: string;
}

// แปลง Date -> "YYYY-MM-DD" ตามเวลาท้องถิ่นของเบราว์เซอร์ (ไม่ผ่าน UTC เหมือน toISOString)
function toLocalISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// วันที่ default: 7 วันล่าสุด (รวมวันนี้)
function defaultRange() {
  const today = new Date();
  const end = toLocalISODate(today);
  const startD = new Date(today);
  startD.setDate(startD.getDate() - 6);
  const start = toLocalISODate(startD);
  return { start, end };
}

// แปลง YYYY-MM-DD -> "20 ส.ค."
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
function formatThaiDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${THAI_MONTHS_SHORT[m - 1]}`;
}

export default function SummaryTherapistsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const { start: defStart, end: defEnd } = defaultRange();
  const [startDate, setStartDate] = useState(defStart);
  const [endDate, setEndDate] = useState(defEnd);

  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  const fetchSummary = async () => {
    if (!startDate || !endDate) {
      alert("กรุณาเลือกช่วงวันที่ให้ครบ");
      return;
    }
    if (startDate > endDate) {
      alert("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/summary-therapists?start=${startDate}&end=${endDate}`
      );
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "เกิดข้อผิดพลาด");
        setData(null);
      } else {
        setData(json);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // โหลดสรุปช่วง default ตอนเปิดหน้าครั้งแรก
  useEffect(() => {
    if (user) fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ---------------- Export Excel ----------------
  const handleExportExcel = async () => {
    if (!data || data.therapists.length === 0) {
      alert("ไม่มีข้อมูลสำหรับ export");
      return;
    }
    // โหลด xlsx แบบ dynamic import (ต้องติดตั้งก่อน: npm install xlsx)
    const XLSX = await import("xlsx");

    const header = [
      "ลำดับ",
      "ชื่อผู้ให้บริการ",
      ...data.dates.map((d) => formatThaiDate(d)),
      "รวม",
    ];

    const rows = data.therapists.map((t, idx) => [
      idx + 1,
      t.name,
      ...data.dates.map((d) => t.counts[d] || 0),
      t.total,
    ]);

    const totalRow = [
      "",
      "รวมทั้งหมด",
      ...data.dates.map((d) => data.dailyTotals[d] || 0),
      data.grandTotal,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows, totalRow]);
    // ปรับความกว้างคอลัมน์คร่าวๆ
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 28 },
      ...data.dates.map(() => ({ wch: 10 })),
      { wch: 10 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "สรุปรายงาน");
    XLSX.writeFile(
      workbook,
      `สรุปรายงานผู้ให้บริการ_${startDate}_ถึง_${endDate}.xlsx`
    );
  };

  const hasData = useMemo(
    () => !!data && data.therapists.length > 0,
    [data]
  );

  if (!user) {
    return <p>กำลังตรวจสอบสิทธิ์...</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-emerald-700">
      {/* เนื้อหา */}
      <div className="max-w-6xl mx-auto p-6 pt-27">
        <h1 className="text-4xl font-extrabold text-emerald-700 mb-8 text-center drop-shadow-sm">
          สรุปรายงานการปฏิบัติงาน
        </h1>

        {/* ตัวกรองช่วงวันที่ */}
        <div className="bg-white rounded-xl shadow p-4 mb-8 flex flex-wrap items-end gap-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-600">
              วันที่เริ่มต้น
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 px-3 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-600">
              ถึงวันที่
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 px-3 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={fetchSummary}
            disabled={loading}
            className="h-10 px-6 bg-emerald-600 text-white rounded-md font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {loading ? "กำลังโหลด..." : "ค้นหา"}
          </button>

          <button
            onClick={handleExportExcel}
            disabled={!hasData}
            className="h-10 px-6 bg-green-700 text-white rounded-md font-semibold hover:bg-green-800 transition disabled:opacity-40 flex items-center gap-2"
          >
            <FaFileExcel />
            Export Excel
          </button>
        </div>

        {errorMsg && (
          <p className="text-center text-red-600 font-medium mb-4">
            {errorMsg}
          </p>
        )}

        {loading ? (
          <p className="text-center text-gray-500">กำลังโหลดข้อมูล...</p>
        ) : !hasData ? (
          <p className="text-center text-gray-500 italic">
            ไม่พบข้อมูลในช่วงวันที่ที่เลือก
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg shadow bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-emerald-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-medium sticky left-0 bg-emerald-600">
                    ลำดับ
                  </th>
                  <th className="px-4 py-3 text-left font-medium sticky left-12 bg-emerald-600">
                    ชื่อผู้ให้บริการ
                  </th>
                  {data!.dates.map((d) => (
                    <th key={d} className="px-4 py-3 text-center font-medium whitespace-nowrap">
                      {formatThaiDate(d)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-medium">รวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data!.therapists.map((t, idx) => (
                  <tr
                    key={t.name}
                    className={idx % 2 === 0 ? "bg-white" : "bg-emerald-50/50"}
                  >
                    <td className="px-4 py-2">{idx + 1}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{t.name}</td>
                    {data!.dates.map((d) => (
                      <td key={d} className="px-4 py-2 text-center">
                        {t.counts[d] ?? 0}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-center font-semibold">
                      {t.total}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-100 font-bold text-emerald-800">
                  <td className="px-4 py-3" colSpan={2}>
                    รวมทั้งหมด
                  </td>
                  {data!.dates.map((d) => (
                    <td key={d} className="px-4 py-3 text-center">
                      {data!.dailyTotals[d] ?? 0}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    {data!.grandTotal}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
