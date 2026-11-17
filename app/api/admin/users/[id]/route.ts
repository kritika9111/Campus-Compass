import { NextResponse } from "next/server";
import { getAdminAccess, isDatabaseConfigured } from "@/lib/access";
import { sendEmail } from "@/lib/email";
import { isSameOrigin, readJsonObject, RequestBodyError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/password";
import { adminUserUpdateInput } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
    }
    const admin = await getAdminAccess();
    if (!admin.isAdmin) {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "MongoDB is not configured." }, { status: 503 });
    }

    const { id } = await params;
    const targetEmail = decodeURIComponent(id).trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const body = await readJsonObject(request);
    const parsed = adminUserUpdateInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid update." }, { status: 400 });
    }

    const db = await getDb();
    const targetUser = await db.collection("users").findOne({ email: targetEmail });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const isSelf = targetEmail === admin.actorEmail.toLowerCase();
    if (isSelf && parsed.data.auth_status === "suspended") {
      return NextResponse.json({ error: "You cannot suspend your own administrator account." }, { status: 409 });
    }
    if (isSelf && parsed.data.role && parsed.data.role !== "admin") {
      return NextResponse.json({ error: "You cannot remove your own administrator role." }, { status: 409 });
    }

    const now = new Date();
    const updateFields: Record<string, unknown> = { updated_at: now };
    const changeSummary: string[] = [];

    if (parsed.data.role && parsed.data.role !== (targetUser.role || "member")) {
      updateFields.role = parsed.data.role;
      changeSummary.push(`role: ${targetUser.role || "member"} → ${parsed.data.role}`);
    }
    if (parsed.data.auth_status && parsed.data.auth_status !== (targetUser.auth_status || "approved")) {
      updateFields.auth_status = parsed.data.auth_status;
      updateFields.status_reason = parsed.data.auth_status === "suspended" ? (parsed.data.reason || "Suspended by administrator") : "";
      changeSummary.push(`status: ${targetUser.auth_status || "approved"} → ${parsed.data.auth_status}`);
    }
    if (parsed.data.new_password) {
      updateFields.password_hash = await hashPassword(parsed.data.new_password);
      changeSummary.push("password reset");
    }

    if (changeSummary.length === 0) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    await db.collection("users").updateOne({ email: targetEmail }, { $set: updateFields });
    await db.collection("moderation_actions").insertOne({
      _id: crypto.randomUUID(),
      report_id: null,
      target_user: targetEmail,
      actor_id: admin.actorEmail,
      action: parsed.data.new_password
        ? "reset_user_password"
        : parsed.data.auth_status === "suspended"
          ? "suspend_user"
          : parsed.data.auth_status === "approved"
            ? "approve_user"
            : "update_user_role",
      reason: [changeSummary.join(", "), parsed.data.reason].filter(Boolean).join(" — ").slice(0, 500),
      created_at: now,
    });

    if (parsed.data.new_password) {
      await db.collection("notifications").insertOne({
        _id: crypto.randomUUID(),
        user_id: targetEmail,
        kind: "password_reset",
        title: "Your password was reset by an administrator",
        body: "Sign in with your temporary password and update it immediately in Settings.",
        href: "/settings",
        created_at: now,
      }).catch(() => undefined);

      await sendEmail({
        to: targetEmail,
        subject: "[Campus Compass] Your account password was reset",
        text: "A Campus Compass administrator reset your account password. Sign in with the temporary password provided by the admin and change it right away on the Settings page.",
      }).catch(() => false);
    }

    return NextResponse.json({
      ok: true,
      passwordReset: Boolean(parsed.data.new_password),
      user: {
        email: targetEmail,
        role: (updateFields.role ?? targetUser.role ?? "member") as string,
        auth_status: (updateFields.auth_status ?? targetUser.auth_status ?? "approved") as string,
      },
    });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin user update failed", error);
    return NextResponse.json({ error: "Could not update the user account." }, { status: 503 });
  }
}
