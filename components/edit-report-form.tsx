"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { campusDesks, categories, type ItemCategory, type ItemStatus } from "@/lib/types";
import { toLocalDateTimeInputValue } from "@/lib/datetime";
import { Building2, Save } from "lucide-react";

export function EditReportForm({
  item,
}: {
  item: {
    id: string;
    kind: ItemStatus;
    title: string;
    category: ItemCategory;
    description: string;
    location: string;
    happened_at: string;
    dropped_off_desk?: string;
  };
}) {
  const initialDesk = item.dropped_off_desk || "";
  const isKnownDesk = (campusDesks as readonly string[]).includes(initialDesk);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [droppedAtDesk, setDroppedAtDesk] = useState(Boolean(initialDesk));
  const [selectedDesk, setSelectedDesk] = useState<string>(isKnownDesk ? initialDesk : initialDesk ? "Other campus desk" : campusDesks[0]);
  const [customDesk, setCustomDesk] = useState(isKnownDesk ? "" : initialDesk);
  const router = useRouter();
  useEffect(() => {
    setMaxDate(toLocalDateTimeInputValue(new Date()));
    setDateValue(toLocalDateTimeInputValue(new Date(item.happened_at)));
  }, [item.happened_at]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const happenedAt = new Date(String(data.get("date")));
      if (Number.isNaN(happenedAt.getTime())) throw new Error("Choose a valid date and time.");
      const deskValue = item.kind === "found" && droppedAtDesk
        ? (selectedDesk === "Other campus desk" ? customDesk.trim() : selectedDesk)
        : "";
      if (item.kind === "found" && droppedAtDesk && !deskValue) {
        throw new Error("Enter the campus desk where you handed in the item.");
      }
      const response = await fetch(`/api/reports/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: String(data.get("title")),
          category: String(data.get("category")),
          description: String(data.get("description")),
          location: String(data.get("location")),
          happened_at: happenedAt.toISOString(),
          dropped_off_desk: deskValue,
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "The report could not be saved.");
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
      <label className="field field-full">{item.kind === "lost" ? "When did you last have it?" : "When did you find it?"}<input name="date" type="datetime-local" required max={maxDate} value={dateValue} onFocus={() => setMaxDate(toLocalDateTimeInputValue(new Date()))} onChange={(event) => setDateValue(event.target.value)} /></label>
      <label className="field field-full">Public description<textarea name="description" required minLength={10} maxLength={1200} rows={5} defaultValue={item.description} /></label>
      {item.kind === "found" && (
        <div className="field-full desk-dropoff-box">
          <label className="desk-dropoff-toggle">
            <input
              type="checkbox"
              checked={droppedAtDesk}
              onChange={(event) => setDroppedAtDesk(event.target.checked)}
            />
            <span>
              <b><Building2 size={13} /> Handed in to a staffed campus desk</b>
              <small>Let the owner know which campus desk currently holds this item.</small>
            </span>
          </label>
          {droppedAtDesk && (
            <div className="desk-dropoff-fields">
              <label className="field">
                Staffed campus desk <span>*</span>
                <select value={selectedDesk} onChange={(event) => setSelectedDesk(event.target.value)}>
                  {campusDesks.map((desk) => (
                    <option key={desk} value={desk}>{desk}</option>
                  ))}
                  <option value="Other campus desk">Other campus desk</option>
                </select>
              </label>
              {selectedDesk === "Other campus desk" && (
                <label className="field">
                  Desk / office name <span>*</span>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={customDesk}
                    onChange={(event) => setCustomDesk(event.target.value)}
                    placeholder="e.g. Block 38 Ground Floor Security Desk"
                  />
                </label>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-teal submit-report" disabled={busy}><Save size={16} />{busy ? "Saving…" : "Save changes"}</button>
  </form>;
}
