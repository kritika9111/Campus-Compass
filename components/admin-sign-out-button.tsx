"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function AdminSignOutButton({ authMethod }: { authMethod: "portal" | "google" }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    setBusy(true);
    try {
      if (authMethod === "portal") {
        await fetch("/api/admin/auth/logout", { method: "POST" });
        router.push("/admin/login");
        router.refresh();
      } else {
        await signOut({ redirectTo: "/" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="button button-outline signout" disabled={busy} onClick={handleSignOut}>
      <LogOut size={15} />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
