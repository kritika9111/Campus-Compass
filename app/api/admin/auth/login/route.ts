import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  isAdminPortalConfigured,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import { isDatabaseConfigured } from "@/lib/access";
import { isSameOrigin, readJsonObject, RequestBodyError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import { adminLoginInput } from "@/lib/validation";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 8;

const memoryAttempts = new Map<string, { count: number; expiresAt: number }>();

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function consumeMemoryLimit(key: string, nowMs: number): boolean {
  const existing = memoryAttempts.get(key);
  if (!existing || existing.expiresAt <= nowMs) {
    memoryAttempts.set(key, { count: 1, expiresAt: nowMs + WINDOW_MS });
    return true;
  }
  if (existing.count >= MAX_ATTEMPTS) return false;
  existing.count += 1;
  return true;
}

async function consumeLoginLimit(key: string, now: Date): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    return consumeMemoryLimit(key, now.getTime());
  }
  try {
    const db = await getDb();
    const result = await db.collection("contact_rate_limits").findOneAndUpdate(
      { key, count: { $lt: MAX_ATTEMPTS } },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(now.getTime() + WINDOW_MS) } },
      { upsert: true, returnDocument: "after" },
    );
    return Boolean(result);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return false;
    }
    return consumeMemoryLimit(key, now.getTime());
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
    }
    if (!isAdminPortalConfigured()) {
      return NextResponse.json(
        { error: "Admin portal credentials are not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET (or AUTH_SECRET) in .env.local." },
        { status: 503 },
      );
    }

    const body = await readJsonObject(request);
    const parsed = adminLoginInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Enter valid credentials." }, { status: 400 });
    }

    const now = new Date();
    const bucket = Math.floor(now.getTime() / WINDOW_MS);
    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const keys = [
      digest(`admin-login:ip:${ip}:${bucket}`),
      digest(`admin-login:email:${parsed.data.email.toLowerCase()}:${bucket}`),
    ];
    for (const key of keys) {
      if (!(await consumeLoginLimit(key, now))) {
        return NextResponse.json({ error: "Too many sign-in attempts. Please wait 15 minutes and try again." }, { status: 429 });
      }
    }

    const config = verifyAdminCredentials(parsed.data.email, parsed.data.password);
    if (!config) {
      return NextResponse.json({ error: "Invalid administrator email or password." }, { status: 401 });
    }

    const token = createAdminSessionToken(config.email, config.secret, now.getTime());

    if (isDatabaseConfigured()) {
      await getDb()
        .then((db) =>
          db.collection("moderation_actions").insertOne({
            _id: crypto.randomUUID(),
            report_id: null,
            actor_id: config.email,
            action: "admin_portal_login",
            reason: "Signed in via Admin Portal",
            created_at: now,
          }),
        )
        .catch(() => undefined);
    }

    const response = NextResponse.json({ ok: true, email: config.email });
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin portal login failed", error);
    return NextResponse.json({ error: "Could not sign in right now." }, { status: 503 });
  }
}
