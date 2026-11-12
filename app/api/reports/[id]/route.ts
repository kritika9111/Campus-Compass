import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/mongodb";
import { reportUpdateInput } from "@/lib/validation";
import { isSameOrigin, readJsonBody, RequestBodyError } from "@/lib/http";
import { notifyOwnersOfPotentialMatches } from "@/lib/matching";
import type { ItemReport } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const db = await getDb();
  const item = await db.collection("reports").findOne({ _id: id });
  if (!item) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  return NextResponse.json({ item: {
    id: String(item._id), kind: item.kind, title: item.title, category: item.category,
    description: item.description, location: item.location, happened_at: item.happened_at,
    state: item.state, created_at: item.created_at,
  } });
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { id } = await params;
    const parsed = reportUpdateInput.safeParse(await readJsonBody(request));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid details." }, { status: 400 });
    const db = await getDb();
    const result = await db.collection("reports").updateOne(
      { _id: id, reporter_id: session.user.id, state: { $nin: ["closed", "hidden", "returned", "claim_pending", "handover"] } },
      { $set: { ...parsed.data, updated_at: new Date() } },
    );
    if (!result.matchedCount) return NextResponse.json({ error: "Report not found or cannot be edited." }, { status: 404 });
    try {
      const saved = await db.collection("reports").findOne({ _id: id });
      if (saved) await notifyOwnersOfPotentialMatches({
        ...saved,
        id: String(saved._id),
        created_at: new Date(saved.created_at).toISOString(),
      } as unknown as ItemReport);
    } catch (matchError) {
      console.error("Edited report match notification failed", matchError);
    }
    return NextResponse.json({ updated: true });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not update report." }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { id } = await params;
    const body = await readJsonBody(request) as Record<string, unknown>;
    const db = await getDb();
    const report = await db.collection("reports").findOne({ _id: id });
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const profile = await db.collection("users").findOne({ email: session.user.email?.toLowerCase() });
    const isAdmin = profile?.role === "admin";
    if (body.action === "moderate" && !isAdmin) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    if (report.reporter_id !== session.user.id && !isAdmin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const moderationState = body.action === "moderate" && ["open", "hidden"].includes(String(body.state))
      ? String(body.state)
      : null;
    const state = body.action === "close" ? "closed" : body.action === "return" ? "returned" : moderationState;
    if (!state) return NextResponse.json({ error: "Invalid report action." }, { status: 400 });
    if (body.action === "return" && report.state !== "handover") {
      return NextResponse.json({ error: "A report can be marked returned only through an active handover." }, { status: 409 });
    }

    if (body.action === "close" || body.action === "return") {
      const activeClaim = await db.collection("claims").findOne({
        report_id: id,
        state: { $in: ["pending", "more_info", "accepted", "handover"] },
      });
      if (activeClaim) {
        return NextResponse.json({ error: "Resolve the active private claim from its claim workspace before changing this report." }, { status: 409 });
      }
    }

    const now = new Date();
    const result = await db.collection("reports").updateOne(
      { _id: id, state: report.state, ...(isAdmin ? {} : { reporter_id: session.user.id }) },
      { $set: { state, updated_at: now } },
    );
    if (result.modifiedCount !== 1) {
      return NextResponse.json({ error: "The report changed while you were updating it. Refresh and try again." }, { status: 409 });
    }
    await db.collection("status_history").insertOne({
      _id: crypto.randomUUID(), report_id: id, actor_id: session.user.id,
      old_state: report.state, new_state: state, created_at: now,
    });
    if (body.action === "moderate") {
      await db.collection("moderation_actions").insertOne({
        _id: crypto.randomUUID(), report_id: id, actor_id: session.user.id,
        action: state === "hidden" ? "hide_report" : "restore_report",
        reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : "",
        created_at: now,
      });
    }
    return NextResponse.json({ updated: true });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not update report." }, { status: 503 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const db = await getDb();
  const result = await db.collection("reports").deleteOne({ _id: id, reporter_id: session.user.id, state: "open" });
  return result.deletedCount
    ? NextResponse.json({ deleted: true })
    : NextResponse.json({ error: "Only your open reports can be deleted." }, { status: 400 });
}
