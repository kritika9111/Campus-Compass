"use client";

import { useState, type FormEvent } from "react";
import { CircleCheck, Send } from "lucide-react";
import { contactCategories, contactPartyRoles } from "@/lib/validation";

export type ContactFormDefaults = {
  name?: string;
  email?: string;
  partyRole?: string;
  category?: string;
  reportId?: string;
  claimId?: string;
  subject?: string;
};

export function ContactForm({ defaults = {} }: { defaults?: ContactFormDefaults }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const initialCategory = defaults.category && (contactCategories as readonly string[]).includes(defaults.category)
    ? defaults.category
    : "";
  const initialRole = defaults.partyRole && (contactPartyRoles as readonly string[]).includes(defaults.partyRole)
    ? defaults.partyRole
    : "General member";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json().catch(() => null) as { ticketId?: string; emailSent?: boolean; error?: string } | null;
      if (!response.ok || !result?.ticketId) {
        setError(result?.error || "We could not send your message.");
        return;
      }
      setTicket(result.ticketId);
      setEmailSent(Boolean(result.emailSent));
      form.reset();
    } catch {
      setError("Connection problem. Please check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (ticket) {
    return (
      <div className="contact-success" role="status">
        <CircleCheck size={27} />
        <h2>Message received by Admin</h2>
        <p>
          Your ticket number is <strong>{ticket}</strong>. Keep it for reference.
        </p>
        <p>
          {emailSent
            ? "Your message is in the Admin Portal inbox and our support team has been emailed."
            : "Your message has been delivered to the Admin Portal inbox so an administrator can review and resolve it."}
        </p>
        <button type="button" className="button button-outline" onClick={() => setTicket("")}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="contact-form">
      <div className="contact-fields">
        <label className="field">
          Your name
          <input name="name" autoComplete="name" required minLength={2} maxLength={100} defaultValue={defaults.name || ""} />
        </label>
        <label className="field">
          College email
          <input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={defaults.email || ""} />
        </label>
        <label className="field">
          I am the…
          <select name="party_role" defaultValue={initialRole}>
            {contactPartyRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          What can we help with?
          <select name="category" defaultValue={initialCategory} required>
            <option value="" disabled>Select a category</option>
            {contactCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="field contact-message-field">
          Subject
          <input
            name="subject"
            required
            minLength={3}
            maxLength={120}
            defaultValue={defaults.subject || ""}
            placeholder="e.g. Finder refuses to return my lost calculator / Claimant dispute"
          />
        </label>
        <label className="field">
          Related Item ID (optional)
          <input
            name="report_id"
            maxLength={64}
            defaultValue={defaults.reportId || ""}
            placeholder="Auto-filled if opened from an item"
          />
        </label>
        <label className="field">
          Related Claim ID (optional)
          <input
            name="claim_id"
            maxLength={64}
            defaultValue={defaults.claimId || ""}
            placeholder="Auto-filled if opened from a claim"
          />
        </label>
        <label className="field contact-message-field">
          Message
          <textarea
            name="message"
            required
            minLength={10}
            maxLength={3000}
            rows={6}
            placeholder="Explain what happened, the item details, and how the admin can help resolve the disagreement."
          />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="contact-privacy">
        Messages go directly to the Campus Compass Admin Portal inbox. Please don’t include passwords or sensitive account credentials.
      </p>
      <button className="button button-teal" type="submit" disabled={busy}>
        <Send size={15} />
        {busy ? "Sending…" : "Send message to Admin"}
      </button>
    </form>
  );
}
