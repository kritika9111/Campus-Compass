"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ContactMessage = { id: string; ticket_id: string; name: string; email: string; category: string; subject: string; message: string; status: string; created_at: string };
const statuses = ["Pending", "In Progress", "Resolved"] as const;

export function AdminContactInbox({ items }: { items: ContactMessage[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  async function update(id: string, status: string) {
    setBusy(id); setError("");
    try {
      const response = await fetch(`/api/admin/contact/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) { setError("Could not update the message status. Check administrator access and try again."); return; }
      router.refresh();
    } catch { setError("Connection problem. Please try again."); }
    finally { setBusy(null); }
  }
  return <>
    {error && <p className="form-error" role="alert">{error}</p>}
    {items.length ? <div className="contact-inbox">{items.map((item) => <article className="contact-inbox-item" key={item.id}>
      <div className="contact-inbox-top"><div><span className="eyebrow">{item.ticket_id} · {item.category}</span><h3>{item.subject}</h3><p><a href={`mailto:${encodeURIComponent(item.email)}`}>{item.name} · {item.email}</a></p></div><label className="field contact-status-field">Status<select aria-label={`Status for ${item.ticket_id}`} value={statuses.includes(item.status as (typeof statuses)[number]) ? item.status : "Pending"} disabled={busy === item.id} onChange={(event) => update(item.id, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label></div>
      <p className="contact-inbox-message">{item.message}</p><small>{new Date(item.created_at).toLocaleString()}</small>
    </article>)}</div> : <div className="inline-empty">No contact messages yet.</div>}
  </>;
}
