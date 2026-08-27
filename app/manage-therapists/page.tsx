"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  UserPlus,
  Search,
  X,
  Menu,
  LogOut,
  LogIn,
  Sparkles,
  Calendar,
  ClipboardList,
  BedDouble,
  History,
  BarChart3,
  Users,
  Building2,
  Facebook,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

interface Person {
  id: number;
  name: string;
  pname: string;
  fname: string;
  lname: string;
  therapist_type?: number | null; // เฉพาะตาราง therapist: 0 = แพทย์ทั่วไป, 1 = แพทย์พิเศษ
  status?: number | null;         // เฉพาะตาราง therapist: 0 = ใช้งาน, 1 = ปิดการใช้งาน
  role_id?: number | null;        // เฉพาะตาราง med_staff: เชื่อมโยงกับ therapist.id (คนเดียวกันที่เป็นทั้งหมอนวดและผู้ให้บริการ)
}

const THERAPIST_TYPE_LABEL: Record<number, string> = { 0: "แพทย์ทั่วไป", 1: "แพทย์พิเศษ" };
const THERAPIST_STATUS_LABEL: Record<number, string> = { 0: "ใช้งาน", 1: "ปิดการใช้งาน" };

export default function ManageTherapistsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [therapists, setTherapists] = useState<Person[]>([]);
  const [medStaff, setMedStaff] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Person>>({});
  const [selectedTable, setSelectedTable] = useState<"therapist" | "med_staff" | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null); // สำหรับแก้ไข
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [, setShowAlert] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch("/api/manage-therapists");
    const data = await res.json();
    setTherapists(data.therapists || []);
    setMedStaff(data.medStaff || []);
    setLoading(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedTable === "therapist") {
      setForm({ therapist_type: 0, status: 0 });
    } else if (selectedTable === "med_staff") {
      setForm({ role_id: null });
    } else {
      setForm({});
    }
  }, [selectedTable]);

  // หา therapist ที่เชื่อมโยงกับ med_staff คนนี้ (จาก role_id) เพื่อแสดงชื่อในตาราง
  const getLinkedTherapistName = (roleId?: number | null) => {
    if (!roleId) return null;
    const t = therapists.find((th) => th.id === roleId);
    return t ? `${t.pname}${t.fname} ${t.lname}` : null;
  };

  if (!user) {
    return <p>กำลังตรวจสอบสิทธิ์...</p>; // render ชั่วคราว
  }

  // ฟังก์ชันเพิ่มข้อมูล
  const handleAddSave = async () => {
    if (!selectedTable) {
      alert("กรุณาเลือกตารางก่อนเพิ่มข้อมูล");
      return;
    }

    if (!form.pname?.trim() || !form.fname?.trim() || !form.lname?.trim()) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    const fullName = `${form.pname}${form.fname} ${form.lname}`.trim();
    const res = await fetch(`/api/manage-therapists?table=${selectedTable}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, name: fullName }),
    });

    if (res.ok) {
      setForm({});
      fetchData();
    } else {
      alert("เกิดข้อผิดพลาด");
    }
  };

  // ฟังก์ชันแก้ไขข้อมูล
  const handleEditSave = async () => {
    if (!editingPerson || !selectedTable) return;
    if (!editingPerson.pname?.trim() || !editingPerson.fname?.trim() || !editingPerson.lname?.trim()) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    const fullName = `${editingPerson.pname}${editingPerson.fname} ${editingPerson.lname}`.trim();
    const res = await fetch(`/api/manage-therapists?table=${selectedTable}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editingPerson, name: fullName }),
    });

    if (res.ok) {
      setEditingPerson(null);
      fetchData();
    } else {
      alert("เกิดข้อผิดพลาด");
    }
  };

  const handleDelete = async (id: number) => {
    if (!selectedTable) return;
    if (!confirm("คุณแน่ใจว่าต้องการลบ?")) return;

    const res = await fetch(`/api/manage-therapists?table=${selectedTable}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (res.ok) fetchData();
    else alert("ลบไม่สำเร็จ");
  };

  const openEditDialog = (p: Person, type: "therapist" | "med_staff") => {
    setSelectedTable(type);
    setEditingPerson(p);
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleBookingClick = () => {
    if (!user) {
      setShowAlert(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setShowAlert(false);
        timeoutRef.current = null;
      }, 5000);
      return;
    }
    router.push("/booking");
  };

  
//--------------------------------------
  const renderAddForm = () => (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-emerald-700">
        <UserPlus size={24} />
        เลือกตารางจัดการ
      </h2>

      <div className="mb-4">
        <select
          value={selectedTable || ""}
          onChange={(e) =>
            setSelectedTable(
              e.target.value === "" ? null : (e.target.value as "therapist" | "med_staff")
            )
          }
          className={`w-full h-10 md:w-36 border border-gray-300 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
            !selectedTable ? "text-gray-400" : "text-gray-900"
          }`}
        >
          <option value="" disabled>-- เลือกตาราง --</option>
          <option value="therapist" className="text-gray-900">หมอนวด</option>
          <option value="med_staff" className="text-gray-900">ผู้ให้บริการ</option>
        </select>
      </div>

      {selectedTable && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="คำนำหน้า (ชื่อย่อ)"
              value={form.pname || ""}
              onChange={(e) => setForm({ ...form, pname: e.target.value })}
              className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 text-gray-900"
            />
            <input
              type="text"
              placeholder="ชื่อจริง"
              value={form.fname || ""}
              onChange={(e) => setForm({ ...form, fname: e.target.value })}
              className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 text-gray-900"
            />
            <input
              type="text"
              placeholder="นามสกุล"
              value={form.lname || ""}
              onChange={(e) => setForm({ ...form, lname: e.target.value })}
              className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 text-gray-900"
            />
          </div>

          {/* ฟิลด์เฉพาะตาราง "หมอนวด" (therapist): ประเภทแพทย์ / สถานะการใช้งาน */}
          {selectedTable === "therapist" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block mb-1 text-sm font-medium text-emerald-800">ประเภทแพทย์</label>
                <select
                  value={form.therapist_type ?? 0}
                  onChange={(e) => setForm({ ...form, therapist_type: Number(e.target.value) })}
                  className="w-full h-10 border border-gray-300 rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                >
                  <option value={0}>แพทย์ทั่วไป</option>
                  <option value={1}>แพทย์พิเศษ</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-emerald-800">สถานะการใช้งาน</label>
                <select
                  value={form.status ?? 0}
                  onChange={(e) => setForm({ ...form, status: Number(e.target.value) })}
                  className="w-full h-10 border border-gray-300 rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                >
                  <option value={0}>ใช้งาน</option>
                  <option value={1}>ปิดการใช้งาน</option>
                </select>
              </div>
            </div>
          )}

          {/* ฟิลด์เฉพาะตาราง "ผู้ให้บริการ" (med_staff): เชื่อมโยงกับหมอนวด */}
          {selectedTable === "med_staff" && (
            <div>
              <label className="block mb-1 text-sm font-medium text-emerald-800">
                เชื่อมโยงกับรายชื่อหมอนวด (ถ้าบุคคลนี้เป็นหมอนวดด้วย)
              </label>
              <select
                value={form.role_id ?? ""}
                onChange={(e) => setForm({ ...form, role_id: e.target.value === "" ? null : Number(e.target.value) })}
                className={`w-full h-10 border border-gray-300 rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  form.role_id ? "text-gray-900" : "text-gray-400"
                }`}
              >
                <option value="">-- ไม่เชื่อมโยง --</option>
                {therapists.map((t) => (
                  <option key={t.id} value={t.id} className="text-gray-900">
                    {t.pname}{t.fname} {t.lname}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                ใช้สำหรับกรณีบุคคลเดียวกันเป็นทั้งหมอนวดและเจ้าหน้าที่ผู้ให้บริการ ระบบจะเก็บค่าเป็น med_staff.role_id = therapist.id
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleAddSave}
              className="px-6 h-10 bg-emerald-600 text-white rounded-md font-semibold hover:bg-emerald-700 transition"
            >
              เพิ่มข้อมูลใหม่
            </button>
          </div>
        </div>
      )}
    </div>
  );

const renderTable = (data: Person[], type: "therapist" | "med_staff") => (
  <div className="mb-12">
    <h2 className="text-2xl font-bold text-emerald-700 mb-4">{type === "therapist" ? "ตารางหมอนวด" : "ตารางผู้ให้บริการ"}</h2>

    {/* Desktop Table */}
    <div className="hidden sm:block overflow-hidden rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-emerald-600 text-white">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium">ลำดับ</th>
            <th className="px-6 py-3 text-left text-sm font-medium">ชื่อเต็ม</th>
            {type === "therapist" ? (
              <>
                <th className="px-6 py-3 text-left text-sm font-medium">ประเภท</th>
                <th className="px-6 py-3 text-left text-sm font-medium">สถานะ</th>
              </>
            ) : (
              <th className="px-6 py-3 text-left text-sm font-medium">เชื่อมโยงกับหมอนวด</th>
            )}
            <th className="px-6 py-3 text-center text-sm font-medium">การจัดการ</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-300">
          {data.map((p, index) => {
            const linkedName = type === "med_staff" ? getLinkedTherapistName(p.role_id) : null;
            return (
              <tr key={p.id} className="hover:bg-emerald-50 transition">
                <td className="px-6 py-3">{index + 1}</td>
                <td className="px-6 py-3">{p.pname}{p.fname} {p.lname}</td>
                {type === "therapist" ? (
                  <>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          p.therapist_type === 1 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {THERAPIST_TYPE_LABEL[p.therapist_type ?? 0]}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          p.status === 1 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {THERAPIST_STATUS_LABEL[p.status ?? 0]}
                      </span>
                    </td>
                  </>
                ) : (
                  <td className="px-6 py-3">
                    {linkedName ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700">
                        หมอนวด: {linkedName}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">ไม่เชื่อมโยง</span>
                    )}
                  </td>
                )}
                <td className="px-6 py-3 flex justify-center gap-2">
                  <button
                    onClick={() => openEditDialog(p, type)}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition flex items-center gap-1"
                  >
                    <Pencil size={16} /> แก้ไข
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition flex items-center gap-1"
                  >
                    <Trash2 size={16} /> ลบ
                  </button>
                </td>
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={type === "therapist" ? 5 : 4} className="text-center text-gray-500 italic py-4">ไม่มีข้อมูล</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    {/* Mobile Cards */}
    <div className="sm:hidden space-y-4">
      {data.map((p, index) => (
        <div key={p.id} className="bg-white rounded-xl shadow-lg p-4 border border-gray-200">
          <div className="mb-2">
            <span className="font-semibold text-gray-600">ลำดับ: </span>
            <span className="text-gray-800">{index + 1}</span>
          </div>
          <div className="mb-2">
            <span className="font-semibold text-gray-600">ชื่อเต็ม: </span>
            <span className="text-gray-800">{p.pname}{p.fname} {p.lname}</span>
          </div>

          {type === "therapist" ? (
            <div className="mb-2 flex flex-wrap gap-2">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  p.therapist_type === 1 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {THERAPIST_TYPE_LABEL[p.therapist_type ?? 0]}
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  p.status === 1 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {THERAPIST_STATUS_LABEL[p.status ?? 0]}
              </span>
            </div>
          ) : (
            <div className="mb-2">
              {getLinkedTherapistName(p.role_id) ? (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700">
                  หมอนวด: {getLinkedTherapistName(p.role_id)}
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic">ไม่เชื่อมโยง</span>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => openEditDialog(p, type)}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 rounded-lg shadow hover:from-blue-600 hover:to-blue-700 transition flex items-center justify-center gap-1 text-sm"
            >
              <Pencil size={14} /> แก้ไข
            </button>
            <button
              onClick={() => handleDelete(p.id)}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-2 rounded-lg shadow hover:from-red-600 hover:to-red-700 transition flex items-center justify-center gap-1 text-sm"
            >
              <Trash2 size={14} /> ลบ
            </button>
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <p className="text-center text-gray-500 italic">ไม่มีข้อมูล</p>
      )}
    </div>
  </div>
);

  return (
    <div className="min-h-screen bg-gray-50 text-emerald-700">
      {/* แถบเมนูบนสุด */}
      {/* Header */}
      <div className="fixed top-0 left-0 w-full z-50 bg-gray-700 shadow-md flex justify-between items-center px-2 sm:px-4 py-2 sm:py-2">
        <div className="flex items-center gap-2 sm:gap-13">
          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-white text-xl sm:text-2xl cursor-pointer"
            title="เมนู"
          >
            {menuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          {/* Logo */}
          <div
            className="ml-3 sm:ml-3 text-white font-bold text-base sm:text-lg flex items-center gap-1 cursor-pointer"
            onClick={() => router.push("/")}
            title="หน้าหลัก"
          >
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" /> แพทย์แผนไทย
          </div>
        </div>

        {/* User Buttons */}
        <div className="flex items-center gap-3 sm:gap-3 text-xs sm:text-sm">
          {user ? (
            <>
              <span className="text-white font-semibold text-xs sm:text-sm">
                คุณคือ {user.name || "ผู้ใช้"}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-2 py-3 sm:px-4 sm:py-3 bg-red-600 text-white rounded-lg shadow font-semibold transition hover:bg-red-700 text-xs sm:text-sm cursor-pointer"
                title="ลงชื่อออก"
              >
                <LogOut className="w-3 h-3 sm:w-5 sm:h-5" />
                <span>ลงชื่อออก</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="flex items-center gap-1 px-2 py-1 sm:px-4 sm:py-2 rounded-lg bg-white text-emerald-700 font-semibold shadow transition hover:bg-gray-300 text-xs sm:text-sm cursor-pointer"
              title="ลงชื่อเข้าใช้"
            >
              <LogIn className="w-3 h-3 sm:w-5 sm:h-5" />
              <span>สำหรับบุคลากร</span>
            </button>
          )}
        </div>
      </div>

      {/* Hamburger Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 left-0 w-72 h-full bg-slate-800/95 backdrop-blur-md z-40 flex flex-col pt-16 overflow-y-auto shadow-2xl text-white"
          >
            {/* Header */}
            <div className="px-5 pb-4 border-b border-slate-600">
              <div className="flex items-center gap-2 text-xl font-bold text-white">
                <Sparkles className="text-emerald-400 w-5 h-5" />
                ระบบแพทย์แผนไทย
              </div>

              {user && (
                <div className="mt-2 text-sm text-slate-300">
                  ผู้ใช้งาน : <span className="font-semibold">{user.name}</span>
                </div>
              )}
            </div>

            {/* ===================== เมนูหลัก ===================== */}
            <div className="py-2">
              <div
                onClick={user ? handleBookingClick : () => router.push("/booking")}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>
                  {user ? "จองคิวนวดแผนไทย" : "ดูคิวจองนวดแผนไทย"}
                </span>
              </div>

              <div
                onClick={() => router.push("/booking-audit")}
                className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer"
              >
                <ClipboardList className="w-4 h-4 text-blue-400" />
                <span>ดูคิวนวดทั้งหมด</span>
              </div>
            </div>
            <div
              onClick={() => router.push("/beds-special")}
              className="flex items-center gap-3 px-5 py-3 text-white hover:bg-emerald-600 transition cursor-pointer"
            >
              <BedDouble className="w-4 h-4 text-emerald-300" />
              <span>จองเตียงพิเศษ</span>
            </div>

            {/* ===================== เจ้าหน้าที่ ===================== */}
            {user && (
              <>
                <div className="border-t border-slate-600 my-2" />

                <div className="px-5 py-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  สำหรับเจ้าหน้าที่
                </div>

                <div
                  onClick={() => router.push("/all-bookings")}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer"
                >
                  <History className="w-4 h-4 text-amber-400" />
                  <span>ประวัติการจอง</span>
                </div>

                <div
                  onClick={() => router.push("/summary-history")}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  <span>สรุปรายงาน</span>
                </div>

                <div
                  onClick={() => router.push("/summary-therapists")}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-purple-100" />
                  <span>รายงานการปฎิบัติงาน</span>
                </div>
                <div
                  onClick={() => router.push("/check-que")}
                  className="flex items-center gap-3 px-5 py-3 text-white hover:bg-blue-600 transition cursor-pointer"
                >
                  <Search className="w-4 h-4 text-purple-100" />
                  <span>ค้นหาข้อมูลผู้รับบริการ</span>
                </div>
              </>
            )}

            {/* ===================== Admin ===================== */}
            {user?.role === "admin" && (
              <>
                <div className="border-t border-slate-600 my-2" />

                <div className="px-5 py-2 text-xs font-semibold uppercase tracking-widest text-amber-300">
                  จัดการระบบ
                </div>

                <div
                  onClick={() => router.push("/manage-therapists")}                  
                  className="flex items-center gap-3 px-5 py-3 text-white bg-amber-600/40 transition cursor-pointer"
                >
                  <Users className="w-4 h-4 text-rose-400" />
                  <span>จัดการบุคลากร</span>
                </div>
              </>
            )}

            {/* ===================== ติดต่อ ===================== */}
            <div className="border-t border-slate-600 my-2" />

            <div
              onClick={() => setContactOpen(!contactOpen)}
              className="flex items-center gap-3 px-5 py-3 text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-teal-400" />

              <span className="flex-1">
                ช่องทางติดต่อ
              </span>

              {contactOpen ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </div>

            {contactOpen && (
              <div className="bg-slate-900">
                <a
                  href="https://m.me/100070719421986"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-9 py-3 text-slate-200 hover:bg-blue-700 transition"
                >
                  <Facebook className="w-4 h-4 text-blue-400" />
                  Facebook (จองคิว)
                </a>

                <a
                  href="https://www.lmwcc.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-9 py-3 text-slate-200 hover:bg-emerald-700 transition"
                >
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  เว็บไซต์ศูนย์บริการ
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* เนื้อหา */}
      <div className="max-w-6xl mx-auto p-6 pt-27">
        <h1 className="text-4xl font-extrabold text-emerald-700 mb-11 text-center drop-shadow-sm">
          จัดการรายชื่อบุคลากร
        </h1>

        {renderAddForm()}

        {loading ? (
          <p className="text-center text-gray-500">กำลังโหลด...</p>
        ) : (
          <>
            {selectedTable === "therapist" && renderTable(therapists, "therapist")}
            {selectedTable === "med_staff" && renderTable(medStaff, "med_staff")}
          </>
        )}

{editingPerson && (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/20">
    <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md border border-gray-200">
      {/* หัวข้อ dialog */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-emerald-700">แก้ไขข้อมูลบุคลากร</h2>
        <button
          onClick={() => setEditingPerson(null)}
          className="text-gray-500 hover:text-gray-700 font-bold"
        >
          X
        </button>
      </div>

      {/* ฟอร์มแก้ไข */}
      <div className="space-y-4">
        <div>
          <label className="block mb-1 font-medium text-emerald-800">คำนำหน้า(คำย่อ)</label>
          <input
            type="text"
            value={editingPerson.pname}
            onChange={(e) => setEditingPerson({ ...editingPerson, pname: e.target.value })}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 text-gray-900"
            placeholder="คำย่อ"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium text-emerald-800">ชื่อจริง</label>
          <input
            type="text"
            value={editingPerson.fname}
            onChange={(e) => setEditingPerson({ ...editingPerson, fname: e.target.value })}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 text-gray-900"
            placeholder="ชื่อ"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium text-emerald-800">นามสกุล</label>
          <input
            type="text"
            value={editingPerson.lname}
            onChange={(e) => setEditingPerson({ ...editingPerson, lname: e.target.value })}
            className="w-full px-4 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 text-gray-900"
            placeholder="นามสกุล"
          />
        </div>

        {/* ฟิลด์เฉพาะตาราง "หมอนวด" (therapist) */}
        {selectedTable === "therapist" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 font-medium text-emerald-800">ประเภทแพทย์</label>
              <select
                value={editingPerson.therapist_type ?? 0}
                onChange={(e) => setEditingPerson({ ...editingPerson, therapist_type: Number(e.target.value) })}
                className="w-full h-10 border border-gray-300 rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
              >
                <option value={0}>แพทย์ทั่วไป</option>
                <option value={1}>แพทย์พิเศษ</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 font-medium text-emerald-800">สถานะการใช้งาน</label>
              <select
                value={editingPerson.status ?? 0}
                onChange={(e) => setEditingPerson({ ...editingPerson, status: Number(e.target.value) })}
                className="w-full h-10 border border-gray-300 rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
              >
                <option value={0}>ใช้งาน</option>
                <option value={1}>ปิดการใช้งาน</option>
              </select>
            </div>
          </div>
        )}

        {/* ฟิลด์เฉพาะตาราง "ผู้ให้บริการ" (med_staff) */}
        {selectedTable === "med_staff" && (
          <div>
            <label className="block mb-1 font-medium text-emerald-800">
              เชื่อมโยงกับรายชื่อหมอนวด (ถ้าบุคคลนี้เป็นหมอนวดด้วย)
            </label>
            <select
              value={editingPerson.role_id ?? ""}
              onChange={(e) =>
                setEditingPerson({
                  ...editingPerson,
                  role_id: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className={`w-full h-10 border border-gray-300 rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                editingPerson.role_id ? "text-gray-900" : "text-gray-400"
              }`}
            >
              <option value="">-- ไม่เชื่อมโยง --</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id} className="text-gray-900">
                  {t.pname}{t.fname} {t.lname}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ปุ่มบันทึก/ยกเลิก */}
      <div className="flex justify-end gap-3 mt-4">
        <button
          onClick={handleEditSave}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition"
        >
          บันทึก
        </button>
        <button
          onClick={() => setEditingPerson(null)}
          className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  </div>
)}
      </div>
    </div>
  );
}
