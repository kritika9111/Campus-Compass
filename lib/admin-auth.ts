import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "cc_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export type AdminPortalConfig = {
  email: string;
  password: string;
  secret: string;
};

export type AdminSessionPayload = {
  email: string;
  iat: number;
  exp: number;
};

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function constantTimeEquals(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

export function getAdminPortalConfig(
  env: Record<string, string | undefined> = process.env,
): AdminPortalConfig | null {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  const secret = (env.ADMIN_SESSION_SECRET || env.AUTH_SECRET)?.trim();
  if (!email || !password || !secret) return null;
  return { email, password, secret };
}

export function isAdminPortalConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return getAdminPortalConfig(env) !== null;
}

export function verifyAdminCredentials(
  emailInput: string,
  passwordInput: string,
  env: Record<string, string | undefined> = process.env,
): AdminPortalConfig | null {
  const config = getAdminPortalConfig(env);
  if (!config) return null;
  const normalizedEmail = emailInput.trim().toLowerCase();
  const emailOk = constantTimeEquals(normalizedEmail, config.email);
  const passwordOk = constantTimeEquals(passwordInput, config.password);
  return emailOk && passwordOk ? config : null;
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createAdminSessionToken(
  email: string,
  secret: string,
  nowMs: number = Date.now(),
): string {
  const iat = Math.floor(nowMs / 1000);
  const payload: AdminSessionPayload = {
    email: email.trim().toLowerCase(),
    iat,
    exp: iat + ADMIN_SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifyAdminSessionToken(
  token: string | undefined | null,
  env: Record<string, string | undefined> = process.env,
  nowMs: number = Date.now(),
): AdminSessionPayload | null {
  if (!token) return null;
  const config = getAdminPortalConfig(env);
  if (!config) return null;

  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0 || dotIndex !== token.lastIndexOf(".")) return null;

  const encoded = token.slice(0, dotIndex);
  const providedSig = token.slice(dotIndex + 1);
  if (!encoded || !providedSig) return null;

  const expectedSig = signPayload(encoded, config.secret);
  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<AdminSessionPayload>;
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    const nowSec = Math.floor(nowMs / 1000);
    if (parsed.exp <= nowSec || parsed.iat > nowSec + 60) return null;
    if (!constantTimeEquals(parsed.email.trim().toLowerCase(), config.email)) return null;
    return { email: parsed.email.trim().toLowerCase(), iat: parsed.iat, exp: parsed.exp };
  } catch {
    return null;
  }
}
