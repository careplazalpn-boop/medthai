"use client";

import { motion } from "framer-motion";
import { Smile, Frown, UserCheck, Clock } from "lucide-react";

interface BookingSummaryProps {
  summary?: {
    totalAttended: number;
    totalCancelled: number;
    totalPending?: number;
    totalInQueue?: number;
  };
}

export default function BookingSummary({
  summary = { totalAttended: 0, totalCancelled: 0, totalPending: 0, totalInQueue: 0 },
}: BookingSummaryProps) {
  const { totalAttended, totalCancelled, totalPending = 0, totalInQueue = 0 } = summary;
  const total = totalAttended + totalCancelled + totalPending + totalInQueue;

  const attendedPercent = total ? Math.round((totalAttended / total) * 100) : 0;
  const cancelledPercent = total ? Math.round((totalCancelled / total) * 100) : 0;
  const pendingPercent = total ? Math.round((totalPending / total) * 100) : 0;
  const inQueuePercent = total ? Math.round((totalInQueue / total) * 100) : 0;

  // ✅ Map สีแบบ static ให้ Tailwind generate
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-600 text-emerald-700 border-emerald-200",
    red: "bg-red-600 text-red-700 border-red-200",
    yellow: "bg-yellow-600 text-yellow-700 border-yellow-200",
    orange: "bg-orange-600 text-orange-700 border-orange-200",
  };

  const StatusBox = ({
    label,
    count,
    percent,
    colorKey,
    Icon,
  }: {
    label: string;
    count: number;
    percent: number;
    colorKey: keyof typeof colorMap;
    Icon: any;
  }) => {
    const color = colorMap[colorKey];

    return (
      <div
        className={`flex items-center gap-3 bg-white rounded-xl p-3 shadow-md border-2 ${color.split(" ")[2]} flex-1 min-w-[180px]`}
      >
        <Icon className={`w-8 h-8 ${color.split(" ")[1]} flex-shrink-0`} />
        <div className="flex flex-col flex-grow">
          <div className="flex justify-between items-baseline gap-2">
            <span className={`text-sm ${color.split(" ")[1]} font-semibold`}>{label}:</span>
            <span className="text-sm font-bold text-gray-800">{count} คน</span>
          </div>
          <div className="w-full h-4 bg-gray-400 rounded-full mt-2 relative overflow-hidden">
            <motion.div
              className={`h-full ${color.split(" ")[0]} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 1 }}
            />
            <div className="absolute inset-0 flex justify-center items-center text-white font-semibold text-xs drop-shadow-sm">
              {percent}%
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4">
        <StatusBox label="สำเร็จ" count={totalAttended} percent={attendedPercent} colorKey="emerald" Icon={Smile} />
        <StatusBox label="ยกเลิก" count={totalCancelled} percent={cancelledPercent} colorKey="red" Icon={Frown} />
        <StatusBox label="รอดำเนินการ" count={totalPending} percent={pendingPercent} colorKey="yellow" Icon={UserCheck} />
        <StatusBox label="อยู่ในคิว" count={totalInQueue} percent={inQueuePercent} colorKey="orange" Icon={Clock} />
      </div>

      <div className="mt-2 text-sm text-gray-700 font-semibold">
        รวมทั้งหมด: {total} คน
      </div>
      
    </div>
  );
}
