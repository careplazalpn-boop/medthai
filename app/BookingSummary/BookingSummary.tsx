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

  const StatusBox = ({
    label,
    count,
    percent,
    color,
    Icon,
  }: {
    label: string;
    count: number;
    percent: number;
    color: string;
    Icon: any;
  }) => (
    <div className={`flex items-center gap-3 bg-${color}-50 text-${color}-900 rounded-xl p-3 shadow-sm border-2 border-${color}-200 flex-1 min-w-[150px]`}>
      <Icon className={`w-8 h-8 text-${color}-500 flex-shrink-0`} />
      <div className="flex flex-col flex-grow">
        <div className="flex justify-between items-baseline gap-2">
          <span className={`text-sm text-${color}-700`}>{label} :</span>
          <span className="text-sm font-bold">{count} คน</span>
        </div>
        <div className={`w-full h-3 bg-${color}-200 rounded-full mt-1 relative overflow-hidden`}>
          <motion.div
            className={`h-full bg-${color}-600 rounded-full`}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 1 }}
          />
          <div className="absolute inset-0 flex justify-center items-center text-white font-semibold text-xs">
            {percent}%
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* แสดง status boxes อยู่บรรทัดเดียวกัน */}
      <div className="flex flex-wrap gap-4">
        <StatusBox label="สำเร็จ" count={totalAttended} percent={attendedPercent} color="emerald" Icon={Smile} />
        <StatusBox label="ยกเลิก" count={totalCancelled} percent={cancelledPercent} color="red" Icon={Frown} />
        <StatusBox label="รอดำเนินการ" count={totalPending} percent={pendingPercent} color="yellow" Icon={UserCheck} />
        <StatusBox label="อยู่ในคิว" count={totalInQueue} percent={inQueuePercent} color="orange" Icon={Clock} />
      </div>

      {/* แสดงสถิติรวม */}
      <div className="mt-2 text-sm text-gray-700 font-semibold">
        รวมทั้งหมด: {total} คน
      </div>
    </div>
  );
}
