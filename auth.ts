import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getDb } from "@/lib/mongodb";

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

    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;

    const googleIdentity = (await response.json()) as GoogleIdentity;
    if (googleIdentity.email_verified === false || googleIdentity.email_verified !== true) return null;

    const verifiedEmail = normalizeEmail(googleIdentity.email);
    if (!verifiedEmail || (email && verifiedEmail !== email)) return null;
    email = verifiedEmail;
  }

  if (!/^[^@\s]+@(?:gmail\.com|googlemail\.com)$/.test(email)) return null;
  return email;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({ authorization: { params: { prompt: "select_account" } } })],
  session: { strategy: "jwt" }, pages: { signIn: "/auth" },
  callbacks: {
    async signIn({ user, profile, account }) {
      const email = await getVerifiedGoogleEmail({
        userEmail: user.email,
        profile: profile as GoogleIdentity | undefined,
        accessToken: account?.access_token,
      });
      if (!email) return false;
      const db = await getDb();
      await db.collection("users").updateOne({ email }, { $set: { name: user.name || "", image: user.image || null, updated_at: new Date() }, $setOnInsert: { email, role: "member", created_at: new Date() } }, { upsert: true });
      return true;
    },
    async jwt({ token, user }) { if (user?.email) token.uid = user.email.toLowerCase(); return token; },
    async session({ session, token }) { if (session.user) (session.user as typeof session.user & { id: string }).id = String(token.uid || token.sub || ""); return session; },
  },
});
