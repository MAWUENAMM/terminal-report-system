"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { store } from "@/lib/store";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("teacher@school.edu.gh");
  const [error, setError] = useState("");

  useEffect(() => {
    store.seed();
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const users = store.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      setError("User not found. Try: admin@school.edu.gh, head@school.edu.gh or teacher@school.edu.gh");
      return;
    }
    store.setCurrentUser(user);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-full bg-primary-700 text-white items-center justify-center text-2xl font-bold mb-4">
            TR
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Terminal Report System</h1>
          <p className="text-slate-600 mt-1">Sign in to your school account</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
              placeholder="you@school.edu.gh"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              defaultValue="demo123"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
              placeholder="••••••••"
            />
            <p className="text-xs text-slate-500 mt-1">Demo mode — any password works</p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-primary-700 text-white font-semibold rounded-lg hover:bg-primary-800 transition"
          >
            Sign In
          </button>

          <div className="text-center text-sm text-slate-500 pt-2">
            Demo accounts:{" "}
            <button type="button" onClick={() => setEmail("admin@school.edu.gh")} className="text-primary-600 hover:underline">Admin</button>
            {" · "}
            <button type="button" onClick={() => setEmail("head@school.edu.gh")} className="text-primary-600 hover:underline">Head</button>
            {" · "}
            <button type="button" onClick={() => setEmail("teacher@school.edu.gh")} className="text-primary-600 hover:underline">Teacher</button>
          </div>
        </form>

        <p className="text-center mt-6">
          <Link href="/" className="text-sm text-slate-600 hover:text-primary-700">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
