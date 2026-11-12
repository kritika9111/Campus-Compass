"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { HandHelping, X, LoaderCircle, ShieldCheck } from "lucide-react";

const EVIDENCE_CATEGORIES = [
  "Distinctive physical mark / wear / sticker",
  "Private contents / accessory detail",
  "Partial serial or model detail (never full numbers)",
  "Purchase evidence description (no personal documents)",
  "Custom engraving / wallpaper / lock-screen detail",
  "Other distinctive ownership proof",
];

export function ClaimButton({ reportId, disabled = false }: { reportId: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [evidenceType, setEvidenceType] = useState(EVIDENCE_CATEGORIES[0]);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const rawDetails = String(new FormData(form).get("details") ?? "").trim();

    if (rawDetails.length < 8) {
      setError("Please describe the identifying detail in at least 8 characters.");
      setBusy(false);
      return;
    }

    const formattedDetails = `[Proof Category: ${evidenceType}]\n${rawDetails}`;

    try {
      const response = await fetch("/api/claims", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report_id: reportId, ownership_details: formattedDetails }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not send your claim.");
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send your claim.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="button button-teal claim-button" disabled={disabled} onClick={() => setOpen(true)}>
        <HandHelping size={17} /> This could be mine
      </button>

      {open && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section className="claim-modal" role="dialog" aria-modal="true" aria-labelledby="claim-title">
            <button className="round-button modal-close" onClick={() => setOpen(false)} aria-label="Close">
              <X size={16} />
            </button>

            <span className="eyebrow">
              <ShieldCheck size={14} /> Private Ownership Verification
            </span>
            <h2 id="claim-title">Submit private proof of ownership</h2>
            <p>
              Share a detail that was deliberately withheld from the public listing—such as a scratch, sticker, engraving,
              or what was inside. The reporter reviews it manually; a match suggestion does not prove ownership. This is
              strictly confidential between you and the reporter.
            </p>

            <form onSubmit={submit}>
              <label className="field">
                Type of ownership evidence
                <div className="select-wrap">
                  <select
                    value={evidenceType}
                    onChange={(e) => setEvidenceType(e.target.value)}
                    className="evidence-select"
                  >
                    {EVIDENCE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="field">
                Specific identifying details <span>*</span>
                <textarea
                  name="details"
                  required
                  minLength={8}
                  maxLength={900}
                  rows={4}
                  placeholder="e.g. Has a small cyan sticker on the bottom-right corner, and contains a Sandisk 64GB drive inside..."
                />
              </label>

              <div className="privacy-badge-note">
                <ShieldCheck size={14} />
                <span>Never share full ID or serial numbers, passwords, OTPs, financial details, or personal documents.</span>
              </div>

              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}

              <button className="button button-teal submit-claim-btn" disabled={busy}>
                {busy ? (
                  <>
                    <LoaderCircle size={16} className="spin" /> Sending private claim…
                  </>
                ) : (
                  "Send private claim for review"
                )}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
