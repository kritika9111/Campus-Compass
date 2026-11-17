"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";

export function PasswordSettingsForm({ hasPassword }: { hasPassword: boolean }) {
  const [hasExisting, setHasExisting] = useState(hasPassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const rules = [
    { label: "8+ characters", met: newPassword.length >= 8 },
    { label: "Uppercase (A-Z)", met: /[A-Z]/.test(newPassword) },
    { label: "Lowercase (a-z)", met: /[a-z]/.test(newPassword) },
    { label: "Number (0-9)", met: /[0-9]/.test(newPassword) },
    { label: "Special symbol", met: /[^a-zA-Z0-9]/.test(newPassword) },
  ];
  const allRulesMet = rules.every((r) => r.met);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setSuccess("");

    if (hasExisting && !currentPassword) {
      setError("Enter your current password.");
      return;
    }
    if (!allRulesMet) {
      setError("Choose a stronger new password that meets every requirement below.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/member/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: hasExisting ? currentPassword : "",
          newPassword,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        setError(data?.error || "Could not update your password right now.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setHasExisting(true);
      setSuccess(
        data.message ||
          (hasExisting
            ? "Password updated successfully."
            : "Password set. You can now also sign in with email and password."),
      );
      router.refresh();
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="password-settings-form">
      <p className="settings-note">
        {hasExisting
          ? "Update the password you use to sign in with your email address."
          : "You currently sign in with Google. Set a backup password if you also want to sign in with your email and password."}
      </p>

      <div className="password-settings-fields">
        {hasExisting && (
          <label className="field">
            Current password
            <div className="password-field-wrap">
              <input
                type={showCurrent ? "text" : "password"}
                name="currentPassword"
                autoComplete="current-password"
                required
                maxLength={256}
                disabled={busy}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowCurrent((prev) => !prev)}
                aria-label={showCurrent ? "Hide current password" : "Show current password"}
                disabled={busy}
              >
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>
        )}

        <label className="field">
          {hasExisting ? "New password" : "Create password"}
          <div className="password-field-wrap">
            <input
              type={showNew ? "text" : "password"}
              name="newPassword"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              disabled={busy}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Choose a strong password"
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowNew((prev) => !prev)}
              aria-label={showNew ? "Hide new password" : "Show new password"}
              disabled={busy}
            >
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </label>

        <label className="field">
          Confirm new password
          <div className="password-field-wrap">
            <input
              type={showConfirm ? "text" : "password"}
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              disabled={busy}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowConfirm((prev) => !prev)}
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              disabled={busy}
            >
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </label>
      </div>

      <div className="password-rules-list" aria-live="polite">
        {rules.map((rule) => (
          <span key={rule.label} className={rule.met ? "rule-met" : ""}>
            <Check size={11} /> {rule.label}
          </span>
        ))}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="form-success" role="status">
          <CheckCircle2 size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />
          {success}
        </p>
      )}

      <div className="password-settings-actions">
        <button type="submit" className="button button-teal" disabled={busy}>
          {busy ? (
            <>
              <LoaderCircle size={15} className="spin" /> Saving…
            </>
          ) : (
            <>
              <KeyRound size={15} /> {hasExisting ? "Update password" : "Set backup password"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
