import { SignInButton } from "@/components/sign-in-button";
import { ShieldCheck, Compass } from "lucide-react";

export function MemberGate({
  message = "Sign in or register with your campus account to continue.",
}: {
  message?: string;
}) {
  return (
    <main className="gate-page">
      <div className="gate-card">
        <span className="gate-mark">
          <Compass />
        </span>
        <span className="eyebrow">A private campus service</span>
        <h1>For the LPU community.</h1>
        <p>
          {message} Only approved accounts can browse reports, post items or make claims.
        </p>
        <SignInButton label="Sign in or register" />
        <div className="gate-secure">
          <ShieldCheck size={15} />
          Your contact details aren’t shown on public reports.
        </div>
      </div>
    </main>
  );
}
