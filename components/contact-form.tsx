"use client";

import { useState, type FormEvent } from "react";
import { CircleCheck, Send } from "lucide-react";

const categories = ["Lost Item", "Found Item", "Account/Login Issue", "Technical Issue", "Report Inappropriate Content", "General Enquiry"];

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "We could not send your message."); return; }
      setTicket(result.ticketId); setEmailSent(Boolean(result.emailSent)); form.reset();
    } catch { setError("Connection problem. Please check your internet and try again."); }
    finally { setBusy(false); }
  }

  if (ticket) return <div className="contact-success" role="status"><CircleCheck size={27}/><h2>Message received</h2><p>Your ticket number is <strong>{ticket}</strong>. Keep it for reference.</p><p>{emailSent ? "Our support team has been notified." : "Your message is saved. Email notifications are currently unavailable, but the team can review it in the admin inbox."}</p><button className="button button-outline" onClick={() => setTicket("")}>Send another message</button></div>;

  return <form onSubmit={submit} className="contact-form">
    <div className="contact-fields">
      <label className="field">Your name<input name="name" autoComplete="name" required minLength={2} maxLength={100}/></label>
      <label className="field">College email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
      <label className="field">What can we help with?<select name="category" defaultValue="" required><option value="" disabled>Select a category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="field">Subject<input name="subject" required minLength={3} maxLength={120}/></label>
      <label className="field contact-message-field">Message<textarea name="message" required minLength={10} maxLength={3000} rows={6} placeholder="Include the details that will help us look into this."/></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="contact-privacy">We use your details only to respond to this request. Please don’t include passwords or sensitive account credentials.</p>
    <button className="button button-teal" type="submit" disabled={busy}><Send size={15}/>{busy ? "Sending…" : "Send message"}</button>
  </form>;
}
