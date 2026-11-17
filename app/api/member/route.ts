import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isUserSuspended } from "@/lib/access";
import { getDb } from "@/lib/mongodb";
import { isSameOrigin, readJsonObject, RequestBodyError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (await isUserSuspended(session.user.email)) return NextResponse.json({ error: "Account suspended." }, { status: 403 });
    const p = new URL(request.url).searchParams;
    const db = await getDb();
    const id = session.user.id;
    switch (p.get("type")) {
      case "saved": {
        const rows = await db.collection("saved_items").find({ user_id: id }).toArray();
        return NextResponse.json({ items: rows.map((x) => x.report_id) });
      }
      case "preferences": {
        const prefs = await db.collection("member_preferences").findOne({ user_id: id });
        return NextResponse.json({
          preferences: prefs || { notification_preferences: { claims: true, updates: true }, flow_intro_seen: false },
        });
      }
      case "notifications": {
        const rows = await db.collection("notifications").find({ user_id: id }).sort({ created_at: -1 }).limit(20).toArray();
        return NextResponse.json({ items: rows.map((x) => ({ ...x, id: x._id })) });
      }
      default:
        return NextResponse.json({ error: "Unknown member resource." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Member data is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (await isUserSuspended(session.user.email)) return NextResponse.json({ error: "Account suspended." }, { status: 403 });
    const body = await readJsonObject(request);
    const db = await getDb();
    const id = session.user.id;
    const now = new Date();

    if (body.type === "saved") {
      if (typeof body.report_id !== "string" || !body.report_id.trim()) {
        return NextResponse.json({ error: "Report not found." }, { status: 404 });
      }
      const report = await db.collection("reports").findOne({ _id: body.report_id });
      if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
      if (report.state === "hidden" && report.reporter_id !== id) {
        const profile = await db.collection("users").findOne({ email: session.user.email?.toLowerCase() });
        if (profile?.role !== "admin") return NextResponse.json({ error: "Report not found." }, { status: 404 });
      }
      const key = { user_id: id, report_id: report._id };
      if (body.saved) {
        await db.collection("saved_items").updateOne(
          key,
          { $setOnInsert: { _id: `${id}:${report._id}`, ...key, created_at: now } },
          { upsert: true },
        );
      } else {
        await db.collection("saved_items").deleteOne(key);
      }
      return NextResponse.json({ saved: Boolean(body.saved) });
    }

    if (body.type === "preferences") {
      const prefs = body.notification_preferences;
      if (
        !prefs ||
        typeof prefs !== "object" ||
        Array.isArray(prefs) ||
        typeof (prefs as Record<string, unknown>).claims !== "boolean" ||
        typeof (prefs as Record<string, unknown>).updates !== "boolean"
      ) {
        return NextResponse.json({ error: "Invalid preferences." }, { status: 400 });
      }
      const sanitizedPrefs = {
        claims: (prefs as { claims: boolean }).claims,
        updates: (prefs as { updates: boolean }).updates,
      };
      await db.collection("member_preferences").updateOne(
        { user_id: id },
        { $set: { notification_preferences: sanitizedPrefs, updated_at: now }, $setOnInsert: { _id: id, user_id: id } },
        { upsert: true },
      );
      return NextResponse.json({ saved: true });
    }

    if (body.type === "flow_seen") {
      await db.collection("member_preferences").updateOne(
        { user_id: id },
        { $set: { flow_intro_seen: true, updated_at: now }, $setOnInsert: { _id: id, user_id: id } },
        { upsert: true },
      );
      return NextResponse.json({ saved: true });
    }

    if (body.type === "notification_read") {
      if (typeof body.id !== "string" || !body.id.trim()) {
        return NextResponse.json({ error: "Invalid notification." }, { status: 400 });
      }
      const r = await db.collection("notifications").updateOne({ _id: body.id, user_id: id }, { $set: { read_at: now } });
      return NextResponse.json({ saved: r.modifiedCount > 0 });
    }

    return NextResponse.json({ error: "Unknown member operation." }, { status: 400 });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not save member data." }, { status: 503 });
  }
}
