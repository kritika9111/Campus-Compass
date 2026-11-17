import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Box, LockKeyhole, Mail, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { AdminContactInbox } from "@/components/admin-contact-inbox";
import { AdminModeration } from "@/components/admin-moderation";
import { AdminSignOutButton } from "@/components/admin-sign-out-button";
import { AdminUsersManager, type AdminUserRecord } from "@/components/admin-users-manager";
import { getAdminAccess, getMember, isDatabaseConfigured } from "@/lib/access";
import { listContactMessages } from "@/lib/contact-store";
import { formatCampusDate } from "@/lib/datetime";
import { getDb } from "@/lib/mongodb";
import type { CampusRole, UserAuthStatus } from "@/lib/types";

export default async function AdminPage() {
  const admin = await getAdminAccess();

  if (!admin.isAdmin) {
    const { user } = await getMember();
    if (!user) {
      redirect("/admin/login");
    }
    return (
      <main className="page-wrap">
        <div className="page-topline">
          <Link href="/dashboard" className="back-link">
            <ArrowLeft size={15} /> My activity
          </Link>
          <span className="privacy-tag">Restricted</span>
        </div>
        <div className="empty-state">
          <ShieldCheck size={23} />
          <h2>Administrator access required</h2>
          <p>This portal is restricted to designated Campus Compass administrators.</p>
          <Link href="/admin/login" className="button button-teal" style={{ marginTop: 16 }}>
            <LockKeyhole size={15} /> Sign in via Admin Portal
          </Link>
        </div>
      </main>
    );
  }

  const dbConfigured = isDatabaseConfigured();
  const toIso = (value: unknown) =>
    value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : typeof value === "string" ? value : "";

  let users: AdminUserRecord[] = [];
  let items: Array<{ id: string; title: string; kind: string; location: string; state: string; created_at: string; reporter_id: string }> = [];
  let auditLogs: Array<{ id: string; action: string; actor_id: string; target_user: string; reason: string; created_at: string }> = [];

  const messages = await listContactMessages(100);

  if (dbConfigured) {
    const db = await getDb();
    const [rawUsers, rawItems, rawLogs] = await Promise.all([
      db.collection("users").find().sort({ last_login_at: -1, created_at: -1 }).limit(200).toArray(),
      db.collection("reports").find().sort({ created_at: -1 }).limit(100).toArray(),
      db.collection("moderation_actions").find().sort({ created_at: -1 }).limit(25).toArray(),
    ]);

    users = rawUsers.map((u) => ({
      email: String(u.email || u._id || ""),
      name: String(u.name || ""),
      role: (u.role || "member") as CampusRole,
      auth_status: (u.auth_status === "suspended" ? "suspended" : "approved") as UserAuthStatus,
      status_reason: String(u.status_reason || ""),
      created_at: toIso(u.created_at),
      last_login_at: toIso(u.last_login_at),
    }));

    items = rawItems.map((x) => ({
      id: String(x._id),
      title: String(x.title || ""),
      kind: String(x.kind || ""),
      location: String(x.location || ""),
      state: String(x.state || ""),
      created_at: toIso(x.created_at),
      reporter_id: String(x.reporter_id || ""),
    }));

    auditLogs = rawLogs.map((log) => ({
      id: String(log._id),
      action: String(log.action || ""),
      actor_id: String(log.actor_id || ""),
      target_user: String(log.target_user || ""),
      reason: String(log.reason || ""),
      created_at: toIso(log.created_at),
    }));
  }

  const suspendedCount = users.filter((u) => u.auth_status === "suspended").length;
  const pendingTickets = messages.filter((m) => m.status !== "Resolved").length;

  return (
    <main className="page-wrap admin-page">
      <div className="page-topline">
        <Link href="/" className="back-link">
          <ArrowLeft size={15} /> Campus Compass
        </Link>
        <span className="privacy-tag">
          <ShieldCheck size={14} /> {admin.authMethod === "portal" ? "Admin Portal Session" : "Google Administrator"} · {admin.actorEmail}
        </span>
      </div>

      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">Campus Compass operations</span>
          <h1>Admin Portal</h1>
          <p>Manage member authentication, campus roles, report moderation, and support tickets.</p>
        </div>
        <div className="dashboard-actions">
          <AdminSignOutButton authMethod={admin.authMethod} />
        </div>
      </div>

      {!dbConfigured && (
        <div className="preview-auth-note" role="status" style={{ marginBottom: 20 }}>
          MongoDB is not configured yet. Contact and dispute messages are saved locally so you can review them below; configure <code>MONGODB_URI</code> in <code>.env.local</code> to also manage registered users and reports.
        </div>
      )}

      <div className="stat-grid admin-stat-grid">
        <div className="stat-card"><span><Users size={17} /></span><b>{users.length}</b><small>Registered users</small></div>
        <div className="stat-card"><span><ShieldAlert size={17} /></span><b>{suspendedCount}</b><small>Suspended accounts</small></div>
        <div className="stat-card"><span><Box size={17} /></span><b>{items.length}</b><small>Reports in queue</small></div>
        <div className="stat-card"><span><Mail size={17} /></span><b>{pendingTickets}</b><small>Open support tickets</small></div>
      </div>

      <section className="dashboard-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Authentication &amp; access control</span>
            <h2>User accounts &amp; roles</h2>
          </div>
          <Users size={18} />
        </div>
        <AdminUsersManager users={users} currentAdminEmail={admin.actorEmail} />
      </section>

      <section className="dashboard-panel contact-admin-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Latest campus reports</span>
            <h2>Report moderation queue</h2>
          </div>
        </div>
        <AdminModeration items={items} />
      </section>

      <section className="dashboard-panel contact-admin-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Support</span>
            <h2>Contact inbox</h2>
          </div>
        </div>
        <AdminContactInbox items={messages} />
      </section>

      {auditLogs.length > 0 && (
        <section className="dashboard-panel contact-admin-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">Security log</span>
              <h2>Recent admin activity</h2>
            </div>
          </div>
          <div className="admin-audit-list">
            {auditLogs.map((log) => (
              <div className="admin-row" key={log.id}>
                <div>
                  <b>{log.action.replaceAll("_", " ")}{log.target_user ? ` · ${log.target_user}` : ""}</b>
                  <small>
                    By {log.actor_id}
                    {log.reason ? ` — ${log.reason}` : ""}
                  </small>
                </div>
                <span className="state-label">
                  {formatCampusDate(log.created_at, { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
