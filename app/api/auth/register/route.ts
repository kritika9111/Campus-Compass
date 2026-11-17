import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { isBackendConfigured } from "@/lib/access";
import { isSameOrigin, readJsonObject, RequestBodyError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/password";
import { signUpInput } from "@/lib/validation";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_SIGNUPS_PER_IP = 10;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function consumeSignupLimit(db: Awaited<ReturnType<typeof getDb>>, key: string, now: Date): Promise<boolean> {
  try {
    const result = await db.collection("contact_rate_limits").findOneAndUpdate(
      { key, count: { $lt: MAX_SIGNUPS_PER_IP } },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(now.getTime() + WINDOW_MS) } },
      { upsert: true, returnDocument: "after" },
    );
    return Boolean(result);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return false;
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
    }
    if (!isBackendConfigured()) {
      return NextResponse.json({ error: "Registration is disabled until MongoDB and AUTH_SECRET are configured." }, { status: 503 });
    }

    const body = await readJsonObject(request);
    const parsed = signUpInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Please check your registration details." },
        { status: 400 },
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const fullName = parsed.data.fullName.trim().slice(0, 100);
    const db = await getDb();
    const now = new Date();

    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const rateKey = digest(`member-signup:ip:${ip}:${Math.floor(now.getTime() / WINDOW_MS)}`);
    if (!(await consumeSignupLimit(db, rateKey, now))) {
      return NextResponse.json({ error: "Too many accounts created recently. Please try again later." }, { status: 429 });
    }

    const existing = await db.collection("users").findOne(
      { email },
      { projection: { password_hash: 1, auth_status: 1 } },
    );
    if (existing) {
      if (existing.auth_status === "suspended") {
        return NextResponse.json(
          { error: "This account has been suspended by an administrator." },
          { status: 403 },
        );
      }
      if (existing.password_hash) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in instead." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "This email is already registered with Google. Please use Continue with Google." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    try {
      await db.collection("users").insertOne({
        _id: email,
        email,
        name: fullName,
        image: null,
        password_hash: passwordHash,
        auth_provider: "credentials",
        role: "member",
        auth_status: "approved",
        created_at: now,
        updated_at: now,
        last_login_at: now,
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in instead." },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true, email }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Member registration failed", error);
    return NextResponse.json({ error: "Could not create your account right now. Please try again." }, { status: 503 });
  }
}
