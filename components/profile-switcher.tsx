"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";

type ProfileStatus = {
  member: { email: string; name: string; role: string } | null;
  admin: { email: string; authMethod: "portal" | "google" } | null;
  googleConfigured: boolean;
  adminPortalConfigured: boolean;
};

export function ProfileSwitcher() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ProfileStatus>({
    member: null,
    admin: null,
    googleConfigured: false,
    adminPortalConfigured: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const isAdminRoute = pathname.startsWith("/admin");

  useEffect(() => {
    setOpen(false);
    let live = true;
    fetch("/api/profiles/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ProfileStatus | null) => {
        if (live && data) setStatus(data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleSwitchGoogleAccount() {
    if (busy) return;
    setBusy(true);
    try {
      await signIn("google", { redirectTo: "/dashboard" });
    } finally {
      setBusy(false);
    }
  }

  async function handleAdminSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      setStatus((prev) => ({ ...prev, admin: prev.member?.role === "admin" ? { email: prev.member.email, authMethod: "google" } : null }));
      setOpen(false);
      router.push("/admin/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleMemberSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      setOpen(false);
      await signOut({ redirectTo: "/" });
    } finally {
      setBusy(false);
    }
  }

  const activeLabel = isAdminRoute
    ? "Admin"
    : status.member
      ? status.member.name.split(" ")[0]
      : "Profiles";

  return (
    <div className="profile-switcher" ref={containerRef}>
      <button
        type="button"
        className="profile-switcher-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch profile"
        title="Switch between Member and Admin profiles"
      >
        {isAdminRoute ? (
          <ShieldCheck size={14} className="profile-switcher-icon" aria-hidden="true" />
        ) : (
          <ArrowLeftRight size={14} className="profile-switcher-icon" aria-hidden="true" />
        )}
        <span className="profile-switcher-label">{activeLabel}</span>
        <ChevronDown size={13} className={`profile-switcher-caret${open ? " open" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="profile-menu" role="menu" aria-label="Switch profile">
          <div className="profile-menu-heading">Switch profile</div>

          <Link
            href={status.member ? "/dashboard" : "/auth"}
            className={`profile-menu-item${!isAdminRoute ? " active" : ""}`}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="profile-menu-avatar">
              <User size={14} />
            </span>
            <span className="profile-menu-copy">
              <b>Member profile</b>
              <small>{status.member ? status.member.email : "Sign in as campus member"}</small>
            </span>
            {!isAdminRoute && <Check size={14} className="profile-menu-check" aria-hidden="true" />}
          </Link>

          <Link
            href={status.admin ? "/admin" : "/admin/login"}
            className={`profile-menu-item${isAdminRoute ? " active" : ""}`}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="profile-menu-avatar admin">
              <ShieldCheck size={14} />
            </span>
            <span className="profile-menu-copy">
              <b>Admin portal</b>
              <small>
                {status.admin ? status.admin.email : "Sign in with admin credentials"}
              </small>
            </span>
            {isAdminRoute && <Check size={14} className="profile-menu-check" aria-hidden="true" />}
          </Link>

          <div className="profile-menu-divider" />

          {status.googleConfigured && (
            <button
              type="button"
              className="profile-menu-action"
              role="menuitem"
              disabled={busy}
              onClick={handleSwitchGoogleAccount}
            >
              <RefreshCw size={13} />
              <span>Switch Google account</span>
            </button>
          )}

          {status.member && (
            <Link
              href="/settings"
              className="profile-menu-action"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <Settings size={13} />
              <span>Member settings</span>
            </Link>
          )}

          {status.admin?.authMethod === "portal" && (
            <button
              type="button"
              className="profile-menu-action danger"
              role="menuitem"
              disabled={busy}
              onClick={handleAdminSignOut}
            >
              <LogOut size={13} />
              <span>Sign out of Admin</span>
            </button>
          )}

          {status.member && (
            <button
              type="button"
              className="profile-menu-action danger"
              role="menuitem"
              disabled={busy}
              onClick={handleMemberSignOut}
            >
              <LogOut size={13} />
              <span>Sign out of Member</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
