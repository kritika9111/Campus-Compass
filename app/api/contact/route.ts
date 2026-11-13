import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { contactInput } from "@/lib/validation";
import { sendContactNotification } from "@/lib/contact-email";

export const runtime = "nodejs";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const cleanText = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

async function consumeLimit(db: Awaited<ReturnType<typeof getDb>>, key: string, now: Date) {
  try {
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
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please submit a valid form." }, { status: 400 }); }
  const parsed = contactInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check your details and try again." }, { status: 400 });

  const data = { ...parsed.data, name: cleanText(parsed.data.name), subject: cleanText(parsed.data.subject), message: cleanText(parsed.data.message) };
  if (data.name.length < 2 || data.subject.length < 3 || data.message.length < 10) return NextResponse.json({ error: "Please provide a little more detail." }, { status: 400 });

  try {
    const db = await getDb();
    const now = new Date();
    const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const limitKeys = [digest(`email:${data.email}:${Math.floor(now.getTime() / WINDOW_MS)}`)];
    if (ip) limitKeys.push(digest(`ip:${ip}:${Math.floor(now.getTime() / WINDOW_MS)}`));
    for (const key of limitKeys) {
      if (!(await consumeLimit(db, key, now))) return NextResponse.json({ error: "Too many messages were sent. Please try again in about an hour." }, { status: 429 });
    }

    const ticketId = `CC-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    await db.collection("contact_messages").insertOne({ _id: randomUUID(), ...data, ticket_id: ticketId, status: "Pending", created_at: now, updated_at: now });

    // Notification errors never undo or hide a successfully stored submission.
    const emailSent = await sendContactNotification({ ...data, ticketId }).catch(() => false);
    return NextResponse.json({ ticketId, emailSent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "We could not save your message right now. Please try again shortly." }, { status: 500 });
  }
}
