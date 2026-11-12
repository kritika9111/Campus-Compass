"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, RotateCcw } from "lucide-react";

type Report = { id: string; title: string; kind: string; location: string; state: string; created_at: string; reporter_id: string };

export function AdminModeration({ items }: { items: Report[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function moderate(item: Report, nextState: "open" | "hidden") {
    setBusy(item.id);
    setError("");
    const response=await fetch(`/api/reports/${item.id}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"moderate",state:nextState,reason:"Reviewed by campus moderator"})});
    if (!response.ok) {
      setError("Could not update that report. Please check your administrator access and try again.");
    } else {
      router.refresh();
    }
    setBusy(null);
  }

  return <>
    {error && <p className="form-error" role="alert">{error}</p>}
    {items.length ? items.map((item) => <div className="admin-row" key={item.id}>
      <div><b>{item.title}</b><small>{item.kind} · {item.location} · {item.state}</small></div>
      {item.state === "hidden"
        ? <button className="button button-outline" disabled={busy === item.id} onClick={() => moderate(item, "open")}><RotateCcw size={14} />Restore</button>
        : <button className="button button-outline" disabled={busy === item.id} onClick={() => moderate(item, "hidden")}><EyeOff size={14} />Hide report</button>}
    </div>) : <div className="inline-empty">No reports to review.</div>}
  </>;
}

