import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminAccess, isUserSuspended } from "@/lib/access";
import { getDb } from "@/lib/mongodb";
import { findMatches, publicMatchResults } from "@/lib/matching";
import type { ItemReport } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [session, admin] = await Promise.all([auth(), getAdminAccess()]);
    if (!session?.user?.id && !admin.isAdmin) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!admin.isAdmin && await isUserSuspended(session?.user?.email)) {
      return NextResponse.json({ error: "Account suspended." }, { status: 403 });
    }
    const { id } = await params;
    const db = await getDb();
    const target = await db.collection("reports").findOne({ _id: id });
    if (!target) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const owner = Boolean(session?.user?.id && target.reporter_id === session.user.id);
    if (!owner && !admin.isAdmin) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    if (["closed", "hidden", "returned"].includes(String(target.state))) {
      return NextResponse.json({ matches: [] });
    }
    const candidateFilter: Record<string, unknown> = {
      kind: target.kind === "lost" ? "found" : "lost",
      state: { $in: ["open", "claim_pending", "handover"] },
    };
    if (target.reporter_id) {
      candidateFilter.reporter_id = { $ne: target.reporter_id };
    }
    const candidates = await db.collection("reports").find(candidateFilter).sort({ created_at: -1 }).limit(50).toArray();
    const matches = findMatches(
      { ...target, id: String(target._id) } as unknown as ItemReport,
      candidates.map((x) => ({ ...x, id: String(x._id) }) as unknown as ItemReport),
      35,
      4,
    );
    return NextResponse.json({ matches: publicMatchResults(matches) });
  } catch {
    return NextResponse.json({ error: "Could not load matches." }, { status: 503 });
  }
}
