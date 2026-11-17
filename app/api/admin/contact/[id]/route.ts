import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/access";
import { updateContactMessage, type ContactStatus } from "@/lib/contact-store";
import { isSameOrigin, readJsonObject, RequestBodyError } from "@/lib/http";

const statuses: readonly ContactStatus[] = ["Pending", "In Progress", "Resolved"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
    const admin = await getAdminAccess();
    if (!admin.isAdmin) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const { id } = await params;
    if (!uuidPattern.test(id)) return NextResponse.json({ error: "Message not found." }, { status: 404 });

    const body = await readJsonObject(request);
    const status = body.status;
    if (typeof status !== "string" || !statuses.includes(status as ContactStatus)) {
      return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
    }
    const adminNote = typeof body.admin_note === "string" ? body.admin_note : undefined;

    const updated = await updateContactMessage(
      id,
      { status: status as ContactStatus, admin_note: adminNote },
      admin.actorEmail,
    );
    if (!updated) return NextResponse.json({ error: "Message not found." }, { status: 404 });
    return NextResponse.json({ ok: true, item: updated });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Admin contact status update failed", error);
    return NextResponse.json({ error: "Could not update the message status." }, { status: 503 });
  }
}
