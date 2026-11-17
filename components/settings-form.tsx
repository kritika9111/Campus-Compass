"use client";
import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";

export function SettingsForm({ claims, updates }: { claims: boolean; updates: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/member", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "preferences",
          notification_preferences: { claims: fd.has("claims"), updates: fd.has("updates") },
        }),
      });
      if (r.ok) {
        setMessage("Preferences saved.");
      } else {
        setError("We couldn’t save your preferences.");
      }
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="settings-form">
      <label className="setting-row">
        <span><b>Claim activity</b><small>When someone sends or responds to a claim on your report.</small></span>
        <input type="checkbox" name="claims" defaultChecked={claims} />
      </label>
      <label className="setting-row">
        <span><b>Report updates</b><small>Important status changes for your reports and claims.</small></span>
        <input type="checkbox" name="updates" defaultChecked={updates} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <button className="button button-teal" disabled={busy}><Save size={15} />{busy ? "Saving…" : "Save preferences"}</button>
    </form>
  );
}

