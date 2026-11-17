"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Check, Eye, EyeOff, LoaderCircle, LogIn, UserPlus } from "lucide-react";

type Mode = "signin" | "signup";

export function MemberAuthForm({
  redirectTo = "/dashboard",
  disabled = false,
}: {
  redirectTo?: string;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const rules = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Uppercase (A-Z)", met: /[A-Z]/.test(password) },
    { label: "Lowercase (a-z)", met: /[a-z]/.test(password) },
    { label: "Number (0-9)", met: /[0-9]/.test(password) },
    { label: "Special symbol", met: /[^a-zA-Z0-9]/.test(password) },
  ];

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || busy) return;
    setBusy(true);
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === "signup") {
        const registerRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: normalizedEmail,
            password,
          }),
        });
        const registerBody = await registerRes.json().catch(() => null) as { ok?: boolean; error?: string } | null;
        if (!registerRes.ok || !registerBody?.ok) {
          setError(registerBody?.error || "Could not create your account.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        if (result?.code === "AccountSuspended") {
          setError("Your account has been suspended by a Campus Compass administrator. Contact support for help.");
        } else {
          setError(
            mode === "signup"
              ? "Account created, but automatic sign-in failed. Please sign in with your new credentials."
              : "Invalid email or password. If you signed up with Google, use Continue with Google below.",
          );
        }
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="member-auth-box">
      <div className="form-tabs auth-mode-tabs" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={mode === "signin" ? "selected" : ""}
          onClick={() => switchMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "selected" : ""}
          onClick={() => switchMode("signup")}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        {mode === "signup" && (
          <label className="field">
            Full name
            <input
              type="text"
              name="fullName"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              disabled={disabled || busy}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Mohit Singh"
            />
          </label>
        )}

        <label className="field">
          Email address
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={disabled || busy}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
          />
        </label>

        <label className="field">
          Password
          <div className="password-field-wrap">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? 8 : 1}
              maxLength={256}
              disabled={disabled || busy}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Create a strong password" : "Enter your password"}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={disabled || busy}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {mode === "signup" && (
            <div className="password-rules-list" aria-live="polite">
              {rules.map((rule) => (
                <span key={rule.label} className={rule.met ? "rule-met" : ""}>
                  <Check size={11} /> {rule.label}
                </span>
              ))}
            </div>
          )}
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button button-teal" disabled={disabled || busy}>
          {busy ? (
            <>
              <LoaderCircle size={15} className="spin" />
              {mode === "signup" ? "Creating account…" : "Signing in…"}
            </>
          ) : mode === "signup" ? (
            <>
              <UserPlus size={15} /> Create account &amp; sign in
            </>
          ) : (
            <>
              <LogIn size={15} /> Sign in with Email
            </>
          )}
        </button>
      </form>
    </div>
  );
}
