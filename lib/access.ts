import { cookies } from "next/headers";
import { connection } from "next/server";
import { auth } from "@/auth";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-auth";
import { getDb } from "@/lib/mongodb";
import type { CampusRole, UserAuthStatus } from "@/lib/types";

export function isGoogleAuthConfigured() {
  return Boolean(
    process.env.AUTH_SECRET &&
    process.env.AUTH_GOOGLE_ID &&
    process.env.AUTH_GOOGLE_SECRET,
  );
}

export function isAuthConfigured() {
  return Boolean(process.env.AUTH_SECRET);
}

export function isDatabaseConfigured() {
  return Boolean(process.env.MONGODB_URI);
}

export function isBackendConfigured() {
  return Boolean(process.env.MONGODB_URI && isAuthConfigured());
}

export async function getMember() {
  await connection();
  if (!isBackendConfigured()) {
    return {
      user: null,
      approved: false,
      suspended: false,
      authStatus: "approved" as UserAuthStatus,
      role: "member" as CampusRole,
      profile: null,
    };
  }
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!session || !email) {
    return {
      user: null,
      approved: false,
      suspended: false,
      authStatus: "approved" as UserAuthStatus,
      role: "member" as CampusRole,
      profile: null,
    };
  }
  const db = await getDb();
  const profile = await db.collection("users").findOne({ email });
  const domain = email.split("@").at(-1);
  const authStatus = (profile?.auth_status === "suspended" ? "suspended" : "approved") as UserAuthStatus;
  const suspended = authStatus === "suspended";
  const isGmail = domain === "gmail.com" || domain === "googlemail.com";
  const hasRegisteredAccount = Boolean(profile?.password_hash) || isGmail;
  return {
    user: { id: (session.user.id || email).trim().toLowerCase(), email, name: session.user.name || "" },
    approved: hasRegisteredAccount && !suspended,
    suspended,
    authStatus,
    role: (profile?.role || "member") as CampusRole,
    profile,
  };
}

export async function isUserSuspended(email: string | undefined | null): Promise<boolean> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !isDatabaseConfigured()) return false;
  const db = await getDb();
  const profile = await db.collection("users").findOne({ email: normalized }, { projection: { auth_status: 1 } });
  return profile?.auth_status === "suspended";
}

export type AdminAccess =
  | { isAdmin: true; actorEmail: string; authMethod: "portal" | "google" }
  | { isAdmin: false; actorEmail: null; authMethod: null };

export async function getAdminAccess(): Promise<AdminAccess> {
  await connection();
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const portalSession = verifyAdminSessionToken(token);
  if (portalSession) {
    return { isAdmin: true, actorEmail: portalSession.email, authMethod: "portal" };
  }

  const { approved, user, role } = await getMember();
  if (approved && user && role === "admin") {
    return { isAdmin: true, actorEmail: user.email, authMethod: "google" };
  }

  return { isAdmin: false, actorEmail: null, authMethod: null };
}
