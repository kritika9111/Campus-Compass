import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { MemberGate } from "@/components/member-gate";
import { ClaimButton } from "@/components/claim-button";
import { ManageReport } from "@/components/manage-report";
import { ReportMatches } from "@/components/report-matches";
import { SaveItemButton } from "@/components/save-item-button";
import { getAdminAccess, getMember } from "@/lib/access";
import { signedPhotoUrl } from "@/lib/cloudinary";
import { formatCampusDate } from "@/lib/datetime";
import { getDb } from "@/lib/mongodb";
import { getPotentialMatchesForReport, publicMatchResults } from "@/lib/matching";
import { states } from "@/lib/types";

function formatReportedAt(value: string | Date) {
  return formatCampusDate(value, { dateStyle: "long", timeStyle: "short" }) || "Date unavailable";
}

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ approved, user, role }, admin] = await Promise.all([getMember(), getAdminAccess()]);
  const isAdmin = role === "admin" || admin.isAdmin;
  if ((!approved || !user) && !isAdmin) return <MemberGate />;

  const { id } = await params;
  const db = await getDb();
  const item = await db.collection("reports").findOne({ _id: id });
  if (!item) notFound();
  const isOwner = Boolean(user && item.reporter_id === user.id);
  if (item.state === "hidden" && !isOwner && !isAdmin) notFound();

  const photoUrls = ((item.photos || []) as Array<{ public_id: string }>)
    .map((photo) => signedPhotoUrl(photo.public_id))
    .filter((url): url is string => Boolean(url));
  const [matches, activeClaim] = await Promise.all([
    isOwner || isAdmin
      ? getPotentialMatchesForReport(id, 35).then(publicMatchResults)
      : Promise.resolve([]),
    isOwner && ["claim_pending", "handover"].includes(String(item.state))
      ? db.collection("claims").findOne(
          { report_id: id, state: { $in: ["pending", "more_info", "accepted", "handover"] } },
          { sort: { created_at: -1 } },
        )
      : Promise.resolve(null),
  ]);
  const { created } = await searchParams;

  return (
    <main className="page-wrap item-detail-wrap">
      <div className="page-topline">
        <Link href="/find" className="back-link"><ArrowLeft size={15} /> Back to reports</Link>
        <span className="privacy-tag"><ShieldCheck size={14} /> Campus report</span>
      </div>
      {created && <div className="success-banner"><ShieldCheck size={18} /> Your report is on the campus board.</div>}
      <article className="detail-card">
        <div className={`detail-cover ${item.kind}`}>
          {photoUrls[0]
            ? <Image src={photoUrls[0]} alt={item.title} fill sizes="(max-width: 650px) 100vw, 75vw" unoptimized />
            : <span className="detail-letter">{item.title.slice(0, 1).toUpperCase()}</span>}
          <span className="status-chip">{item.kind === "lost" ? "Lost item" : "Found item"}</span>
        </div>
        <div className="detail-body">
          <div className="detail-main">
            <div className="detail-top">
              <span className="eyebrow">{item.category} · {states[item.state as keyof typeof states] || item.state}</span>
              <h1>{item.title}</h1>
              <div className="detail-facts">
                <span><MapPin size={15} />{item.location}</span>
                <span><CalendarDays size={15} />{formatReportedAt(item.happened_at)}</span>
              </div>
            </div>
            <div className="detail-description">
              <h2>About this item</h2>
              <p>{item.description}</p>
            </div>
            {item.kind === "found" && typeof item.dropped_off_desk === "string" && item.dropped_off_desk.trim() && (
              <div className="desk-custody-banner" role="note">
                <Building2 size={18} />
                <div>
                  <b>Turned in to a staffed campus desk</b>
                  <p>
                    This item has been deposited at <strong>{item.dropped_off_desk}</strong>. Bring your university ID and identifying ownership details to collect it.
                  </p>
                </div>
              </div>
            )}
            {photoUrls.length > 1 && (
              <div className="photo-strip">
                {photoUrls.slice(1).map((url, index) => (
                  <Image key={url} src={url} alt={`${item.title}, photo ${index + 2}`} width={74} height={65} unoptimized />
                ))}
              </div>
            )}
          </div>
          <aside className="detail-aside">
            <div className="privacy-card">
              <ShieldCheck size={19} />
              <b>Private by design</b>
              <p>Contact details are never shown on the board. Claims are reviewed privately by the person who posted it.</p>
            </div>
            {isOwner
              ? <ManageReport id={id} state={item.state} activeClaimId={activeClaim ? String(activeClaim._id) : undefined} />
              : user
                ? item.kind === "found"
                  ? <ClaimButton reportId={id} disabled={item.state !== "open"} />
                  : <p className="claim-eligibility-note">Ownership claims are available for found items.</p>
                : <Link href="/admin" className="button button-outline full-button">Back to Admin Portal</Link>}
            {user && <SaveItemButton reportId={id} />}
            <Link
              href={`/help?${new URLSearchParams({
                category: item.kind === "found"
                  ? isOwner
                    ? "Handover Dispute — Claimant Issue"
                    : "Handover Dispute — Finder Refuses Return"
                  : "Lost Item",
                role: isOwner
                  ? item.kind === "found" ? "Item finder" : "Lost item owner"
                  : item.kind === "found" ? "Lost item owner" : "Item finder",
                reportId: id,
                subject: `Dispute / help with: ${String(item.title)}`.slice(0, 120),
              }).toString()}`}
              className="button subtle-button full-button"
              style={{ marginTop: 8 }}
            >
              Report dispute / Contact Admin
            </Link>
          </aside>
        </div>
      </article>
      {matches.length > 0 && <ReportMatches matches={matches} targetKind={item.kind} />}
    </main>
  );
}
