import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ClaimWorkspace, type ClaimMessage, type ClaimStatusEvent } from "@/components/claim-workspace";
import { MemberGate } from "@/components/member-gate";
import { getMember } from "@/lib/access";
import { getDb } from "@/lib/mongodb";

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, approved } = await getMember();
  if (!approved || !user) return <MemberGate />;

  const { id } = await params;
  const db = await getDb();
  const claim = await db.collection("claims").findOne({ _id: id });
  if (!claim) notFound();
  const item = await db.collection("reports").findOne({ _id: claim.report_id });
  if (!item || ![claim.claimant_id, item.reporter_id].includes(user.id)) notFound();

  const [messages, history] = await Promise.all([
    db.collection("messages").find({ claim_id: id }).sort({ created_at: 1 }).toArray(),
    db.collection("claim_status_history").find({ claim_id: id }).sort({ created_at: 1 }).toArray(),
  ]);
  const toIso = (value: unknown) =>
    value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : typeof value === "string" ? value : "";

  const handover = claim.handover ? {
    location: String(claim.handover.location ?? ""),
    date: String(claim.handover.date ?? ""),
    time_window: String(claim.handover.time_window ?? ""),
    note: typeof claim.handover.note === "string" ? claim.handover.note : undefined,
    proposed_by_you: claim.handover.proposed_by === user.id,
    proposed_at: toIso(claim.handover.proposed_at),
    confirmed: Boolean(claim.handover.confirmed_by),
    confirmed_at: claim.handover.confirmed_at ? toIso(claim.handover.confirmed_at) : null,
  } : undefined;

  const publicMessages: ClaimMessage[] = messages.map((message) => ({
    id: String(message._id),
    isMine: message.sender_id === user.id,
    body: String(message.body),
    created_at: toIso(message.created_at),
  }));
  const publicHistory: ClaimStatusEvent[] = history.map((event) => ({
    id: String(event._id),
    old_state: event.old_state ? String(event.old_state) : null,
    new_state: String(event.new_state),
    note: event.note ? String(event.note) : null,
    created_at: toIso(event.created_at),
  }));

  return (
    <main className="page-wrap claim-detail-page">
      <div className="page-topline">
        <Link href="/dashboard" className="back-link"><ArrowLeft size={15} /> My activity</Link>
        <span className="privacy-tag"><ShieldCheck size={14} /> Private claim</span>
      </div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{item.kind} item claim</span>
          <h1>{item.title}</h1>
          <p>{item.location} · Messages are visible to the claimant and reporter.</p>
        </div>
      </div>
      <ClaimWorkspace
        claimId={id}
        reportId={String(item._id)}
        itemTitle={String(item.title)}
        isOwner={item.reporter_id === user.id}
        state={claim.state}
        details={claim.ownership_details}
        handover={handover}
        messages={publicMessages}
        statusHistory={publicHistory}
      />
    </main>
  );
}
