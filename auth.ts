import NextAuth, { CredentialsSignin, type NextAuthRequest } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { getDb } from "@/lib/mongodb";
import { verifyPassword } from "@/lib/password";
import { signInInput } from "@/lib/validation";

export type { NextAuthRequest };

class AccountSuspendedError extends CredentialsSignin {
  code = "AccountSuspended";
}

type GoogleIdentity = { email?: unknown; email_verified?: unknown };

async function getVerifiedGoogleEmail({
  userEmail,
  profile,
  accessToken,
}: {
  userEmail?: string | null;
  profile?: GoogleIdentity | null;
  accessToken?: string | null;
}) {
  const normalizeEmail = (value: unknown) =>
    typeof value === "string" ? value.trim().toLowerCase() : "";
  const callbackEmail = normalizeEmail(userEmail);
  const profileEmail = normalizeEmail(profile?.email);

  if (profile?.email_verified === false) return null;
  if (callbackEmail && profileEmail && callbackEmail !== profileEmail) return null;

  let email = profileEmail || callbackEmail;
  if (profile?.email_verified !== true) {
    // Resolve a missing ID-token claim from Google's authenticated UserInfo endpoint.
    if (!accessToken) return null;

    let response: Response;
    try {
      response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      return null;
    }
    if (!response.ok) return null;

    let googleIdentity: GoogleIdentity;
    try {
      googleIdentity = (await response.json()) as GoogleIdentity;
    } catch {
      return null;
    }
    if (googleIdentity.email_verified !== true) return null;

    const verifiedEmail = normalizeEmail(googleIdentity.email);
    if (!verifiedEmail || (email && verifiedEmail !== email)) return null;
    email = verifiedEmail;
  }

  if (!/^[^@\s]+@(?:gmail\.com|googlemail\.com)$/.test(email)) return null;
  return email;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({ authorization: { params: { prompt: "select_account" } } }),
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = signInInput.safeParse({
          email: rawCredentials?.email,
          password: rawCredentials?.password,
        });
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();
        const db = await getDb();
        const userDoc = await db.collection("users").findOne({ email });
        if (!userDoc || typeof userDoc.password_hash !== "string") {
          return null;
        }

        const valid = await verifyPassword(parsed.data.password, userDoc.password_hash);
        if (!valid) return null;

        if (userDoc.auth_status === "suspended") {
          throw new AccountSuspendedError();
        }

        const now = new Date();
        await db.collection("users").updateOne(
          { email },
          { $set: { last_login_at: now, updated_at: now } },
        );

        return {
          id: email,
          email,
          name: String(userDoc.name || email.split("@")[0] || "Campus Member"),
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/auth" },
  callbacks: {
    async signIn({ user, profile, account }) {
      if (account?.provider === "credentials") {
        return Boolean(user?.email);
      }

      const email = await getVerifiedGoogleEmail({
        userEmail: user.email,
        profile: profile as GoogleIdentity | undefined,
        accessToken: account?.access_token,
      });
      if (!email) return false;
      user.email = email;
      const db = await getDb();
      const existing = await db.collection("users").findOne({ email }, { projection: { auth_status: 1 } });
      if (existing?.auth_status === "suspended") {
        return "/auth?error=AccountSuspended";
      }
      const now = new Date();
      await db.collection("users").updateOne(
        { email },
        {
          $set: { name: user.name || "", image: user.image || null, last_login_at: now, updated_at: now },
          $setOnInsert: { _id: email, email, role: "member", auth_status: "approved", auth_provider: "google", created_at: now },
        },
        { upsert: true },
      );
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) token.uid = user.email.trim().toLowerCase();
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const uid = String(token.uid || session.user.email || token.sub || "").trim().toLowerCase();
        session.user.id = uid;
        if (session.user.email) session.user.email = session.user.email.trim().toLowerCase();
      }
      return session;
    },
  },
});
