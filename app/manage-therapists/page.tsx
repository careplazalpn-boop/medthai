"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { FaHistory, FaSpa } from "react-icons/fa";

interface Person {
  id: number;
  name: string;
  pname: string;
  fname: string;
  lname: string;
}

export default function ManageTherapistsPage() {
  const router = useRouter();
  const [therapists, setTherapists] = useState<Person[]>([]);
  const [medStaff, setMedStaff] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Person>>({});
  const [selectedTable, setSelectedTable] = useState<"therapist" | "med_staff" | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null); // สำหรับแก้ไข

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch("/api/manage-therapists");
    const data = await res.json();
    setTherapists(data.therapists || []);
    setMedStaff(data.medStaff || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      <div className="overflow-x-auto rounded-lg shadow">
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
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition flex items-center"
                  >
                    <Pencil size={16} /> แก้ไข
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition flex items-center"
                  >
                    <Trash2 size={16} /> ลบ
                  </button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-gray-500 italic py-4">
                  ไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-emerald-700">
      {/* แถบเมนูบนสุด */}
      <div className="fixed top-0 left-0 w-full z-50 bg-gradient-to-r from-emerald-600 to-green-500 shadow-md flex justify-between items-center px-4 py-2">
        <div className="text-white font-bold text-lg flex items-center gap-2 cursor-pointer" onClick={() => router.push("/")}>
          <FaSpa /> แพทย์แผนไทย
        </div>
        <button
          onClick={() => router.push("/all-bookings")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-gray-300 text-emerald-700 font-semibold shadow transition"
          title = "ประวัติการจอง"
        >
          <FaHistory className="w-5 h-6" />
        </button>
      </div>

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
