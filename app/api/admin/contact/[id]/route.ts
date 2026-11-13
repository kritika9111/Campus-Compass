import { NextResponse } from "next/server";
import { getMember } from "@/lib/access";
import { getDb } from "@/lib/mongodb";

const statuses = ["Pending", "In Progress", "Resolved"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { approved, role } = await getMember();
  if (!approved || role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const status = typeof body === "object" && body !== null && "status" in body ? body.status : null;
  if (typeof status !== "string" || !statuses.includes(status as (typeof statuses)[number])) return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
  const db = await getDb();
  const result = await db.collection("contact_messages").updateOne({ _id: id }, { $set: { status, updated_at: new Date() } });
  if (!result.matchedCount) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
