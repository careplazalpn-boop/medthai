"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { FaHistory, FaFacebook, FaHospital, FaUsersCog, FaChartBar, FaCalendarAlt, FaSignOutAlt, FaSignInAlt, FaTimes, FaBars, FaSpa } from "react-icons/fa";
import { HiChevronDown, HiChevronUp } from "react-icons/hi";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

interface Person {
  id: number;
  name: string;
  pname: string;
  fname: string;
  lname: string;
}

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
            <th className="px-6 py-3 text-center text-sm font-medium">การจัดการ</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-300">
          {data.map((p, index) => (
            <tr key={p.id} className="hover:bg-emerald-50 transition">
              <td className="px-6 py-3">{index + 1}</td>
              <td className="px-6 py-3">{p.pname}{p.fname} {p.lname}</td>
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
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center text-gray-500 italic py-4">ไม่มีข้อมูล</td>
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
            <div className="fixed top-0 left-0 w-full z-50 bg-gradient-to-r from-emerald-600 to-green-500 shadow-md flex justify-between items-center px-2 sm:px-4 py-2 sm:py-2">
              <div className="flex items-center gap-2 sm:gap-13">
                {/* Hamburger */}
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="text-white text-xl sm:text-2xl"
                  title="เมนู"
                >
                  {menuOpen ? <FaTimes /> : <FaBars />}
                </button>
      
                {/* Logo */}
                <div
                  className="ml-3 sm:ml-3 text-white font-bold text-base sm:text-lg flex items-center gap-1 cursor-pointer"
                  onClick={() => router.push("/")}
                  title="หน้าหลัก"
                >
                  <FaSpa className="text-sm sm:text-base" /> แพทย์แผนไทย
                </div>
              </div>
      
              {/* User Buttons */}
              <div className="flex items-center gap-3 sm:gap-3 text-xs sm:text-sm">
                {user ? (
                  <>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 px-2 py-3 sm:px-4 sm:py-3 bg-red-600 text-white rounded-lg shadow font-semibold transition hover:bg-red-700 text-xs sm:text-sm"
                      title="ลงชื่อออก"
                    >
                      <FaSignOutAlt className="w-3 h-3 sm:w-5 sm:h-5" />
                      <span>ลงชื่อออก</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => router.push("/login")}
                    className="flex items-center gap-1 px-2 py-1 sm:px-4 sm:py-2 rounded-lg bg-white text-emerald-700 font-semibold shadow transition hover:bg-gray-300 text-xs sm:text-sm"
                    title="ลงชื่อเข้าใช้"
                  >
                    <FaSignInAlt className="w-3 h-3 sm:w-5 sm:h-5" />
                    <span>สำหรับบุคลากร</span>
                  </button>
                )}
              </div>
            </div>
            <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 left-0 w-48 sm:w-64 h-full bg-black/70 z-40 flex flex-col pt-15 overflow-y-auto"
          >
            {/* จองคิว */}
            <div
              onClick={user ? handleBookingClick : () => router.push("/booking")}
              className="w-full py-3 sm:py-4 px-4 sm:px-6 border-b-2 border-gray-400 cursor-pointer hover:bg-white/20 flex items-center justify-center gap-2 text-sm sm:text-lg font-semibold text-white"
            >
              <FaCalendarAlt /> {user ? "จองคิวนวดแผนไทย" : "ดูคิวจองนวดแผนไทย"}
            </div>

            {user && (
              <>
                <div
                  onClick={() => router.push("/all-bookings")}
                  className="w-full py-3 sm:py-4 px-4 sm:px-6 border-b-2 border-gray-400 cursor-pointer hover:bg-white/20 flex items-center justify-center gap-2 text-sm sm:text-lg font-semibold text-white"
                >
                  <FaHistory /> ประวัติการจอง
                </div>
                <div
                  onClick={() => router.push("/summary-history")}
                  className="w-full py-3 sm:py-4 px-4 sm:px-6 border-b-2 border-gray-400 cursor-pointer hover:bg-white/20 flex items-center justify-center gap-2 text-sm sm:text-lg font-semibold text-white"
                >
                  <FaChartBar /> สรุปประวัติ
                </div>
                {user.role === "admin" && (
                  <button
                    onClick={() => router.push("/manage-therapists")}
                    className="w-full py-3 sm:py-4 px-4 sm:px-6 border-b-2 border-gray-400 cursor-pointer hover:bg-white/20 flex items-center justify-center gap-2 text-sm sm:text-lg font-semibold text-white"
                    title="จัดการบุคลากร"
                  >
                    <FaUsersCog /> จัดการบุคลากร
                  </button>
                )}
              </>
            )}

            {/* ช่องทางติดต่อ */}
            <div className="w-full border-b-2 border-gray-400 relative">
              <div
                onClick={() => setContactOpen(!contactOpen)}
                className="w-full py-3 sm:py-4 px-4 sm:px-6 cursor-pointer hover:bg-white/20 text-sm sm:text-lg font-semibold text-white text-center relative"
              >
                <span>ช่องทางอื่น</span>
                <span className="absolute right-4 top-1/2 -translate-y-1/2">
                  {contactOpen ? <HiChevronUp className="w-5 h-5" /> : <HiChevronDown className="w-5 h-5" />}
                </span>
              </div>
              {contactOpen && (
                <div className="flex flex-col bg-black/50 text-white text-sm sm:text-base">
                  <a
                    href="https://www.facebook.com/profile.php?id=100070719421986"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-6 hover:bg-white/20 flex items-center justify-center gap-2"
                  >
                    <FaFacebook className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Facebook</span>
                  </a>
                  <a
                    href="https://www.lmwcc.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-6 hover:bg-white/20 flex items-center justify-center gap-2"
                  >
                    <FaHospital className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>เพจหลักศูนย์บริการ</span>
                  </a>
                </div>
              )}
            </div>
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
