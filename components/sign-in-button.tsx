import Link from "next/link";
import { auth } from "@/auth";
import { LogIn, User } from "lucide-react";
export async function SignInButton({className="button button-teal",label="Sign in with Google"}:{className?:string;label?:string}) { const configured=Boolean(process.env.AUTH_SECRET&&process.env.AUTH_GOOGLE_ID&&process.env.AUTH_GOOGLE_SECRET);const session=configured?await auth():null; if(session?.user) return <Link href="/dashboard" className={className}><User size={14}/><span>{session.user.name?.split(" ")[0]||"Dashboard"}</span></Link>; return <Link href="/auth" className={className}><LogIn size={15}/><span>{label}</span></Link>; }
