import Link from "next/link";
import { ArrowLeft, Chrome, Compass, ShieldCheck } from "lucide-react";
import { signIn } from "@/auth";
import { MemberAuthForm } from "@/components/member-auth-form";
import { isBackendConfigured, isGoogleAuthConfigured } from "@/lib/access";

type SearchParams = Promise<{ error?: string | string[]; callbackUrl?: string | string[] }>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getSafeRedirect(callbackUrl: string | undefined): string {
  if (!callbackUrl) return "/dashboard";
  if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) return callbackUrl;
  return "/dashboard";
}

function getAuthErrorMessage(error: string | undefined): string | null {
  if (!error) return null;
  if (error === "AccountSuspended") {
    return "Your account has been suspended by a Campus Compass administrator. Contact support if you believe this is an error.";
  }
  if (error === "AccessDenied") {
    return "Access denied. Only verified Gmail or Googlemail accounts can sign in with Google.";
  }
  if (error === "OAuthSignin" || error === "OAuthCallbackError" || error === "OAuthAccountNotLinked") {
    return "Google sign-in could not be completed. You can also sign in or register with your email and password below.";
  }
  return "Sign-in could not be completed. Please try again.";
}

export default async function AuthPage({ searchParams }: { searchParams?: SearchParams }) {
  const configured = isBackendConfigured();
  const googleConfigured = isGoogleAuthConfigured();
  const params = searchParams ? await searchParams : {};
  const errorMessage = getAuthErrorMessage(firstParam(params.error));
  const redirectTo = getSafeRedirect(firstParam(params.callbackUrl));

  return (
    <main className="gate-page">
      <div className="gate-card auth-page-card">
        <Link href="/" className="back-link"><ArrowLeft size={14} /> Back to home</Link>
        <span className="gate-mark"><Compass size={24} /></span>
        <span className="eyebrow">CAMPUS ACCESS</span>
        <h1>Sign In to Compass</h1>
        <p>Sign in or create an account with your email and password, or continue with Google.</p>

        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}

        {configured ? (
          <>
            <MemberAuthForm redirectTo={redirectTo} />
            {googleConfigured && (
              <>
                <div className="auth-divider">or</div>
                <form action={async () => { "use server"; await signIn("google", { redirectTo }); }}>
                  <button className="button button-outline auth-google-btn">
                    <Chrome size={15} /> Continue with Google
                  </button>
                </form>
              </>
            )}
          </>
        ) : (
          <p className="preview-auth-note" role="status">
            Sign-in is disabled in preview mode. Configure <code>MONGODB_URI</code> and <code>AUTH_SECRET</code> in <code>.env.local</code> to enable authentication.
          </p>
        )}

        <div className="gate-secure">
          <ShieldCheck size={14} /> Your contact details aren’t shown on public reports.
        </div>
      </div>
    </main>
  );
}
