import Link from "next/link";
import { ArrowLeft, CircleCheck, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { ContactForm } from "@/components/contact-form";

export default function Help() {
  return <main className="page-wrap help-page">
    <div className="page-topline"><Link href="/" className="back-link"><ArrowLeft size={15}/> Campus Compass</Link><span className="privacy-tag">Contact &amp; safety</span></div>
    <div className="help-heading"><span className="eyebrow">We’re here to help</span><h1>Contact<br/><em>Campus Compass.</em></h1><p>Questions, feedback, or a safety concern? Send us a note and our team will follow up.</p></div>
    <div className="help-grid"><article><ShieldCheck/><h2>Verify before you return</h2><p>Ask the claimant to privately describe a mark, accessory, or detail that isn’t shown in the listing.</p></article><article><MapPin/><h2>Choose a public place</h2><p>Meet at a staffed campus desk or another busy public location. Avoid sharing your personal address.</p></article><article><MessageCircle/><h2>Keep messages on the board</h2><p>Use the private claim flow to coordinate. Your phone number and personal email are never shown on reports.</p></article><article><CircleCheck/><h2>Close the loop</h2><p>Once the item is returned, mark the report resolved so the campus board stays current.</p></article></div>
    <section className="dashboard-panel contact-panel"><div className="panel-title"><div><span className="eyebrow">Campus support</span><h2>Send us a message</h2></div></div><p className="contact-intro">Choose the topic that best fits your request. We’ll create a ticket so it can be tracked to resolution.</p><ContactForm/></section>
    <Link href="/find" className="button button-teal">Back to the campus board</Link>
  </main>;
}
