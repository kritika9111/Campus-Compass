import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { isAuthConfigured, isBackendConfigured, isGoogleAuthConfigured } from "@/lib/access";
import { ADMIN_COOKIE_NAME, isAdminPortalConfigured, verifyAdminSessionToken } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    const portalAdmin = verifyAdminSessionToken(adminToken);

    let member: { email: string; name: string; role: string } | null = null;
    if (isAuthConfigured()) {
      try {
        const session = await auth();
        const email = session?.user?.email?.trim().toLowerCase();
        if (email) {
          let role = "member";
          if (isBackendConfigured()) {
            const db = await getDb().catch(() => null);
            const profile = db
              ? await db.collection("users").findOne({ email }, { projection: { role: 1, auth_status: 1 } }).catch(() => null)
              : null;
            if (profile?.role) role = String(profile.role);
          }
          member = {
            email,
            name: session?.user?.name || email.split("@")[0] || "Member",
            role,
          };
        }
      } catch {
        member = null;
      }
    }

    const admin = portalAdmin
      ? { email: portalAdmin.email, authMethod: "portal" as const }
      : member?.role === "admin"
        ? { email: member.email, authMethod: "google" as const }
        : null;

    return NextResponse.json(
      {
        member,
        admin,
        googleConfigured: isGoogleAuthConfigured(),
        adminPortalConfigured: isAdminPortalConfigured(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { member: null, admin: null, googleConfigured: false, adminPortalConfigured: false },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
