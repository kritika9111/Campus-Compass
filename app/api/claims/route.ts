import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb, withMongoTransaction } from "@/lib/mongodb";
import { claimInput } from "@/lib/validation";
import { isSameOrigin, readJsonBody, RequestBodyError } from "@/lib/http";

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const parsed = claimInput.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid claim." }, { status: 400 });
    }

    const db = await getDb();
    const userId = session.user.id;
    const result = await withMongoTransaction(async (mongoSession) => {
      const now = new Date();
      const since = new Date(now.getTime() - 60 * 60 * 1000);
      const recentClaims = await db.collection("claims").countDocuments(
        { claimant_id: userId, created_at: { $gte: since } },
        { session: mongoSession },
      );
      if (recentClaims >= 10) return { status: 429, error: "Claim limit reached. Try again later." };

      const report = await db.collection("reports").findOne({ _id: parsed.data.report_id }, { session: mongoSession });
      if (!report) return { status: 404, error: "Report not found." };
      if (report.reporter_id === userId) return { status: 400, error: "You cannot claim your own report." };
      if (report.kind !== "found" || report.state !== "open") {
        return { status: 409, error: "This found item already has an active claim or is not accepting claims." };
      }

      const reservation = await db.collection("reports").updateOne(
        { _id: report._id, kind: "found", state: "open" },
        { $set: { state: "claim_pending", updated_at: now } },
        { session: mongoSession },
      );
      if (reservation.modifiedCount !== 1) {
        return { status: 409, error: "Another claim was submitted first. Refresh the item and try again." };
      }

      const claimId = crypto.randomUUID();
      await db.collection("claims").insertOne({
        _id: claimId,
        ...parsed.data,
        claimant_id: userId,
        state: "pending",
        created_at: now,
        updated_at: now,
      }, { session: mongoSession });
      await db.collection("claim_status_history").insertOne({
        _id: crypto.randomUUID(), claim_id: claimId, actor_id: userId, new_state: "pending", created_at: now,
      }, { session: mongoSession });
      await db.collection("status_history").insertOne({
        _id: crypto.randomUUID(), report_id: report._id, actor_id: userId,
        old_state: "open", new_state: "claim_pending", created_at: now,
      }, { session: mongoSession });
      await db.collection("notifications").insertOne({
        _id: crypto.randomUUID(), user_id: report.reporter_id, kind: "new_claim",
        title: "A new claim needs review", body: report.title, href: `/claims/${claimId}`, created_at: now,
      }, { session: mongoSession });

      return { status: 201, id: claimId };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ submitted: true, id: result.id }, { status: result.status });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Claim submission failed", error);
    return NextResponse.json({ error: "Could not submit claim." }, { status: 503 });
  }
}
