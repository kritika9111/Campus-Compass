"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { formatCampusDate } from "@/lib/datetime";
import { campusRoles, type CampusRole, type UserAuthStatus } from "@/lib/types";

export type AdminUserRecord = {
  email: string;
  name: string;
  role: CampusRole;
  auth_status: UserAuthStatus;
  status_reason: string;
  created_at: string;
  last_login_at: string;
};

type FilterTab = "all" | "approved" | "suspended" | "admins";

function generateStrongPassword(length = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_";
  const all = upper + lower + digits + symbols;

  const pick = (charset: string) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return charset[buf[0] % charset.length];
  };

  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) {
    chars.push(pick(all));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function AdminUsersManager({
  users,
  currentAdminEmail,
}: {
  users: AdminUserRecord[];
  currentAdminEmail: string;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (tab === "approved" && u.auth_status !== "approved") return false;
      if (tab === "suspended" && u.auth_status !== "suspended") return false;
      if (tab === "admins" && u.role !== "admin") return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, query, tab]);

  async function updateUser(
    email: string,
    patch: { role?: CampusRole; auth_status?: UserAuthStatus; reason?: string; new_password?: string },
  ): Promise<boolean> {
    setBusyEmail(email);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        passwordReset?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !result?.ok) {
        setError(result?.error || "Could not update that user account.");
        return false;
      }
      setNotice(
        result.passwordReset
          ? `Password reset for ${email}. They have been notified to update it in Settings.`
          : `Updated ${email}.`,
      );
      router.refresh();
      return true;
    } catch {
      setError("Connection problem. Please try again.");
      return false;
    } finally {
      setBusyEmail(null);
    }
  }

  function openPasswordReset(email: string) {
    setError("");
    setNotice("");
    setCopied(false);
    if (resetEmail === email) {
      setResetEmail(null);
      setResetPassword("");
      return;
    }
    setResetEmail(email);
    setResetPassword(generateStrongPassword());
    setShowResetPassword(true);
  }

  async function copyResetPassword() {
    if (!resetPassword) return;
    try {
      await navigator.clipboard.writeText(resetPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy automatically. Select and copy the password manually.");
    }
  }

  async function saveResetPassword(email: string) {
    if (!resetPassword) {
      setError("Enter or generate a temporary password first.");
      return;
    }
    const ok = await updateUser(email, { new_password: resetPassword });
    if (ok) {
      setResetEmail(null);
      setResetPassword("");
      setCopied(false);
    }
  }

  return (
    <div className="admin-users-wrap">
      <div className="admin-users-toolbar">
        <label className="search-field admin-user-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by name, email, or role…"
            aria-label="Search registered users"
          />
        </label>
        <div className="segmented" role="group" aria-label="Filter users">
          {(
            [
              ["all", `All (${users.length})`],
              ["approved", "Approved"],
              ["suspended", "Suspended"],
              ["admins", "Admins"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={tab === value ? "on" : ""}
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="form-success" role="status">
          <CheckCircle2 size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />
          {notice}
        </p>
      )}

      {filtered.length ? (
        <div className="admin-users-list">
          {filtered.map((user) => {
            const isSelf = user.email.toLowerCase() === currentAdminEmail.toLowerCase();
            const isBusy = busyEmail === user.email;
            const isSuspended = user.auth_status === "suspended";
            const isResetOpen = resetEmail === user.email;
            const lastSeen = user.last_login_at
              ? formatCampusDate(user.last_login_at, { dateStyle: "medium", timeStyle: "short" })
              : user.created_at
                ? formatCampusDate(user.created_at, { dateStyle: "medium" })
                : "Unknown";

            return (
              <div className="admin-user-entry" key={user.email}>
                <div className="admin-row admin-user-row">
                  <div className="admin-user-info">
                    <div className="admin-user-headline">
                      <b>{user.name || "Campus member"}</b>
                      <span className={`user-status-chip ${isSuspended ? "suspended" : "approved"}`}>
                        {isSuspended ? "Suspended" : "Approved"}
                      </span>
                      {user.role === "admin" && (
                        <span className="user-role-badge">
                          <ShieldCheck size={11} /> Admin
                        </span>
                      )}
                      {isSelf && <span className="user-self-tag">You</span>}
                    </div>
                    <small>
                      {user.email} · Last active: {lastSeen}
                    </small>
                  </div>

                  <div className="admin-user-controls">
                    <label className="sr-only" htmlFor={`role-${user.email}`}>
                      Role for {user.email}
                    </label>
                    <select
                      id={`role-${user.email}`}
                      className="admin-role-select"
                      value={user.role}
                      disabled={isBusy || isSelf}
                      onChange={(e) => updateUser(user.email, { role: e.target.value as CampusRole })}
                    >
                      {campusRoles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className={`button button-outline${isResetOpen ? " active-control" : ""}`}
                      disabled={isBusy}
                      aria-expanded={isResetOpen}
                      onClick={() => openPasswordReset(user.email)}
                    >
                      <KeyRound size={14} /> Reset password
                    </button>

                    {isSuspended ? (
                      <button
                        type="button"
                        className="button button-outline"
                        disabled={isBusy || isSelf}
                        onClick={() => updateUser(user.email, { auth_status: "approved" })}
                      >
                        <UserCheck size={14} /> Approve
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button-outline decline"
                        disabled={isBusy || isSelf}
                        onClick={() =>
                          updateUser(user.email, {
                            auth_status: "suspended",
                            reason: "Suspended from Admin Portal",
                          })
                        }
                      >
                        <UserX size={14} /> Suspend
                      </button>
                    )}
                  </div>
                </div>

                {isResetOpen && (
                  <div className="admin-password-reset-panel">
                    <div className="admin-password-reset-head">
                      <span>
                        Set a temporary password for <b>{user.email}</b>
                      </span>
                      <button
                        type="button"
                        className="admin-reset-close"
                        onClick={() => {
                          setResetEmail(null);
                          setResetPassword("");
                        }}
                        aria-label="Close password reset"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="admin-password-reset-row">
                      <div className="password-field-wrap admin-reset-input-wrap">
                        <input
                          type={showResetPassword ? "text" : "password"}
                          value={resetPassword}
                          onChange={(e) => {
                            setResetPassword(e.target.value);
                            setCopied(false);
                          }}
                          disabled={isBusy}
                          placeholder="Temporary password (8+ chars, mixed case, digit, symbol)"
                          aria-label={`Temporary password for ${user.email}`}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowResetPassword((prev) => !prev)}
                          aria-label={showResetPassword ? "Hide temporary password" : "Show temporary password"}
                          disabled={isBusy}
                        >
                          {showResetPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>

                      <button
                        type="button"
                        className="button button-outline"
                        disabled={isBusy}
                        onClick={() => {
                          setResetPassword(generateStrongPassword());
                          setCopied(false);
                        }}
                      >
                        <RefreshCw size={14} /> Generate
                      </button>

                      <button
                        type="button"
                        className="button button-outline"
                        disabled={isBusy || !resetPassword}
                        onClick={copyResetPassword}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
                      </button>

                      <button
                        type="button"
                        className="button button-teal"
                        disabled={isBusy || !resetPassword}
                        onClick={() => saveResetPassword(user.email)}
                      >
                        <KeyRound size={14} /> {isBusy ? "Saving…" : "Save password"}
                      </button>
                    </div>
                    <small className="admin-password-reset-hint">
                      Copy this temporary password before saving, then share it with the member so they can sign in and change it in Settings.
                    </small>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="inline-empty">
          {users.length ? "No users match that filter." : "No registered users yet."}
        </div>
      )}
    </div>
  );
}
