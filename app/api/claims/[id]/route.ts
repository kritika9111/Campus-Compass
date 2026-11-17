import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isUserSuspended } from "@/lib/access";
import { canTransitionClaim, handoverLocations, reportStateForClaim } from "@/lib/claim-workflow";
import { sendMemberAlertEmail } from "@/lib/email";
import { getDb, withMongoTransaction } from "@/lib/mongodb";
import { isSameOrigin, readJsonObject, RequestBodyError } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (await isUserSuspended(session.user.email)) return NextResponse.json({ error: "Account suspended." }, { status: 403 });
    const { id } = await params;
    const db = await getDb();
    const claim = await db.collection("claims").findOne({ _id: id });
    if (!claim) return NextResponse.json({ error: "Claim not found." }, { status: 404 });
    const report = await db.collection("reports").findOne({ _id: claim.report_id });
    if (!report || ![claim.claimant_id, report.reporter_id].includes(session.user.id)) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    const [messages, history] = await Promise.all([
      db.collection("messages").find({ claim_id: id }).sort({ created_at: 1 }).toArray(),
      db.collection("claim_status_history").find({ claim_id: id }).sort({ created_at: 1 }).toArray(),
    ]);
    return NextResponse.json({
      claim: {
        id,
        state: claim.state,
        ownership_details: claim.ownership_details,
        created_at: claim.created_at,
        updated_at: claim.updated_at,
        verification: claim.verification ? {
          decision: claim.verification.decision,
          reviewed_at: claim.verification.reviewed_at,
        } : null,
        handover: claim.handover ? {
          location: claim.handover.location,
          date: claim.handover.date,
          time_window: claim.handover.time_window,
          note: claim.handover.note,
          proposed_at: claim.handover.proposed_at,
          proposed_by_you: claim.handover.proposed_by === session.user.id,
          confirmed_at: claim.handover.confirmed_at,
          confirmed: Boolean(claim.handover.confirmed_by),
        } : null,
      },
      item: { id: report._id, title: report.title, kind: report.kind, location: report.location },
      messages: messages.map((message) => ({
        id: message._id,
        isMine: message.sender_id === session.user.id,
        body: message.body,
        created_at: message.created_at,
      })),
      history: history.map((event) => ({
        id: event._id,
        old_state: event.old_state ?? null,
        new_state: event.new_state,
        note: event.note ?? null,
        created_at: event.created_at,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Could not load the claim." }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (await isUserSuspended(session.user.email)) return NextResponse.json({ error: "Account suspended." }, { status: 403 });
    const { id } = await params;
    const body = await readJsonObject(request);
    const db = await getDb();
    const actorId = session.user.id;

    const result = await withMongoTransaction(async (mongoSession) => {
      const claim = await db.collection("claims").findOne({ _id: id }, { session: mongoSession });
      if (!claim) return { status: 404, error: "Claim not found." };
      const report = await db.collection("reports").findOne({ _id: claim.report_id }, { session: mongoSession });
      if (!report || ![claim.claimant_id, report.reporter_id].includes(actorId)) {
        return { status: 404, error: "Claim not found or not authorized." };
      }
      const now = new Date();
      const isOwner = report.reporter_id === actorId;
      const otherParticipant = isOwner ? claim.claimant_id : report.reporter_id;

      if (body.action === "message") {
        if (["declined", "completed"].includes(String(claim.state))) {
          return { status: 409, error: "This claim conversation is closed." };
        }
        const since = new Date(now.getTime() - 60 * 60 * 1000);
        const sentRecently = await db.collection("messages").countDocuments(
          { sender_id: actorId, created_at: { $gte: since } }, { session: mongoSession },
        );
        if (sentRecently >= 60) return { status: 429, error: "Message rate limit reached. Try again later." };
        const text = typeof body.body === "string" ? body.body.trim() : "";
        if (text.length < 1 || text.length > 2000) return { status: 400, error: "Message must be 1–2000 characters." };
        const message = { _id: crypto.randomUUID(), claim_id: id, sender_id: actorId, body: text, created_at: now };
        await db.collection("messages").insertOne(message, { session: mongoSession });
        await db.collection("notifications").insertOne({
          _id: crypto.randomUUID(), user_id: otherParticipant, kind: "claim_message",
          title: "New private claim message", body: report.title, href: `/claims/${id}`, created_at: now,
        }, { session: mongoSession });
        return {
          status: 201,
          message: { id: message._id, isMine: true, body: message.body, created_at: message.created_at },
          emailAlert: {
            recipientEmail: String(otherParticipant),
            subject: `New private message on "${String(report.title)}"`,
            text: `You have a new private claim message regarding "${String(report.title)}".\n\nOpen /claims/${id} in Campus Compass to read and reply.`,
          },
        };
      }

      if (body.action === "handover_proposal") {
        if (!["accepted", "handover"].includes(String(claim.state))) {
          return { status: 409, error: "The report owner must verify the claim before arranging a handover." };
        }
        if (report.kind !== "found" || !["claim_pending", "handover"].includes(String(report.state))) {
          return { status: 409, error: "This item is no longer available for handover." };
        }
        const location = typeof body.location === "string" ? body.location.trim() : "";
        const date = typeof body.date === "string" ? body.date : "";
        const timeWindow = typeof body.time_window === "string" ? body.time_window.trim() : "";
        const note = typeof body.note === "string" ? body.note.trim() : "";
        const isCustomLocation = location === "Other public campus spot";
        if (!handoverLocations.includes(location as (typeof handoverLocations)[number])) {
          return { status: 400, error: "Choose a staffed campus desk or the public campus spot option." };
        }
        if (isCustomLocation && (typeof body.custom_location !== "string" || !body.custom_location.trim() || body.custom_location.trim().length > 160)) {
          return { status: 400, error: "Enter a valid public campus location (maximum 160 characters)." };
        }
        const parsedDate = new Date(`${date}T00:00:00Z`);
        const campusToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || date < campusToday) {
          return { status: 400, error: "Choose today or a future handover date." };
        }
        if (timeWindow.length < 3 || timeWindow.length > 80) return { status: 400, error: "Enter a handover time window." };
        if (note.length > 500) return { status: 400, error: "Handover notes must be 500 characters or fewer." };

        const finalLocation = isCustomLocation ? (body.custom_location as string).trim() : location;
        const handover = {
          location: finalLocation,
          date,
          time_window: timeWindow,
          note,
          proposed_by: actorId,
          proposed_at: now,
          confirmed_by: null as string | null,
          confirmed_at: null as Date | null,
        };
        const proposalMessage = [
          "📍 [Handover Schedule Proposal]",
          `Location: ${finalLocation}`,
          `Date: ${date}`,
          `Time window: ${timeWindow}`,
          note ? `Instructions: ${note}` : "",
          "Safety reminder: Meet at the staffed public campus location and verify each other’s university ID before the exchange.",
        ].filter(Boolean).join("\n");
        await db.collection("messages").insertOne({
          _id: crypto.randomUUID(), claim_id: id, sender_id: actorId, body: proposalMessage, created_at: now,
        }, { session: mongoSession });
        await db.collection("claims").updateOne({ _id: id, state: claim.state }, {
          $set: { state: "handover", handover, updated_at: now },
        }, { session: mongoSession });
        if (claim.state !== "handover") {
          await db.collection("claim_status_history").insertOne({
            _id: crypto.randomUUID(), claim_id: id, actor_id: actorId,
            old_state: claim.state, new_state: "handover", note: "Handover schedule proposed.", created_at: now,
          }, { session: mongoSession });
        } else {
          await db.collection("claim_status_history").insertOne({
            _id: crypto.randomUUID(), claim_id: id, actor_id: actorId,
            old_state: "handover", new_state: "handover", note: "Handover schedule updated; confirmation reset.", created_at: now,
          }, { session: mongoSession });
        }
        await db.collection("reports").updateOne({ _id: report._id }, {
          $set: { state: "handover", updated_at: now },
        }, { session: mongoSession });
        if (report.state !== "handover") {
          await db.collection("status_history").insertOne({
            _id: crypto.randomUUID(), report_id: report._id, actor_id: actorId,
            old_state: report.state, new_state: "handover", created_at: now,
          }, { session: mongoSession });
        }
        await db.collection("notifications").insertOne({
          _id: crypto.randomUUID(), user_id: otherParticipant, kind: "handover_proposed",
          title: "Review the handover plan", body: report.title, href: `/claims/${id}`, created_at: now,
        }, { session: mongoSession });
        return {
          status: 200,
          updated: true,
          handover: {
            location: handover.location,
            date: handover.date,
            time_window: handover.time_window,
            note: handover.note,
            proposed_at: handover.proposed_at,
            proposed_by_you: true,
            confirmed_at: null,
            confirmed: false,
          },
          emailAlert: {
            recipientEmail: String(otherParticipant),
            subject: `Handover plan proposed for "${String(report.title)}"`,
            text: `A campus handover plan was proposed for "${String(report.title)}":\nLocation: ${handover.location}\nDate: ${handover.date}\nTime window: ${handover.time_window}\n\nOpen /claims/${id} in Campus Compass to review and confirm.`,
          },
        };
      }

      if (body.action === "confirm_handover") {
        if (report.state !== "handover") {
          return { status: 409, error: "This item is no longer available for handover confirmation." };
        }
        if (claim.state !== "handover" || !claim.handover?.proposed_by || claim.handover.proposed_by === actorId) {
          return { status: 409, error: "Only the other participant can confirm the current handover plan." };
        }
        if (claim.handover.confirmed_by) {
          return { status: 409, error: "This handover plan is already confirmed." };
        }
        const confirmed = await db.collection("claims").updateOne(
          { _id: id, state: "handover", "handover.confirmed_by": null },
          { $set: { "handover.confirmed_by": actorId, "handover.confirmed_at": now, updated_at: now } },
          { session: mongoSession },
        );
        if (confirmed.modifiedCount !== 1) {
          return { status: 409, error: "The handover plan changed. Refresh and try again." };
        }
        await db.collection("claim_status_history").insertOne({
          _id: crypto.randomUUID(), claim_id: id, actor_id: actorId,
          old_state: "handover", new_state: "handover", note: "Handover plan confirmed by both participants.", created_at: now,
        }, { session: mongoSession });
        await db.collection("notifications").insertOne({
          _id: crypto.randomUUID(), user_id: claim.handover.proposed_by, kind: "handover_confirmed",
          title: "Handover plan confirmed", body: report.title, href: `/claims/${id}`, created_at: now,
        }, { session: mongoSession });
        return {
          status: 200,
          updated: true,
          emailAlert: {
            recipientEmail: String(claim.handover.proposed_by),
            subject: `Handover plan confirmed for "${String(report.title)}"`,
            text: `Both participants have confirmed the handover plan for "${String(report.title)}".\n\nOpen /claims/${id} in Campus Compass for details.`,
          },
        };
      }

      if (!isOwner) return { status: 403, error: "Only the report owner can verify or close this claim." };
      const nextState = typeof body.state === "string" ? body.state : "";
      if (nextState === "handover") {
        return { status: 409, error: "Submit a handover plan before moving this claim to handover." };
      }
      if (!canTransitionClaim(String(claim.state), nextState)) {
        return { status: 409, error: "That claim status change is not allowed from its current stage." };
      }
      if (report.state === "hidden" && nextState !== "declined") {
        return { status: 409, error: "This report has been hidden by a moderator and cannot advance." };
      }
      if (["closed", "returned"].includes(String(report.state)) && nextState !== "declined") {
        return { status: 409, error: "This report is already closed." };
      }
      if (nextState === "completed" && (!claim.handover?.confirmed_by || claim.handover.confirmed_by === claim.handover.proposed_by)) {
        return { status: 409, error: "Both participants must confirm the handover plan before closing the claim." };
      }

      const nextReportState = report.state === "hidden" && nextState === "declined"
        ? "hidden"
        : reportStateForClaim(nextState);
      const claimUpdate: Record<string, unknown> = { state: nextState, updated_at: now };
      if (nextState === "accepted") claimUpdate.verification = { decision: "verified", reviewed_by: actorId, reviewed_at: now };
      if (nextState === "declined") claimUpdate.verification = { decision: "declined", reviewed_by: actorId, reviewed_at: now };
      if (nextState === "completed") claimUpdate.completed_at = now;
      const claimUpdateResult = await db.collection("claims").updateOne({ _id: id, state: claim.state }, {
        $set: claimUpdate,
      }, { session: mongoSession });
      if (claimUpdateResult.modifiedCount !== 1) {
        return { status: 409, error: "This claim changed while you were updating it. Refresh and try again." };
      }
      await db.collection("claim_status_history").insertOne({
        _id: crypto.randomUUID(), claim_id: id, actor_id: actorId,
        old_state: claim.state, new_state: nextState, created_at: now,
      }, { session: mongoSession });
      if (report.state !== nextReportState) {
        await db.collection("reports").updateOne({ _id: report._id }, {
          $set: { state: nextReportState, updated_at: now },
        }, { session: mongoSession });
        await db.collection("status_history").insertOne({
          _id: crypto.randomUUID(), report_id: report._id, actor_id: actorId,
          old_state: report.state, new_state: nextReportState, created_at: now,
        }, { session: mongoSession });
      }
      const stateHeadline = nextState === "accepted"
        ? "Ownership verified"
        : nextState === "more_info"
          ? "More ownership details requested"
          : nextState === "declined"
            ? "Claim declined"
            : "Item handover completed";
      await db.collection("notifications").insertOne({
        _id: crypto.randomUUID(), user_id: claim.claimant_id, kind: `claim_${nextState}`,
        title: stateHeadline,
        body: report.title, href: `/claims/${id}`, created_at: now,
      }, { session: mongoSession });
      return {
        status: 200,
        updated: true,
        state: nextState,
        emailAlert: {
          recipientEmail: String(claim.claimant_id),
          subject: `${stateHeadline}: "${String(report.title)}"`,
          text: `Your claim on "${String(report.title)}" was updated to: ${stateHeadline}.\n\nOpen /claims/${id} in Campus Compass to view the latest status.`,
        },
      };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const { emailAlert, ...publicResponse } = result as Record<string, unknown> & {
      status: number;
      emailAlert?: { recipientEmail: string; subject: string; text: string };
    };
    if (emailAlert) {
      await sendMemberAlertEmail({
        recipientEmail: emailAlert.recipientEmail,
        prefKey: "claims",
        subject: emailAlert.subject,
        text: emailAlert.text,
      }).catch(() => false);
    }
    return NextResponse.json(publicResponse, { status: result.status });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Claim workflow update failed", error);
    return NextResponse.json({ error: "Could not update the claim." }, { status: 503 });
  }
}
