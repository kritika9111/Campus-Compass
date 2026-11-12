import { signIn } from "@/auth";
import Link from "next/link";
import { ArrowLeft, Chrome, Compass, ShieldCheck } from "lucide-react";

export default function AuthPage() {
  return <main className="gate-page"><div className="gate-card auth-page-card">
    <Link href="/" className="back-link"><ArrowLeft size={14}/> Back to home</Link>
    <span className="gate-mark"><Compass size={24}/></span><span className="eyebrow">CAMPUS ACCESS</span>
    <h1>Sign In to Compass</h1><p>Use a confirmed Gmail or Googlemail account to browse reports and manage handovers.</p>
    <form action={async()=>{ "use server"; await signIn("google",{redirectTo:"/dashboard"}); }}>
      <button className="button button-outline auth-google-btn"><Chrome size={15}/> Continue with Google</button>
    </form>
    <div className="gate-secure"><ShieldCheck size={14}/> Your contact details aren’t shown on public reports.</div>
  </div></main>;
}
