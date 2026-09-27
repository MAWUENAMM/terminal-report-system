"use client";

import { useEffect, useState, useRef } from "react";
import { store } from "@/lib/store";
import { Student, Class } from "@/types";
import { formatName } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { Plus, Search, Pencil, UsersRound } from "lucide-react";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState({
    admissionNumber: "", firstName: "", lastName: "", otherNames: "",
    gender: "M" as "M" | "F", classId: "", guardianName: "", guardianPhone: "", photoUrl: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setStudents(store.getStudents());
    setClasses(store.getClasses());
  }

  useEffect(() => { refresh(); }, []);

  function openNew() {
    setEditing(null);
    setForm({
      admissionNumber: "", firstName: "", lastName: "", otherNames: "",
      gender: "M", classId: classes[0]?.id || "", guardianName: "", guardianPhone: "", photoUrl: "",
    });
    setShowForm(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setForm({
      admissionNumber: s.admissionNumber, firstName: s.firstName, lastName: s.lastName,
      otherNames: s.otherNames || "", gender: s.gender, classId: s.classId,
      guardianName: s.guardianName || "", guardianPhone: s.guardianPhone || "", photoUrl: s.photoUrl || "",
    });
    setShowForm(true);
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, photoUrl: reader.result as string }));
    reader.readAsDataURL(file);
  }

  function saveStudent(e: React.FormEvent) {
    e.preventDefault();
    const all = store.getStudents();
    if (editing) {
      store.saveStudents(all.map(s =>
        s.id === editing.id
          ? { ...s, ...form, otherNames: form.otherNames || undefined, guardianName: form.guardianName || undefined, guardianPhone: form.guardianPhone || undefined, photoUrl: form.photoUrl || undefined }
          : s
      ));
    } else {
      store.saveStudents([...all, {
        id: uuidv4(), ...form,
        otherNames: form.otherNames || undefined,
        guardianName: form.guardianName || undefined,
        guardianPhone: form.guardianPhone || undefined,
        photoUrl: form.photoUrl || undefined,
        status: "ACTIVE" as const,
        createdAt: new Date().toISOString(),
      }]);
    }
    setShowForm(false);
    refresh();
  }

  function className(id: string) {
    return classes.find(c => c.id === id)?.name || id;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-7">
        <div>
          <div className="eyebrow">Student information</div><h1 className="page-title mt-2">Students</h1>
          <p className="mt-2 text-sm text-slate-500">Maintain learner profiles, class placement and guardian information.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800"><Plus size={16}/> Add student</button>
      </div>

      <div className="surface rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Profile</th>
              <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Admission no.</th>
              <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Student</th>
              <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Gender</th>
              <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Class</th>
              <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.filter(s => s.status === "ACTIVE").map((s) => (
              <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-5 py-3">
                  {s.photoUrl ? (
                    <img src={s.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs">
                      {s.firstName[0]}{s.lastName[0]}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{s.admissionNumber}</td>
                <td className="px-5 py-3 font-medium">{formatName(s.firstName, s.lastName, s.otherNames)}</td>
                <td className="px-4 py-3">{s.gender === "M" ? "Male" : "Female"}</td>
                <td className="px-4 py-3">{className(s.classId)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(s)} className="text-primary-600 hover:underline text-sm">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold">{editing ? "Edit Student" : "Add Student"}</h2>
            </div>
            <form onSubmit={saveStudent} className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center border-2 border-dashed border-slate-300">
                  {form.photoUrl ? <img src={form.photoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-slate-400 text-xs">Photo</span>}
                </div>
                <div>
                  <button type="button" onClick={() => fileRef.current?.click()} className="text-sm text-primary-600 hover:underline">Upload photo</button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                  <p className="text-xs text-slate-500 mt-1">Optional. JPEG/PNG recommended.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Admission No. *</label>
                  <input required value={form.admissionNumber} onChange={e => setForm(f => ({...f, admissionNumber: e.target.value}))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Class *</label>
                  <select required value={form.classId} onChange={e => setForm(f => ({...f, classId: e.target.value}))} className="w-full px-3 py-2 border rounded-lg">
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">First Name *</label>
                  <input required value={form.firstName} onChange={e => setForm(f => ({...f, firstName: e.target.value}))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last Name *</label>
                  <input required value={form.lastName} onChange={e => setForm(f => ({...f, lastName: e.target.value}))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Other Names</label>
                <input value={form.otherNames} onChange={e => setForm(f => ({...f, otherNames: e.target.value}))} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gender *</label>
                <select value={form.gender} onChange={e => setForm(f => ({...f, gender: e.target.value as "M"|"F"}))} className="w-full px-3 py-2 border rounded-lg">
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Guardian Name</label>
                  <input value={form.guardianName} onChange={e => setForm(f => ({...f, guardianName: e.target.value}))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Guardian Phone</label>
                  <input value={form.guardianPhone} onChange={e => setForm(f => ({...f, guardianPhone: e.target.value}))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2.5 bg-primary-700 text-white font-medium rounded-lg hover:bg-primary-800">Save</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
