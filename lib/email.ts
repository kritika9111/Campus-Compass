export type EmailConfig = {
  apiKey: string;
  from: string;
  adminEmail?: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export type ContactNotification = {
  ticketId: string;
  name: string;
  email: string;
  partyRole?: string;
  category: string;
  reportId?: string;
  claimId?: string;
  subject: string;
  message: string;
};

const singleLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

export function getEmailConfig(
  env: Record<string, string | undefined> = process.env,
): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  const adminEmail = env.CONTACT_ADMIN_EMAIL?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from, adminEmail: adminEmail || undefined };
}

export async function sendEmail(
  message: EmailMessage,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const config = getEmailConfig(env);
  if (!config) return false;

  const to = singleLine(message.to);
  if (!to || !to.includes("@")) return false;

  const payload: Record<string, unknown> = {
    from: singleLine(config.from),
    to: [to],
    subject: singleLine(message.subject).slice(0, 200),
    text: message.text,
  };
  if (message.replyTo) {
    payload.reply_to = singleLine(message.replyTo);
  }

  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error(`[email] Resend API returned HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    const code = error instanceof Error ? error.name : "UNKNOWN";
    console.error(`[email] Email delivery failed (${code})`);
    return false;
  }
}

export async function sendContactNotification(
  notification: ContactNotification,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const config = getEmailConfig(env);
  if (!config?.adminEmail) return false;

  const safeTicketId = singleLine(notification.ticketId);
  const safeCategory = singleLine(notification.category);
  const safeSubject = singleLine(notification.subject);
  const safeName = singleLine(notification.name);
  const safeEmail = singleLine(notification.email);
  const extraLines = [
    notification.partyRole ? `Role: ${singleLine(notification.partyRole)}` : "",
    notification.reportId ? `Report ID: ${singleLine(notification.reportId)}` : "",
    notification.claimId ? `Claim ID: ${singleLine(notification.claimId)}` : "",
  ].filter(Boolean);

  const headerBlock = [
    `Ticket: ${safeTicketId}`,
    `From: ${safeName} <${safeEmail}>`,
    `Category: ${safeCategory}`,
    ...extraLines,
  ].join("\n");

  return sendEmail(
    {
      to: config.adminEmail,
      replyTo: safeEmail,
      subject: `[${safeTicketId}] ${safeCategory}: ${safeSubject}`,
      text: `${headerBlock}\n\n${notification.message}`,
    },
    env,
    fetchImpl,
  );
}

export async function sendMemberAlertEmail({
  recipientEmail,
  prefKey,
  subject,
  text,
}: {
  recipientEmail: string;
  prefKey: "claims" | "updates";
  subject: string;
  text: string;
}): Promise<boolean> {
  if (!getEmailConfig()) return false;
  const normalized = recipientEmail.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return false;

  try {
    const { getDb } = await import("@/lib/mongodb");
    const db = await getDb();
    const prefs = await db.collection("member_preferences").findOne(
      { user_id: normalized },
      { projection: { notification_preferences: 1 } },
    );
    const enabled = prefs?.notification_preferences?.[prefKey];
    if (enabled === false) return false;
  } catch {
    // If preference lookup fails, skip silently rather than failing the primary action.
    return false;
  }

  return sendEmail({
    to: normalized,
    subject: `[Campus Compass] ${subject}`,
    text: `${text}\n\n—\nCampus Compass · Lovely Professional University\nManage notification settings anytime in your Settings page.`,
  });
}
