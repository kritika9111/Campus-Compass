import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Search, Bell, Sparkles, Menu } from "lucide-react";
import { CinematicEnvironment } from "@/components/cinematic-environment";
import { SignInButton } from "@/components/sign-in-button";
import { PreviewNotice } from "@/components/preview-notice";
import { MotionConfig } from "framer-motion";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Compass | Lost & Found — Lovely Professional University",
  description: "A private lost and found service for the Lovely Professional University community.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const previewMode = !process.env.MONGODB_URI || !process.env.AUTH_SECRET || !process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET;
  return <html lang="en"><body><MotionConfig reducedMotion="user"><div className="app-viewport"><CinematicEnvironment/><header className="site-header"><Link href="/" className="brand"><span className="brand-icon"><Compass size={22}/><Sparkles className="brand-spark" size={10}/></span><span>CAMPUS COMPASS<small>LOST & FOUND · LPU, INDIA</small></span></Link><nav className="main-nav" aria-label="Main navigation"><Link href="/">Home</Link><Link href="/find">Find items</Link><Link href="/report">Report item</Link><Link href="/dashboard">My claims</Link><Link href="/help">Contact</Link></nav><div className="header-actions"><Link className="icon-link" href="/find" aria-label="Search items"><Search size={17}/></Link><Link className="icon-link" href="/dashboard" aria-label="Notifications"><Bell size={17}/></Link><SignInButton className="header-signin" label="Sign in with Google"/><details className="mobile-menu"><summary aria-label="Open navigation"><Menu size={18}/></summary><nav aria-label="Mobile navigation"><Link href="/">Home</Link><Link href="/find">Find items</Link><Link href="/report">Report item</Link><Link href="/dashboard">My claims &amp; activity</Link><Link href="/help">Contact &amp; safety</Link></nav></details></div></header>{previewMode&&<PreviewNotice/>}<div className="page-frame">{children}</div><footer className="site-footer"><Link href="/" className="footer-brand"><Compass size={17}/> CAMPUS COMPASS</Link><span>LOST &amp; FOUND — LOVELY PROFESSIONAL UNIVERSITY</span><Link href="/help">Help &amp; safe handovers</Link></footer></div></MotionConfig></body></html>;
}

