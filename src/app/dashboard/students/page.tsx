"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { store } from "@/lib/store";
import { Student, Class } from "@/types";
import { formatName } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { Plus, Search, Pencil } from "lucide-react";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [filter, setFilter] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState({
    admissionNumber: "",
    firstName: "",
    lastName: "",
    otherNames: "",
    gender: "M" as "M" | "F",
    classId: "",
    guardianName: "",
    guardianPhone: "",
    photoUrl: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  function refresh() {
    store.seed();
    setStudents(store.getStudents());
    setClasses(store.getClasses());
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return students
      .filter((s) => s.status === "ACTIVE")
      .filter((s) => (classFilter === "all" ? true : s.classId === classFilter))
      .filter((s) => {
        if (!q) return true;
        const name = `${s.firstName} ${s.lastName} ${s.otherNames || ""}`.toLowerCase();
        return (
          name.includes(q) ||
          s.admissionNumber.toLowerCase().includes(q) ||
          (s.guardianName || "").toLowerCase().includes(q)
        );
      });
  }, [students, filter, classFilter]);

  function openNew() {
    setEditing(null);
    setForm({
      admissionNumber: "",
      firstName: "",
      lastName: "",
      otherNames: "",
      gender: "M",
      classId: classes[0]?.id || "",
      guardianName: "",
      guardianPhone: "",
      photoUrl: "",
    });
    setShowForm(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setForm({
      admissionNumber: s.admissionNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      otherNames: s.otherNames || "",
      gender: s.gender,
      classId: s.classId,
      guardianName: s.guardianName || "",
      guardianPhone: s.guardianPhone || "",
      photoUrl: s.photoUrl || "",
    });
    setShowForm(true);
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photoUrl: reader.result as string }));
    reader.readAsDataURL(file);
  }

  function saveStudent(e: React.FormEvent) {
    e.preventDefault();
    const all = store.getStudents();
    if (editing) {
      store.saveStudents(
        all.map((s) =>
          s.id === editing.id
            ? {
                ...s,
                ...form,
                otherNames: form.otherNames || undefined,
                guardianName: form.guardianName || undefined,
                guardianPhone: form.guardianPhone || undefined,
                photoUrl: form.photoUrl || undefined,
              }
            : s
        )
      );
    } else {
      store.saveStudents([
        ...all,
        {
          id: uuidv4(),
          ...form,
          otherNames: form.otherNames || undefined,
          guardianName: form.guardianName || undefined,
          guardianPhone: form.guardianPhone || undefined,
          photoUrl: form.photoUrl || undefined,
          status: "ACTIVE" as const,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setShowForm(false);
    refresh();
  }

  function className(id: string) {
    return classes.find((c) => c.id === id)?.name || id;
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="eyebrow">Student information</div>
          <h1 className="page-title mt-2">Students</h1>
          <p className="mt-2 text-sm text-muted">
            Maintain learner profiles, class placement and guardian information.
          </p>
        </div>
        <button onClick={openNew} className="btn-primary !py-2.5 w-fit">
          <Plus size={16} />
          Add student
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2.5">
          <Search size={15} className="text-muted" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name, admission number…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-full border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--g-green)]"
        >
          <option value="all">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="surface overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-paper/80">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                  Profile
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                  Admission no.
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                  Student
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                  Gender
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                  Class
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-line/60 hover:bg-paper/60">
                  <td className="px-5 py-3">
                    {s.photoUrl ? (
                      <img
                        src={s.photoUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--g-green)]/10 text-xs font-semibold text-[var(--g-green)]">
                        {s.firstName[0]}
                        {s.lastName[0]}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-muted">{s.admissionNumber}</td>
                  <td className="px-5 py-3 font-medium">
                    {formatName(s.firstName, s.lastName, s.otherNames)}
                  </td>
                  <td className="px-5 py-3">{s.gender === "M" ? "Male" : "Female"}</td>
                  <td className="px-5 py-3">{className(s.classId)}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => openEdit(s)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-[var(--g-green)] hover:underline"
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted">
                    No students match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-5 py-3 text-xs text-muted">
          Showing {filtered.length} of {students.filter((s) => s.status === "ACTIVE").length} students
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-line p-6">
              <h2 className="text-lg font-semibold">{editing ? "Edit student" : "Add student"}</h2>
            </div>
            <form onSubmit={saveStudent} className="space-y-4 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-line bg-paper">
                  {form.photoUrl ? (
                    <img src={form.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted">Photo</span>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-sm font-medium text-[var(--g-green)] hover:underline"
                  >
                    Upload photo
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhoto}
                  />
                  <p className="mt-1 text-xs text-muted">Optional. JPEG or PNG.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Admission no. *</label>
                  <input
                    required
                    value={form.admissionNumber}
                    onChange={(e) => setForm((f) => ({ ...f, admissionNumber: e.target.value }))}
                    className="field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Class *</label>
                  <select
                    required
                    value={form.classId}
                    onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                    className="field"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">First name *</label>
                  <input
                    required
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Last name *</label>
                  <input
                    required
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="field"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Other names</label>
                <input
                  value={form.otherNames}
                  onChange={(e) => setForm((f) => ({ ...f, otherNames: e.target.value }))}
                  className="field"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Gender *</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as "M" | "F" }))}
                  className="field"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Guardian name</label>
                  <input
                    value={form.guardianName}
                    onChange={(e) => setForm((f) => ({ ...f, guardianName: e.target.value }))}
                    className="field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Guardian phone</label>
                  <input
                    value={form.guardianPhone}
                    onChange={(e) => setForm((f) => ({ ...f, guardianPhone: e.target.value }))}
                    className="field"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  Save
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
