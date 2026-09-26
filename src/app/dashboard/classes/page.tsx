"use client";

import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { Class } from "@/types";

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState(store.getStudents());

  useEffect(() => {
    setClasses(store.getClasses());
    setStudents(store.getStudents());
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Classes</h1>
      <p className="text-slate-600 mb-6">View classes and student counts</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map(c => {
          const count = students.filter(s => s.classId === c.id && s.status === "ACTIVE").length;
          return (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="text-lg font-semibold">{c.name}</div>
              <div className="text-sm text-slate-500 mb-3">{c.level} · {c.academicYear}</div>
              <div className="text-3xl font-bold text-primary-700">{count}</div>
              <div className="text-sm text-slate-500">students</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
