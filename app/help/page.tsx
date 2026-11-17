import Link from "next/link";
import { ArrowLeft, CircleCheck, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { getMember, isBackendConfigured } from "@/lib/access";

type SearchParams = Promise<{
  category?: string | string[];
  role?: string | string[];
  reportId?: string | string[];
  claimId?: string | string[];
  subject?: string | string[];
}>;

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function Help({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {};
  const member = isBackendConfigured() ? await getMember().catch(() => null) : null;

  return (
    <main className="page-wrap help-page">
      <div className="page-topline">
        <Link href="/" className="back-link"><ArrowLeft size={15} /> Campus Compass</Link>
        <span className="privacy-tag">Contact &amp; dispute support</span>
      </div>
      <div className="help-heading">
        <span className="eyebrow">We’re here to help</span>
        <h1>Contact<br /><em>Campus Compass.</em></h1>
        <p>Disagreement over a lost or found item handover, refusal to return an item, or any safety concern? Send a message directly to the Campus Compass administrators.</p>
      </div>
      <div className="help-grid">
        <article>
          <ShieldCheck />
          <h2>Verify before you return</h2>
          <p>Ask the claimant to privately describe a mark, accessory, or detail that isn’t shown in the listing.</p>
        </article>
        <article>
          <MapPin />
          <h2>Choose a public place</h2>
          <p>Meet at a staffed campus desk or another busy public location. Avoid sharing your personal address.</p>
        </article>
        <article>
          <MessageCircle />
          <h2>Escalate handover disputes</h2>
          <p>Whether you lost an item and the finder refuses to hand it over, or you found an item and face a claimant issue, message the admin below with the item or claim ID.</p>
        </article>
        <article>
          <CircleCheck />
          <h2>Close the loop</h2>
          <p>Once the item is returned, mark the report resolved so the campus board stays current.</p>
        </article>
      </div>
      <section className="dashboard-panel contact-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Campus support &amp; dispute desk</span>
            <h2>Send a message to Admin</h2>
          </div>
        </div>
        <p className="contact-intro">
          Both lost-item owners and item finders can use this form to reach the Admin Portal. We’ll create a tracked ticket for the administrator to review.
        </p>
        <ContactForm
          defaults={{
            name: member?.user?.name || "",
            email: member?.user?.email || "",
            partyRole: firstParam(params.role),
            category: firstParam(params.category),
            reportId: firstParam(params.reportId),
            claimId: firstParam(params.claimId),
            subject: firstParam(params.subject),
          }}
        />
      </section>
      <Link href="/find" className="button button-teal">Back to the campus board</Link>
    </main>
  );
}
