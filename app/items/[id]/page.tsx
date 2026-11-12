import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { MemberGate } from "@/components/member-gate";
import { ClaimButton } from "@/components/claim-button";
import { ManageReport } from "@/components/manage-report";
import { ReportMatches } from "@/components/report-matches";
import { SaveItemButton } from "@/components/save-item-button";
import { getMember } from "@/lib/access";
import { cloudinary } from "@/lib/cloudinary";
import { getDb } from "@/lib/mongodb";
import { getPotentialMatchesForReport, publicMatchResults } from "@/lib/matching";
import { states } from "@/lib/types";

function formatReportedAt(value: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { approved, user, role } = await getMember();
  if (!approved || !user) return <MemberGate />;

  const { id } = await params;
  const db = await getDb();
  const item = await db.collection("reports").findOne({ _id: id });
  if (!item) notFound();

  const photoUrls = ((item.photos || []) as Array<{ public_id: string }>).map((photo) =>
    cloudinary.url(photo.public_id, { type: "authenticated", sign_url: true, secure: true }),
  );
  const isOwner = item.reporter_id === user.id;
  const matches = isOwner || role === "admin"
    ? publicMatchResults(await getPotentialMatchesForReport(id, 35))
    : [];
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
              <span className="eyebrow">{item.category} · {states[item.state as keyof typeof states]}</span>
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
              ? <ManageReport id={id} state={item.state} />
              : item.kind === "found"
                ? <ClaimButton reportId={id} disabled={item.state !== "open"} />
                : <p className="claim-eligibility-note">Ownership claims are available for found items.</p>}
            <SaveItemButton reportId={id} />
          </aside>
        </div>
      </article>
      {matches.length > 0 && <ReportMatches matches={matches} targetKind={item.kind} />}
    </main>
  );
}
