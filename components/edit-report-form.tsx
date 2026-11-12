"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { categories, type ItemCategory, type ItemStatus } from "@/lib/types";
import { toLocalDateTimeInputValue } from "@/lib/datetime";
import { Save } from "lucide-react";

export function EditReportForm({ item }: { item: { id: string; kind: ItemStatus; title: string; category: ItemCategory; description: string; location: string; happened_at: string } }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const router = useRouter();
  useEffect(() => setMaxDate(toLocalDateTimeInputValue(new Date())), []);
  const localDate = new Date(item.happened_at);
  const dateValue = toLocalDateTimeInputValue(localDate);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const happenedAt = new Date(String(data.get("date")));
      if (Number.isNaN(happenedAt.getTime())) throw new Error("Choose a valid date and time.");
      const response = await fetch(`/api/reports/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: String(data.get("title")),
          category: String(data.get("category")),
          description: String(data.get("description")),
          location: String(data.get("location")),
          happened_at: happenedAt.toISOString(),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The report could not be saved.");
      router.push(`/items/${item.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The report could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="report-form" onSubmit={submit}>
    <div className="form-grid">
      <label className="field">Item name<input name="title" required minLength={3} maxLength={100} defaultValue={item.title} /></label>
      <label className="field">Category<select name="category" defaultValue={item.category}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="field field-full">Campus location<input name="location" required minLength={2} maxLength={160} defaultValue={item.location} /></label>
      <label className="field field-full">{item.kind === "lost" ? "When did you last have it?" : "When did you find it?"}<input name="date" type="datetime-local" required max={maxDate} defaultValue={dateValue} /></label>
      <label className="field field-full">Public description<textarea name="description" required minLength={10} maxLength={1200} rows={5} defaultValue={item.description} /></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-teal submit-report" disabled={busy}><Save size={16} />{busy ? "Saving…" : "Save changes"}</button>
  </form>;
}
