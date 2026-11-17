import Link from "next/link";
import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/access";
import { LogIn, User } from "lucide-react";

export async function SignInButton({ className = "button button-teal", label = "Sign in with Google" }: { className?: string; label?: string }) {
  const configured = isAuthConfigured();
  let session = null;
  if (configured) {
    try {
      session = await auth();
    } catch {
      session = null;
    }
  }
  if (session?.user) {
    return (
      <Link href="/dashboard" className={className}>
        <User size={14} />
        <span>{session.user.name?.split(" ")[0] || "Dashboard"}</span>
      </Link>
    );
  }
  return <Link href="/auth" className={className}><LogIn size={15} /><span>{label}</span></Link>;
}
