import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { getMember } from "@/lib/access";
import { MemberGate } from "@/components/member-gate";
import { AdminModeration } from "@/components/admin-moderation";
import { getDb } from "@/lib/mongodb";
import { AdminContactInbox } from "@/components/admin-contact-inbox";

export default async function AdminPage() {
  const { approved, user, role } = await getMember();
  if (!approved || !user) return <MemberGate />;

  if (role !== "admin") {
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
          <p>This moderation area is available only to designated Campus Compass administrators.</p>
        </div>
      </main>
    );
  }

  const db=await getDb();
  const items=(await db.collection("reports").find().sort({created_at:-1}).limit(100).toArray()).map(x=>({id:String(x._id),title:String(x.title||""),kind:String(x.kind||""),location:String(x.location||""),state:String(x.state||""),created_at:String(x.created_at||""),reporter_id:String(x.reporter_id||"")}));
  const messages=(await db.collection("contact_messages").find().sort({created_at:-1}).limit(100).toArray()).map(x=>({id:String(x._id),ticket_id:String(x.ticket_id||""),name:String(x.name||""),email:String(x.email||""),category:String(x.category||""),subject:String(x.subject||""),message:String(x.message||""),status:String(x.status||"Pending"),created_at:String(x.created_at||"")}));

  return (
    <main className="page-wrap admin-page">
      <div className="page-topline">
        <Link href="/dashboard" className="back-link">
          <ArrowLeft size={15} /> My activity
        </Link>
        <span className="privacy-tag">
          <ShieldCheck size={14} /> Administrator
        </span>
      </div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Campus Compass operations</span>
          <h1>Report moderation</h1>
          <p>Review listings and hide content that violates campus guidelines.</p>
        </div>
      </div>
      <section className="dashboard-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Latest campus reports</span>
            <h2>Review queue</h2>
          </div>
        </div>
        <AdminModeration items={items} />
      </section>
      <section className="dashboard-panel contact-admin-panel">
        <div className="panel-title"><div><span className="eyebrow">Support</span><h2>Contact inbox</h2></div></div>
        <AdminContactInbox items={messages} />
      </section>
    </main>
  );
}
