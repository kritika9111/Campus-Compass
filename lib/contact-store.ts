import fs from "node:fs/promises";
import path from "node:path";
import { isDatabaseConfigured } from "@/lib/access";
import { sendEmail } from "@/lib/email";
import { getDb } from "@/lib/mongodb";

export type ContactStatus = "Pending" | "In Progress" | "Resolved";

export type ContactMessageRecord = {
  id: string;
  ticket_id: string;
  name: string;
  email: string;
  party_role: string;
  category: string;
  report_id: string;
  claim_id: string;
  subject: string;
  message: string;
  status: ContactStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

const LOCAL_DATA_DIR = path.join(process.cwd(), ".data");
const LOCAL_CONTACT_FILE = path.join(LOCAL_DATA_DIR, "contact-messages.json");

function toIso(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string" && value) return value;
  return new Date().toISOString();
}

async function readLocalMessages(): Promise<ContactMessageRecord[]> {
  try {
    const raw = await fs.readFile(LOCAL_CONTACT_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ContactMessageRecord[]) : [];
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeLocalMessages(messages: ContactMessageRecord[]): Promise<void> {
  await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
  const tempPath = `${LOCAL_CONTACT_FILE}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(messages, null, 2), "utf8");
  await fs.rename(tempPath, LOCAL_CONTACT_FILE);
}

export async function saveContactMessage(record: ContactMessageRecord): Promise<void> {
  if (isDatabaseConfigured()) {
    const db = await getDb();
    await db.collection("contact_messages").insertOne({
      _id: record.id,
      ticket_id: record.ticket_id,
      name: record.name,
      email: record.email,
      party_role: record.party_role,
      category: record.category,
      report_id: record.report_id,
      claim_id: record.claim_id,
      subject: record.subject,
      message: record.message,
      status: record.status,
      admin_note: record.admin_note,
      created_at: new Date(record.created_at),
      updated_at: new Date(record.updated_at),
    });
    return;
  }

  const existing = await readLocalMessages();
  existing.unshift(record);
  await writeLocalMessages(existing.slice(0, 500));
}

export async function listContactMessages(limit = 100): Promise<ContactMessageRecord[]> {
  if (isDatabaseConfigured()) {
    const db = await getDb();
    const rows = await db
      .collection("contact_messages")
      .find()
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
    return rows.map((x) => ({
      id: String(x._id),
      ticket_id: String(x.ticket_id || ""),
      name: String(x.name || ""),
      email: String(x.email || ""),
      party_role: String(x.party_role || "General member"),
      category: String(x.category || "General Enquiry"),
      report_id: String(x.report_id || ""),
      claim_id: String(x.claim_id || ""),
      subject: String(x.subject || ""),
      message: String(x.message || ""),
      status: (["Pending", "In Progress", "Resolved"].includes(String(x.status))
        ? String(x.status)
        : "Pending") as ContactStatus,
      admin_note: String(x.admin_note || ""),
      created_at: toIso(x.created_at),
      updated_at: toIso(x.updated_at || x.created_at),
    }));
  }

  const rows = await readLocalMessages();
  return rows.slice(0, limit);
}

export async function updateContactMessage(
  id: string,
  patch: { status: ContactStatus; admin_note?: string },
  actorEmail: string,
): Promise<ContactMessageRecord | null> {
  const now = new Date();
  const nowIso = now.toISOString();
  const cleanNote = typeof patch.admin_note === "string" ? patch.admin_note.trim().slice(0, 1000) : undefined;

  if (isDatabaseConfigured()) {
    const db = await getDb();
    const setFields: Record<string, unknown> = { status: patch.status, updated_at: now };
    if (cleanNote !== undefined) setFields.admin_note = cleanNote;

    const updated = await db.collection("contact_messages").findOneAndUpdate(
      { _id: id },
      { $set: setFields },
      { returnDocument: "after" },
    );
    if (!updated) return null;

    const senderEmail = String(updated.email || "").trim().toLowerCase();
    if (senderEmail) {
      const userDoc = await db.collection("users").findOne({ email: senderEmail }, { projection: { _id: 1 } });
      if (userDoc) {
        const noteSuffix = cleanNote ? ` — ${cleanNote.slice(0, 140)}` : "";
        await db.collection("notifications").insertOne({
          _id: crypto.randomUUID(),
          user_id: senderEmail,
          kind: "support_update",
          title: `Support ticket ${String(updated.ticket_id || "")} marked ${patch.status}`,
          body: `${String(updated.subject || "Support request")}${noteSuffix}`,
          href: updated.claim_id
            ? `/claims/${String(updated.claim_id)}`
            : updated.report_id
              ? `/items/${String(updated.report_id)}`
              : "/help",
          created_at: now,
        }).catch(() => undefined);
      }
    }

    await db.collection("moderation_actions").insertOne({
      _id: crypto.randomUUID(),
      report_id: updated.report_id ? String(updated.report_id) : null,
      target_user: senderEmail || null,
      actor_id: actorEmail,
      action: "update_contact_ticket",
      reason: `${String(updated.ticket_id || id)} → ${patch.status}${cleanNote ? ` (${cleanNote.slice(0, 200)})` : ""}`,
      created_at: now,
    }).catch(() => undefined);

    if (senderEmail) {
      await sendEmail({
        to: senderEmail,
        subject: `[${String(updated.ticket_id || "")}] Support ticket updated to ${patch.status}`,
        text: [
          `Hello ${String(updated.name || "Campus member")},`,
          "",
          `Your Campus Compass support ticket (${String(updated.ticket_id || "")}) regarding "${String(updated.subject || "your request")}" has been updated to: ${patch.status}.`,
          cleanNote ? `\nAdministrator note:\n${cleanNote}` : "",
          "\n—\nCampus Compass Support · Lovely Professional University",
        ].filter(Boolean).join("\n"),
      }).catch(() => false);
    }

    return {
      id: String(updated._id),
      ticket_id: String(updated.ticket_id || ""),
      name: String(updated.name || ""),
      email: String(updated.email || ""),
      party_role: String(updated.party_role || "General member"),
      category: String(updated.category || "General Enquiry"),
      report_id: String(updated.report_id || ""),
      claim_id: String(updated.claim_id || ""),
      subject: String(updated.subject || ""),
      message: String(updated.message || ""),
      status: patch.status,
      admin_note: String(updated.admin_note || ""),
      created_at: toIso(updated.created_at),
      updated_at: nowIso,
    };
  }

  const rows = await readLocalMessages();
  const index = rows.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const current = rows[index];
  const next: ContactMessageRecord = {
    ...current,
    status: patch.status,
    admin_note: cleanNote !== undefined ? cleanNote : current.admin_note || "",
    updated_at: nowIso,
  };
  rows[index] = next;
  await writeLocalMessages(rows);
  return next;
}
