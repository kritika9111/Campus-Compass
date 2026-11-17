import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Search, Bell, Sparkles, Menu } from "lucide-react";
import { CinematicEnvironment } from "@/components/cinematic-environment";
import { SignInButton } from "@/components/sign-in-button";
import { PreviewNotice } from "@/components/preview-notice";
import { ProfileSwitcher } from "@/components/profile-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { isBackendConfigured } from "@/lib/access";
import { MotionConfig } from "framer-motion";
import "./globals.css";

const themeInitScript = `(()=>{try{var t=localStorage.getItem("cc-theme");if(t!=="light"&&t!=="dark")t="dark";document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch{document.documentElement.dataset.theme="dark";}})();`;

export const metadata: Metadata = {
  title: "Campus Compass | Lost & Found — Lovely Professional University",
  description: "A private lost and found service for the Lovely Professional University community.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const previewMode = !isBackendConfigured();
  return <html lang="en" data-theme="dark" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head><body><MotionConfig reducedMotion="user"><div className="app-viewport"><CinematicEnvironment/><header className="site-header"><Link href="/" className="brand"><span className="brand-icon"><Compass size={22}/><Sparkles className="brand-spark" size={10}/></span><span>CAMPUS COMPASS<small>LOST & FOUND · LPU, INDIA</small></span></Link><nav className="main-nav" aria-label="Main navigation"><Link href="/">Home</Link><Link href="/find">Find items</Link><Link href="/report">Report item</Link><Link href="/dashboard">My claims</Link><Link href="/help">Contact</Link></nav><div className="header-actions"><Link className="icon-link" href="/find" aria-label="Search items"><Search size={17}/></Link><Link className="icon-link" href="/dashboard" aria-label="Notifications"><Bell size={17}/></Link><ThemeToggle/><ProfileSwitcher/><SignInButton className="header-signin" label="Sign in"/><details className="mobile-menu"><summary aria-label="Open navigation"><Menu size={18}/></summary><nav aria-label="Mobile navigation"><Link href="/">Home</Link><Link href="/find">Find items</Link><Link href="/report">Report item</Link><Link href="/dashboard">My claims &amp; activity</Link><Link href="/help">Contact &amp; safety</Link><Link href="/admin">Admin portal</Link></nav></details></div></header>{previewMode&&<PreviewNotice/>}<div className="page-frame">{children}</div></div></MotionConfig></body></html>;
}

