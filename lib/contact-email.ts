import nodemailer from "nodemailer";
import type { SendMailOptions, Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

export type ContactNotification = {
  ticketId: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
};

export type ContactSmtpConfig = {
  host: string;
  port: number;
  secure: true;
  user: string;
  appPassword: string;
  adminEmail: string;
};

export function getContactSmtpConfig(env: Record<string, string | undefined> = process.env): ContactSmtpConfig | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_APP_PASSWORD, CONTACT_ADMIN_EMAIL } = env;
  const port = Number(SMTP_PORT);
  if (!SMTP_HOST || !SMTP_PORT || !Number.isInteger(port) || !SMTP_USER || !SMTP_APP_PASSWORD || !CONTACT_ADMIN_EMAIL || SMTP_SECURE !== "true") return null;
  return { host: SMTP_HOST, port, secure: true, user: SMTP_USER, appPassword: SMTP_APP_PASSWORD, adminEmail: CONTACT_ADMIN_EMAIL };
}

type MailTransport = Pick<Transporter, "sendMail" | "close">;
type TransportFactory = (options: SMTPTransport.Options) => MailTransport;

export async function sendContactNotification(
  notification: ContactNotification,
  env: Record<string, string | undefined> = process.env,
  createTransport: TransportFactory = nodemailer.createTransport,
): Promise<boolean> {
  const config = getContactSmtpConfig(env);
  if (!config) return false;

  let transport: MailTransport | undefined;
  try {
    transport = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.appPassword },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
    });
    const result = await transport.sendMail({
      from: { name: "Campus Compass Support", address: config.user },
      to: config.adminEmail,
      replyTo: notification.email,
      subject: `[${notification.ticketId}] ${notification.category}: ${notification.subject}`,
      text: `Ticket: ${notification.ticketId}\nFrom: ${notification.name} <${notification.email}>\nCategory: ${notification.category}\n\n${notification.message}`,
    } satisfies SendMailOptions);
    const accepted = result && typeof result === "object" && "accepted" in result ? result.accepted : undefined;
    if (Array.isArray(accepted) && !accepted.some((recipient) => {
      if (typeof recipient === "string") return recipient.toLowerCase() === config.adminEmail.toLowerCase();
      return typeof recipient === "object" && recipient !== null && "address" in recipient &&
        typeof recipient.address === "string" && recipient.address.toLowerCase() === config.adminEmail.toLowerCase();
    })) {
      console.error("[contact] Gmail SMTP did not accept the administrator recipient (EENVELOPE)");
      return false;
    }
    return true;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code.slice(0, 40)
      : "UNKNOWN";
    console.error(`[contact] Gmail SMTP notification failed (${code})`);
    return false;
  } finally {
    transport?.close();
  }
}
