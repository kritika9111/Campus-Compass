"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

type Note = { id: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string };

export function NotificationsList({ items }: { items: Note[] }) {
  const [rows, setRows] = useState(items);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setRows(items);
  }, [items]);

  async function mark(id: string) {
    if (busyId === id) return;
    setBusyId(id);
    try {
      const r = await fetch("/api/member", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "notification_read", id }),
      });
      if (r.ok) {
        setRows((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
      }
    } catch {
      // Ignore transient network errors; user can retry marking as read.
    } finally {
      setBusyId(null);
    }
  }

  return rows.length ? (
    <div>
      {rows.slice(0, 5).map((n) => (
        <div className="notification-row" key={n.id}>
          <span className={n.read_at ? "notification-dot read" : "notification-dot"} />
          <span className="notification-copy">
            {n.href ? (
              <Link href={n.href}>
                <b>{n.title}</b>
                <small>{n.body}</small>
              </Link>
            ) : (
              <>
                <b>{n.title}</b>
                <small>{n.body}</small>
              </>
            )}
          </span>
          {!n.read_at && (
            <button
              type="button"
              className="mark-read"
              disabled={busyId === n.id}
              onClick={() => mark(n.id)}
              aria-label={`Mark ${n.title} as read`}
            >
              <Check size={13} />
            </button>
          )}
        </div>
      ))}
    </div>
  ) : (
    <div className="inline-empty"><p>You’re all caught up.</p></div>
  );
}
