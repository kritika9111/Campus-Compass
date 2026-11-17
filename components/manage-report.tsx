"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, PencilLine } from "lucide-react";

export function ManageReport({ id, state, activeClaimId }: { id: string; state: string; activeClaimId?: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function update(action: "close") {
    setBusy(true);
    setNote("");
    setError("");
    try {
      const response = await fetch(`/api/reports/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        setError(result?.error || "Could not update the report. Please retry.");
      } else {
        setNote("Report closed.");
        router.refresh();
      }
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const canEdit = !["claim_pending", "handover", "returned", "closed", "hidden"].includes(state);
  const claimHref = activeClaimId ? `/claims/${activeClaimId}` : "/dashboard";
  return <div className="manage-report">
    {canEdit && <Link className="button button-outline full-button" href={`/items/${id}/edit`}><PencilLine size={15} />Edit report</Link>}
    {state === "claim_pending" && <Link className="button button-teal full-button" href={claimHref}><Check size={15} />Review private claim</Link>}
    {state === "handover" && <Link className="button button-teal full-button" href={claimHref}><Check size={15} />Finish handover in claim</Link>}
    {state !== "returned" && state !== "closed" && state !== "hidden" && state !== "handover" && state !== "claim_pending" && <button type="button" className="button subtle-button full-button" disabled={busy} onClick={() => update("close")}>Close report</button>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {note && <p className="form-success" role="status">{note}</p>}
  </div>;
}
