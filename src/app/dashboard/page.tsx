"use client";

import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { School, Student, Class, Score } from "@/types";
import Link from "next/link";

export default function DashboardPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [scores, setScores] = useState<Score[]>([]);

  useEffect(() => {
    setSchool(store.getSchool());
    setStudents(store.getStudents());
    setClasses(store.getClasses());
    setScores(store.getScores());
  }, []);

  const activeStudents = students.filter(s => s.status === "ACTIVE");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600">
          {school?.name} · {school?.academicYear} · Term {school?.currentTerm}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Students", value: activeStudents.length, color: "bg-blue-500" },
          { label: "Classes", value: classes.length, color: "bg-emerald-500" },
          { label: "Subjects Tracked", value: store.getSubjects().length, color: "bg-violet-500" },
          { label: "Scores Entered", value: scores.length, color: "bg-amber-500" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className={`w-10 h-10 ${stat.color} rounded-lg mb-3 opacity-90`}></div>
            <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
            <div className="text-sm text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/dashboard/scores" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-100 transition">
              <span className="text-xl">📝</span>
              <div>
                <div className="font-medium">Enter / Edit Scores</div>
                <div className="text-sm text-slate-500">SBA and examination marks</div>
              </div>
            </Link>
            <Link href="/dashboard/reports" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-100 transition">
              <span className="text-xl">📄</span>
              <div>
                <div className="font-medium">Generate Report Cards</div>
                <div className="text-sm text-slate-500">PDF terminal reports</div>
              </div>
            </Link>
            <Link href="/dashboard/students" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-100 transition">
              <span className="text-xl">👨‍🎓</span>
              <div>
                <div className="font-medium">Manage Students</div>
                <div className="text-sm text-slate-500">Add photos, update details</div>
              </div>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">Classes</h2>
          <div className="space-y-2">
            {classes.map((c) => {
              const count = students.filter(s => s.classId === c.id && s.status === "ACTIVE").length;
              return (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-slate-500">{c.level}</div>
                  </div>
                  <div className="text-sm font-medium text-slate-700">{count} students</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
