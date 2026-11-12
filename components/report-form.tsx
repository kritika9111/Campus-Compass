"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { categories } from "@/lib/types";
import { reportInput } from "@/lib/validation";
import { toLocalDateTimeInputValue } from "@/lib/datetime";
import { Upload, ImagePlus, LoaderCircle } from "lucide-react";

type ReportResponse = { id?: string; error?: string };

export function ReportForm({ previewOnly = false }: { previewOnly?: boolean }) {
  const [kind, setKind] = useState<"lost" | "found">("lost");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [maxDate, setMaxDate] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => setMaxDate(toLocalDateTimeInputValue(new Date())), []);

  const photoPreviews = useMemo(
    () => selectedPhotos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [selectedPhotos],
  );
  useEffect(() => () => photoPreviews.forEach(({ url }) => URL.revokeObjectURL(url)), [photoPreviews]);

  function setPhotoFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next = Array.from(fileList);
    if (next.length > 4) {
      setSelectedPhotos([]);
      if (fileInput.current) fileInput.current.value = "";
      setError("Choose up to 4 photos.");
      return;
    }
    if (next.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setSelectedPhotos([]);
      if (fileInput.current) fileInput.current.value = "";
      setError("Use JPG, PNG or WebP images up to 5 MB each.");
      return;
    }
    setError("");
    setSelectedPhotos(next);
    if (fileInput.current) {
      const transfer = new DataTransfer();
      next.forEach((file) => transfer.items.add(file));
      fileInput.current.files = transfer.files;
    }
  }

  function removePhoto(index: number) {
    const next = selectedPhotos.filter((_, current) => current !== index);
    setSelectedPhotos(next);
    if (fileInput.current) {
      const transfer = new DataTransfer();
      next.forEach((file) => transfer.items.add(file));
      fileInput.current.files = transfer.files;
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (previewOnly || busy) return;
    setError("");
    setBusy(true);

    const values = new FormData(event.currentTarget);
    const happenedAt = new Date(String(values.get("date") ?? ""));
    if (Number.isNaN(happenedAt.getTime())) {
      setError("Choose a valid date and time for the item.");
      setBusy(false);
      return;
    }

    try {
      const parsed = reportInput.safeParse({
        kind,
        title: values.get("title"),
        category: values.get("category"),
        description: values.get("description"),
        location: values.get("location"),
        happened_at: happenedAt.toISOString(),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the report details and try again.");

      const files = values.getAll("photos").filter((file): file is File => file instanceof File && file.size > 0);
      if (files.length > 4) throw new Error("Choose up to 4 photos.");
      if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
        throw new Error("Use JPG, PNG or WebP images up to 5 MB each.");
      }

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json().catch(() => null) as ReportResponse | null;
      if (!response.ok || !result?.id) throw new Error(result?.error ?? "The report could not be saved. Please try again.");

      let photoUploadFailed = false;
      for (let index = 0; index < files.length; index++) {
        setProgress(`Uploading photo ${index + 1} of ${files.length}…`);
        const file = files[index];
        const photoBody=new FormData(); photoBody.set("file",file);
        const photoResponse=await fetch(`/api/reports/${result.id}/photos`,{method:"POST",body:photoBody});
        if (!photoResponse.ok) {
          photoUploadFailed = true;
          break;
        }
      }

      const query = new URLSearchParams({ kind, created: "1" });
      if (photoUploadFailed) query.set("photos", "unavailable");
      router.push(`/find?${query.toString()}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t submit this report. Check your connection and try again.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <form className="report-form" onSubmit={submit}>
      <div className="form-tabs" role="tablist" aria-label="Report type">
        <button type="button" role="tab" aria-selected={kind === "lost"} className={kind === "lost" ? "selected" : ""} onClick={() => setKind("lost")}>I lost an item</button>
        <button type="button" role="tab" aria-selected={kind === "found"} className={kind === "found" ? "selected" : ""} onClick={() => setKind("found")}>I found an item</button>
      </div>
      <input type="hidden" name="kind" value={kind} />
      <p className="form-intro">{kind === "lost" ? "Tell the campus community what you’re missing. Your contact details stay private." : "Help a campus belonging find its owner. Please leave identifying details private."}</p>
      <div className="form-grid">
        <label className="field">Item name <span>*</span><input name="title" required minLength={3} maxLength={100} placeholder={kind === "lost" ? "e.g. Navy student ID holder" : "e.g. Stainless water bottle"} /></label>
        <label className="field">Category <span>*</span><select name="category" required defaultValue=""><option value="" disabled>Select a category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className="field">Campus location <span>*</span><input name="location" required minLength={2} maxLength={160} placeholder="Block, building, library, food court…" /></label>
        <label className="field">{kind === "lost" ? "When did you last have it?" : "When did you find it?"} <span>*</span><input name="date" type="datetime-local" required max={maxDate} /></label>
        <label className="field field-full">Public description <span>*</span><textarea name="description" required minLength={10} maxLength={1200} rows={4} placeholder="Describe visible details such as colour, brand or condition. Leave one identifying detail out so the owner can verify it privately." /></label>
        <div className="field-full">
          <label className={`upload-zone${dragging ? " dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); setPhotoFiles(event.dataTransfer.files); }}>
            <ImagePlus size={23} /><strong>Add item photos</strong><span>Drop photos here or choose from your device</span><small>Optional · JPG, PNG or WebP · up to 5 MB each · 4 photos maximum</small>
            <input ref={fileInput} name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setPhotoFiles(event.target.files)} aria-label="Choose item photos" />
          </label>
          {selectedPhotos.length > 0 && <div className="photo-preview-list" aria-label="Selected photos">{photoPreviews.map(({ file, url }, index) => <div key={`${file.name}-${file.lastModified}`} className="photo-preview"><Image src={url} alt={`Preview of ${file.name}`} width={42} height={42} unoptimized /><span>{file.name}</span><button type="button" onClick={() => removePhoto(index)} aria-label={`Remove ${file.name}`}>Remove</button></div>)}</div>}
        </div>
      </div>
      <div className="privacy-note"><span>◈</span><p><b>Keep it private.</b> Don’t include phone numbers, student IDs or sensitive details in the public description. You can verify a claim privately.</p></div>
      {previewOnly && <p className="preview-form-note" role="status">Preview only. Configure MongoDB and Google sign-in to publish.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {previewOnly ? <button type="button" className="button button-teal submit-report" disabled><Upload size={17} />Configure backend to publish</button> : <button className="button button-teal submit-report" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} />{progress || "Submitting…"}</> : <><Upload size={17} />Publish {kind} report</>}</button>}
      <p className="fine-print">By posting, you agree to keep conversations respectful and arrange handovers in a public campus location.</p>
    </form>
  );
}
