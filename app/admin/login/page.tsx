import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Chrome, ShieldCheck } from "lucide-react";
import { AdminLoginForm } from "@/components/admin-login-form";
import { getAdminAccess, isBackendConfigured } from "@/lib/access";
import { isAdminPortalConfigured } from "@/lib/admin-auth";

export default async function AdminLoginPage() {
  const admin = await getAdminAccess();
  if (admin.isAdmin) {
    redirect("/admin");
  }

  const portalConfigured = isAdminPortalConfigured();
  const googleConfigured = isBackendConfigured();

  return (
    <main className="gate-page">
      <div className="gate-card auth-page-card admin-login-card">
        <Link href="/" className="back-link">
          <ArrowLeft size={14} /> Back to Campus Compass
        </Link>
        <span className="gate-mark">
          <ShieldCheck size={24} />
        </span>
        <span className="eyebrow">ADMINISTRATOR PORTAL</span>
        <h1>Admin Sign In</h1>
        <p>Sign in with your administrator credentials to manage user authentication, roles, reports, and support tickets.</p>

        <AdminLoginForm configured={portalConfigured} />

        {!portalConfigured && (
          <p className="preview-auth-note" role="status">
            Configure <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD</code>, and <code>ADMIN_SESSION_SECRET</code> (or{" "}
            <code>AUTH_SECRET</code>) in <code>.env.local</code> to enable password sign-in.
          </p>
        )}

        {googleConfigured && (
          <>
            <div className="auth-divider">or</div>
            <Link href="/auth?callbackUrl=/admin" className="button button-outline auth-google-btn">
              <Chrome size={15} /> Sign in with Google Admin account
            </Link>
          </>
        )}

        <div className="gate-secure">
          <ShieldCheck size={14} /> Signed HttpOnly session · rate-limited protection
        </div>
      </div>
    </main>
  );
}
