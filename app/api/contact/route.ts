import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/access";
import { sendContactNotification } from "@/lib/email";
import { saveContactMessage } from "@/lib/contact-store";
import { isSameOrigin, readJsonBody, RequestBodyError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import { contactInput } from "@/lib/validation";

export const runtime = "nodejs";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const cleanText = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
const cleanSingleLine = (value: string) => cleanText(value).replace(/[\r\n]+/g, " ").trim();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

const memoryRateLimits = new Map<string, { count: number; expiresAt: number }>();

function consumeMemoryLimit(key: string, nowMs: number): boolean {
  const entry = memoryRateLimits.get(key);
  if (!entry || entry.expiresAt <= nowMs) {
    memoryRateLimits.set(key, { count: 1, expiresAt: nowMs + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}

async function consumeLimit(key: string, now: Date): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    return consumeMemoryLimit(key, now.getTime());
  }
  try {
    const db = await getDb();
    const result = await db.collection("contact_rate_limits").findOneAndUpdate(
      { key, count: { $lt: MAX_PER_WINDOW } },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(now.getTime() + WINDOW_MS) } },
      { upsert: true, returnDocument: "after" },
    );
    return Boolean(result);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) return false;
    throw error;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Please submit a valid form." }, { status: 400 });
  }
  const parsed = contactInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check your details and try again." }, { status: 400 });

  const data = {
    ...parsed.data,
    name: cleanSingleLine(parsed.data.name),
    subject: cleanSingleLine(parsed.data.subject),
    report_id: cleanSingleLine(parsed.data.report_id || ""),
    claim_id: cleanSingleLine(parsed.data.claim_id || ""),
    message: cleanText(parsed.data.message),
  };
  if (data.name.length < 2 || data.subject.length < 3 || data.message.length < 10) {
    return NextResponse.json({ error: "Please provide a little more detail." }, { status: 400 });
  }

  try {
    const now = new Date();
    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const limitKeys = [digest(`email:${data.email}:${Math.floor(now.getTime() / WINDOW_MS)}`)];
    if (ip) limitKeys.push(digest(`ip:${ip}:${Math.floor(now.getTime() / WINDOW_MS)}`));
    for (const key of limitKeys) {
      if (!(await consumeLimit(key, now))) {
        return NextResponse.json({ error: "Too many messages were sent. Please try again in about an hour." }, { status: 429 });
      }
    }

    const ticketId = `CC-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const nowIso = now.toISOString();
    await saveContactMessage({
      id: randomUUID(),
      ticket_id: ticketId,
      name: data.name,
      email: data.email,
      party_role: data.party_role,
      category: data.category,
      report_id: data.report_id,
      claim_id: data.claim_id,
      subject: data.subject,
      message: data.message,
      status: "Pending",
      admin_note: "",
      created_at: nowIso,
      updated_at: nowIso,
    });

    // Notify in-app administrators when MongoDB is configured.
    if (isDatabaseConfigured()) {
      await getDb()
        .then(async (db) => {
          const admins = await db.collection("users").find({ role: "admin" }, { projection: { email: 1 } }).toArray();
          if (!admins.length) return;
          const isDispute = data.category.startsWith("Handover Dispute");
          await db.collection("notifications").insertMany(
            admins.map((adminUser) => ({
              _id: randomUUID(),
              user_id: String(adminUser.email || "").toLowerCase(),
              kind: isDispute ? "handover_dispute" : "contact_ticket",
              title: isDispute ? `Handover dispute [${ticketId}]` : `New support ticket [${ticketId}]`,
              body: `${data.party_role}: ${data.subject}`,
              href: "/admin",
              created_at: now,
            })),
          );
        })
        .catch(() => undefined);
    }

    // Notification errors never undo or hide a successfully stored submission.
    const emailSent = await sendContactNotification({
      ticketId,
      name: data.name,
      email: data.email,
      partyRole: data.party_role,
      category: data.category,
      reportId: data.report_id,
      claimId: data.claim_id,
      subject: data.subject,
      message: data.message,
    }).catch(() => false);

    return NextResponse.json({ ticketId, emailSent }, { status: 201 });
  } catch (error) {
    console.error("Contact submission failed", error);
    return NextResponse.json({ error: "We could not save your message right now. Please try again shortly." }, { status: 500 });
  }
}
