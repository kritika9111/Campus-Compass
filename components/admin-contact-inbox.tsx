"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, Save } from "lucide-react";
import { formatCampusDate } from "@/lib/datetime";

export type AdminContactMessage = {
  id: string;
  ticket_id: string;
  name: string;
  email: string;
  party_role: string;
  category: string;
  report_id: string;
  claim_id: string;
  subject: string;
  message: string;
  status: string;
  admin_note: string;
  created_at: string;
};

const statuses = ["Pending", "In Progress", "Resolved"] as const;
type FilterTab = "all" | "disputes" | "Pending" | "In Progress" | "Resolved";

export function AdminContactInbox({ items }: { items: AdminContactMessage[] }) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.admin_note || ""])),
  );
  const [error, setError] = useState("");
  const [savedTicket, setSavedTicket] = useState("");
  const router = useRouter();

  const disputesCount = useMemo(
    () => items.filter((item) => item.category.startsWith("Handover Dispute")).length,
    [items],
  );

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (tab === "disputes") return item.category.startsWith("Handover Dispute");
      if (tab === "all") return true;
      return item.status === tab;
    });
  }, [items, tab]);

  async function update(item: AdminContactMessage, status: string, includeNote = false) {
    setBusy(item.id);
    setError("");
    setSavedTicket("");
    try {
      const payload: { status: string; admin_note?: string } = { status };
      if (includeNote) payload.admin_note = notes[item.id] ?? "";
      const response = await fetch(`/api/admin/contact/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        setError(result?.error || "Could not update the message status. Check administrator access and try again.");
        return;
      }
      setSavedTicket(item.ticket_id);
      router.refresh();
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="admin-users-toolbar" style={{ marginBottom: 14 }}>
        <div className="segmented" role="group" aria-label="Filter support messages">
          {(
            [
              ["all", `All (${items.length})`],
              ["disputes", `Disputes (${disputesCount})`],
              ["Pending", "Pending"],
              ["In Progress", "In Progress"],
              ["Resolved", "Resolved"],
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

      {error && <p className="form-error" role="alert">{error}</p>}
      {savedTicket && (
        <p className="form-success" role="status">
          <CheckCircle2 size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />
          Updated ticket {savedTicket}.
        </p>
      )}

      {filtered.length ? (
        <div className="contact-inbox">
          {filtered.map((item) => {
            const isDispute = item.category.startsWith("Handover Dispute");
            const currentStatus = statuses.includes(item.status as (typeof statuses)[number]) ? item.status : "Pending";
            const noteValue = notes[item.id] ?? item.admin_note ?? "";

            return (
              <article className={`contact-inbox-item${isDispute ? " dispute-ticket" : ""}`} key={item.id}>
                <div className="contact-inbox-top">
                  <div>
                    <div className="contact-ticket-badges">
                      <span className="eyebrow">{item.ticket_id} · {item.category}</span>
                      {isDispute && (
                        <span className="user-status-chip suspended">
                          <AlertTriangle size={11} /> Handover dispute
                        </span>
                      )}
                      {item.party_role && item.party_role !== "General member" && (
                        <span className="user-role-badge">{item.party_role}</span>
                      )}
                    </div>
                    <h3>{item.subject}</h3>
                    <p>
                      <a href={`mailto:${encodeURIComponent(item.email)}`}>
                        {item.name} · {item.email}
                      </a>
                    </p>
                    {(item.report_id || item.claim_id) && (
                      <div className="contact-ref-links">
                        {item.report_id && (
                          <Link href={`/items/${encodeURIComponent(item.report_id)}`} className="text-link">
                            Inspect item ({item.report_id.slice(0, 8)}…) <ExternalLink size={12} />
                          </Link>
                        )}
                        {item.claim_id && (
                          <Link href={`/claims/${encodeURIComponent(item.claim_id)}`} className="text-link">
                            Open claim ({item.claim_id.slice(0, 8)}…) <ExternalLink size={12} />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                  <label className="field contact-status-field">
                    Status
                    <select
                      aria-label={`Status for ${item.ticket_id}`}
                      value={currentStatus}
                      disabled={busy === item.id}
                      onChange={(event) => update(item, event.target.value)}
                    >
                      {statuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <p className="contact-inbox-message">{item.message}</p>

                <div className="admin-note-row">
                  <input
                    type="text"
                    className="admin-note-input"
                    value={noteValue}
                    maxLength={1000}
                    disabled={busy === item.id}
                    onChange={(event) => setNotes((prev) => ({ ...prev, [item.id]: event.target.value }))}
                    placeholder="Add admin resolution note (notifies sender when registered)…"
                    aria-label={`Admin resolution note for ${item.ticket_id}`}
                  />
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={busy === item.id}
                    onClick={() => update(item, currentStatus, true)}
                  >
                    <Save size={13} /> Save note
                  </button>
                </div>

                <small>{formatCampusDate(item.created_at, { dateStyle: "medium", timeStyle: "short" })}</small>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="inline-empty">
          {items.length ? "No messages match that filter." : "No contact messages yet."}
        </div>
      )}
    </>
  );
}
