"use client";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/client";
export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await browserClient().auth.signOut();
        window.location.assign("/login");
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
