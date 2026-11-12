import Link from "next/link";
import { ArrowRight, ArrowUpRight, Compass, LockKeyhole, MapPin, Search, ShieldCheck, Sparkles, UserRoundCheck, Waypoints } from "lucide-react";
import { getMember } from "@/lib/access";
import { getOpenReports } from "@/lib/queries";
import { ItemCard } from "@/components/item-card";
import { WelcomeVideo } from "@/components/welcome-video";

export default async function Home(){
  const hasAuthConfig=Boolean(process.env.MONGODB_URI&&process.env.AUTH_SECRET&&process.env.AUTH_GOOGLE_ID&&process.env.AUTH_GOOGLE_SECRET);
  const {user,approved}=hasAuthConfig?await getMember():{user:null,approved:false};
  const reports=approved?await getOpenReports(4):[];
  return <><WelcomeVideo/><main className="landing-page">
    <section className="hero-wrap hero-stage">
      <div className="hero-orbit" aria-hidden="true"><span/><span/><span/><i className="orbit-needle"/><i className="orbit-center"><Compass size={31}/></i></div>
      <div className="hero-float-card float-left"><span className="float-index">01 / DISCOVER</span><div className="float-icon"><Search size={18}/></div><b>Scan the campus board</b><small>Search by item, category or place</small><span className="float-line"/></div>
      <div className="hero-float-card float-right"><span className="float-index">02 / REUNITE</span><div className="float-icon pink"><UserRoundCheck size={18}/></div><b>Verify it privately</b><small>Ownership details stay between you</small><span className="float-line pink-line"/></div>
      <div className="hero-copy">
        <div className="hero-kicker"><span className="signal-dot"/> LOVELY PROFESSIONAL UNIVERSITY <span className="kicker-divider"/> PHAGWARA, INDIA</div>
        <h1>Lost something<br/><span>on campus?</span></h1>
        <p className="hero-lede">LPU’s Lost &amp; Found portal. A smarter, safer way to reconnect with your belongings and the people who found them.</p>
        <div className="hero-actions"><Link className="button button-teal" href="/report"><Sparkles size={15}/>Report an item <ArrowUpRight size={16}/></Link><Link className="button button-outline" href="/find">Find an item <ArrowRight size={16}/></Link></div>
        <form className="home-search" action="/find"><Search size={17}/><input aria-label="Search campus reports" name="q" placeholder="Search an item, category or campus location"/><button aria-label="Search"><span>SEARCH THE BOARD</span><ArrowRight size={14}/></button></form>
        <div className="hero-trust"><span><LockKeyhole size={13}/> Confirmed Gmail sign-in</span><span><ShieldCheck size={13}/> Private claim details</span><span><MapPin size={13}/> Campus handovers</span></div>
        {user&&!approved&&<p className="access-error">Sign in with a confirmed Gmail account to access the campus board.</p>}
      </div>
      <div className="hero-crosshair" aria-hidden="true"><span/><span/></div>
      <div className="hero-coordinates" aria-hidden="true">31°14′ N &nbsp; 75°42′ E<br/><span>LPU CAMPUS NETWORK · SECURE</span></div>
      <div className="hero-scroll-cue" aria-hidden="true"><span/> SCROLL TO EXPLORE</div>
    </section>

    <section className="workflow-section">
      <div className="workflow-heading"><span className="eyebrow"><Waypoints size={14}/> RECOVERY PROTOCOL</span><p>From first report to safe handover.<br/><b>Every step clear. Every claim private.</b></p></div>
      <div className="workflow-rail"><div className="workflow-track" aria-hidden="true"/><article><span className="workflow-no">01</span><span className="workflow-icon"><Search size={17}/></span><b>Report</b><small>Tell the campus what’s lost or found.</small></article><article><span className="workflow-no">02</span><span className="workflow-icon"><Compass size={17}/></span><b>Match</b><small>Search new reports across LPU.</small></article><article><span className="workflow-no">03</span><span className="workflow-icon"><ShieldCheck size={17}/></span><b>Verify</b><small>Confirm ownership in private.</small></article><article><span className="workflow-no">04</span><span className="workflow-icon"><UserRoundCheck size={17}/></span><b>Handover</b><small>Return it safely on campus.</small></article></div>
    </section>

    <section className="recent-section"><div className="section-heading"><div><span className="eyebrow">CAMPUS SIGNALS</span><h2>Recently reported</h2></div><Link className="text-link" href="/find">Open the item board <ArrowRight size={15}/></Link></div>{!approved?<div className="member-preview"><LockKeyhole size={18}/><span>Sign in with a confirmed Gmail account to view campus reports.</span><Link href="/find">Enter the campus board <ArrowRight size={14}/></Link></div>:reports.length?<div className="item-grid">{reports.map(item=><ItemCard key={item.id} item={item}/>)}</div>:<div className="empty-state compact"><h2>No open reports just yet.</h2><p>Be the first to add one to the campus board.</p><Link className="text-link" href="/report">Create the first report <ArrowRight size={15}/></Link></div>}</section>

    <section className="trust-section"><div className="trust-panel"><span className="trust-emblem"><ShieldCheck size={24}/></span><div><span className="eyebrow">BUILT AROUND TRUST</span><h2>Personal details stay out of sight.</h2><p>Reports are shared with the LPU community. Ownership proof and claim conversations remain private between the people involved.</p></div><Link href="/help" className="text-link">How we keep handovers safe <ArrowRight size={14}/></Link></div></section>
  </main></>
}

