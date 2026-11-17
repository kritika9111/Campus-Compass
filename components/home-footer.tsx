import Link from "next/link";
import { ArrowUpRight, Compass, LockKeyhole, MapPin, ShieldAlert, ShieldCheck } from "lucide-react";

const handoverDesks = [
  "Central Library — Circulation Desk",
  "Block 30 — DSW Helpdesk",
  "Uni Mall — Main Security Desk",
  "Block 34 — Academic Reception",
  "Main Security Gate 1",
];

export function HomeFooter() {
  return (
    <footer className="home-footer" aria-label="Campus Compass footer">
      <div className="home-footer-inner">
        <div className="home-footer-grid">
          <div className="home-footer-brand-col">
            <Link href="/" className="home-footer-logo">
              <span className="brand-icon">
                <Compass size={20} />
              </span>
              <span>
                CAMPUS COMPASS
                <small>LOST &amp; FOUND · LPU, INDIA</small>
              </span>
            </Link>
            <p className="home-footer-tagline">
              A private lost-and-found network built for students, faculty, and staff at Lovely Professional University to report, verify, and safely return campus belongings.
            </p>
            <div className="home-footer-pill">
              <span className="signal-dot" aria-hidden="true" />
              <span>LPU Campus · Phagwara, Punjab (31°14′ N, 75°42′ E)</span>
            </div>
          </div>

          <div className="home-footer-col">
            <h3>Platform</h3>
            <ul>
              <li><Link href="/find">Browse campus board</Link></li>
              <li><Link href="/report">Report a lost or found item</Link></li>
              <li><Link href="/dashboard">My claims &amp; activity</Link></li>
              <li><Link href="/settings">Account settings</Link></li>
              <li><Link href="/auth">Sign in / Create account</Link></li>
            </ul>
          </div>

          <div className="home-footer-col">
            <h3>Staffed Handover Desks</h3>
            <ul className="home-footer-desks">
              {handoverDesks.map((desk) => (
                <li key={desk}>
                  <MapPin size={12} aria-hidden="true" />
                  <span>{desk}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="home-footer-col">
            <h3>Support &amp; Safety</h3>
            <ul>
              <li><Link href="/help">Help &amp; handover safety guide</Link></li>
              <li>
                <Link href="/help?category=Handover+Dispute+%E2%80%94+Finder+Refuses+Return">
                  <ShieldAlert size={12} aria-hidden="true" /> Report a handover dispute
                </Link>
              </li>
              <li>
                <Link href="/admin/login">
                  <LockKeyhole size={12} aria-hidden="true" /> Admin portal <ArrowUpRight size={12} aria-hidden="true" />
                </Link>
              </li>
            </ul>
            <div className="home-footer-privacy">
              <ShieldCheck size={14} aria-hidden="true" />
              <span>Personal phone numbers and emails are never shown on public listings.</span>
            </div>
          </div>
        </div>

        <div className="home-footer-bottom">
          <span>© {new Date().getFullYear()} Campus Compass · Lovely Professional University</span>
          <div className="home-footer-bottom-links">
            <Link href="/help">Contact support</Link>
            <span aria-hidden="true">·</span>
            <Link href="/find">Item board</Link>
            <span aria-hidden="true">·</span>
            <Link href="/admin/login">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
