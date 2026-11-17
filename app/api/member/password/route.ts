import { NextResponse } from "next/server";
import { getMember } from "@/lib/access";
import { isSameOrigin, readJsonObject, RequestBodyError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import { hashPassword, verifyPassword } from "@/lib/password";
import { changePasswordInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
    }
    const { approved, user } = await getMember();
    if (!approved || !user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const body = await readJsonObject(request);
    const parsed = changePasswordInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Choose a valid new password." },
        { status: 400 },
      );
    }

    const db = await getDb();
    const userDoc = await db.collection("users").findOne({ email: user.email });
    if (!userDoc) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const hasExistingPassword = typeof userDoc.password_hash === "string" && userDoc.password_hash.length > 0;
    if (hasExistingPassword) {
      if (!parsed.data.currentPassword) {
        return NextResponse.json({ error: "Enter your current password." }, { status: 400 });
      }
      const matches = await verifyPassword(parsed.data.currentPassword, userDoc.password_hash);
      if (!matches) {
        return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
      }
      if (parsed.data.currentPassword === parsed.data.newPassword) {
        return NextResponse.json({ error: "Your new password must be different from your current password." }, { status: 400 });
      }
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    await db.collection("users").updateOne(
      { email: user.email },
      { $set: { password_hash: newHash, updated_at: new Date() } },
    );

    return NextResponse.json({
      ok: true,
      message: hasExistingPassword ? "Password updated successfully." : "Password set. You can now also sign in with email and password.",
    });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Password change failed", error);
    return NextResponse.json({ error: "Could not update your password right now." }, { status: 503 });
  }
}
