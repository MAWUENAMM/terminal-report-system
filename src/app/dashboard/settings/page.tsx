"use client";

import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { School } from "@/types";

export default function SettingsPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSchool(store.getSchool());
  }, []);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (school) {
      store.saveSchool(school);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  if (!school) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">School Settings</h1>
      <p className="text-slate-600 mb-6">Configure school profile and assessment weights</p>

      <form onSubmit={save} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">School Name</label>
          <input value={school.name} onChange={e => setSchool({...school, name: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <input value={school.address || ""} onChange={e => setSchool({...school, address: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Academic Year</label>
            <input value={school.academicYear} onChange={e => setSchool({...school, academicYear: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Current Term</label>
            <select value={school.currentTerm} onChange={e => setSchool({...school, currentTerm: Number(e.target.value) as 1|2|3})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
              <option value={1}>Term 1</option>
              <option value={2}>Term 2</option>
              <option value={3}>Term 3</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">SBA Weight (%)</label>
            <input type="number" value={school.sbaWeight} onChange={e => setSchool({...school, sbaWeight: Number(e.target.value)})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Exam Weight (%)</label>
            <input type="number" value={school.examWeight} onChange={e => setSchool({...school, examWeight: Number(e.target.value)})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Headteacher Name</label>
          <input value={school.headteacherName || ""} onChange={e => setSchool({...school, headteacherName: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>

        <button type="submit" className="px-5 py-2.5 bg-primary-700 text-white font-medium rounded-lg hover:bg-primary-800">
          Save Settings
        </button>
        {saved && <span className="ml-3 text-green-600 text-sm">✓ Saved</span>}
      </form>
    </div>
  );
}
