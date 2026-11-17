import Link from "next/link";
import { ArrowRight, Bell, Box, CircleCheck, HandHelping, Plus, ShieldCheck } from "lucide-react";
import { getMember } from "@/lib/access";
import { getDb } from "@/lib/mongodb";
import { MemberGate } from "@/components/member-gate";
import { states } from "@/lib/types";
import { SignOutButton } from "@/components/sign-out-button";
import { NotificationsList } from "@/components/notifications-list";

const claimStateLabels: Record<string, string> = {
  pending: "under review",
  more_info: "more details requested",
  accepted: "ownership verified",
  handover: "handover arranged",
  completed: "completed",
  declined: "declined",
};

function toIsoString(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "string" && value) return value;
  return null;
}

export default async function Dashboard() {
  const { approved, user, role } = await getMember();
  if (!approved || !user) return <MemberGate message="Sign in with Google to see your reports and claims." />;

  const db = await getDb();
  const [reports, claims, saved, notifications, incoming] = await Promise.all([
    db.collection("reports").find({ reporter_id: user.id }).sort({ created_at: -1 }).limit(100).toArray(),
    db.collection("claims").find({ claimant_id: user.id }).sort({ created_at: -1 }).limit(20).toArray(),
    db.collection("saved_items").find({ user_id: user.id }).toArray(),
    db.collection("notifications").find({ user_id: user.id }).sort({ created_at: -1 }).limit(10).toArray(),
    db.collection("reports").distinct("_id", { reporter_id: user.id }),
  ]);

  const received = incoming.length
    ? await db.collection("claims").find({ report_id: { $in: incoming } }).sort({ created_at: -1 }).limit(20).toArray()
    : [];
  const allClaims = [...claims, ...received.filter((c) => !claims.some((x) => x._id === c._id))].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  );

  const claimReportIds = Array.from(new Set(allClaims.map((c) => String(c.report_id))));
  const savedReportIds = saved.map((s) => String(s.report_id));

  const savedReportsFilter = role === "admin"
    ? { _id: { $in: savedReportIds } }
    : { _id: { $in: savedReportIds }, $or: [{ state: { $ne: "hidden" } }, { reporter_id: user.id }] };

  const [claimReports, savedReports] = await Promise.all([
    claimReportIds.length
      ? db.collection("reports").find({ _id: { $in: claimReportIds } }).toArray()
      : Promise.resolve([]),
    savedReportIds.length
      ? db.collection("reports").find(savedReportsFilter).toArray()
      : Promise.resolve([]),
  ]);
  const claimReportTitles = new Map(claimReports.map((r) => [String(r._id), String(r.title || "Item claim")]));
  const activeClaimsCount = allClaims.filter((c) => !["completed", "declined"].includes(String(c.state))).length;
  const returned = reports.filter((x) => x.state === "returned").length;

  return (
    <main className="page-wrap dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">Your campus compass</span>
          <h1>My activity</h1>
          <p>Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}. Keep track of reports, claims and reunions.</p>
        </div>
        <div className="dashboard-actions">
          <Link href="/report" className="button button-teal"><Plus size={17} />New report</Link>
          {role === "admin" && <Link href="/admin" className="button button-outline">Admin</Link>}
          <Link href="/settings" className="button button-outline">Settings</Link>
          <SignOutButton />
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><span><Box size={17} /></span><b>{reports.length}</b><small>Your reports</small></div>
        <div className="stat-card"><span><HandHelping size={17} /></span><b>{activeClaimsCount}</b><small>Claims in progress</small></div>
        <div className="stat-card"><span><CircleCheck size={17} /></span><b>{returned}</b><small>Returned items</small></div>
      </div>

      <div className="dashboard-columns">
        <section className="dashboard-panel">
          <div className="panel-title">
            <div><span className="eyebrow">Your listings</span><h2>My reports</h2></div>
            <Link href="/find" className="text-link">Campus board <ArrowRight size={14} /></Link>
          </div>
          {reports.length ? reports.map((x) => (
            <div className="activity-row" key={x._id}>
              <Link className={`activity-symbol ${x.kind}`} href={`/items/${x._id}`}>{x.kind === "lost" ? "L" : "F"}</Link>
              <Link className="activity-copy" href={`/items/${x._id}`}>
                <b>{x.title}</b>
                <small>{x.kind} item · {x.location}</small>
              </Link>
              <span className="state-label">{states[x.state as keyof typeof states] || x.state}</span>
            </div>
          )) : (
            <div className="inline-empty">
              <p>You haven’t posted a report yet.</p>
              <Link href="/report">Add a lost or found item <ArrowRight size={14} /></Link>
            </div>
          )}

          <div className="panel-title saved-title">
            <div><span className="eyebrow">Kept close</span><h2>Saved items</h2></div>
          </div>
          {savedReports.length ? savedReports.map((x) => (
            <Link key={x._id} href={`/items/${x._id}`} className="saved-row">
              <span>{x.kind === "lost" ? "L" : "F"}</span>
              <b>{x.title}</b>
              <ArrowRight size={14} />
            </Link>
          )) : (
            <div className="inline-empty"><p>No saved items yet.</p></div>
          )}
        </section>

        <div className="side-stack">
          <section className="dashboard-panel">
            <div className="panel-title">
              <div><span className="eyebrow">Private replies</span><h2>My claims</h2></div>
              <HandHelping size={18} />
            </div>
            {allClaims.length ? allClaims.map((c) => (
              <Link href={`/claims/${c._id}`} className="claim-row" key={c._id}>
                <span className="claim-dot" />
                <span>
                  <b>{claimReportTitles.get(String(c.report_id)) || "Item claim"}</b>
                  <small>{c.claimant_id === user.id ? "Claim sent" : "Claim received"} · {claimStateLabels[String(c.state)] || String(c.state).replaceAll("_", " ")}</small>
                </span>
              </Link>
            )) : (
              <div className="inline-empty">
                <p>No claims yet.</p>
                <Link href="/find">Browse found items <ArrowRight size={14} /></Link>
              </div>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="panel-title">
              <div><span className="eyebrow">Stay in the loop</span><h2>Notifications</h2></div>
              <Bell size={17} />
            </div>
            <NotificationsList
              items={notifications.map((n) => ({
                id: String(n._id),
                title: String(n.title || ""),
                body: String(n.body || ""),
                href: typeof n.href === "string" ? n.href : null,
                read_at: toIsoString(n.read_at),
                created_at: toIsoString(n.created_at) || "",
              }))}
            />
          </section>
        </div>
      </div>

      <div className="safety-strip">
        <ShieldCheck size={18} />
        <span><b>Meeting up?</b> Choose a staffed desk or busy public spot for handover.</span>
        <Link href="/help">Safety guidance <ArrowRight size={14} /></Link>
      </div>
    </main>
  );
}

