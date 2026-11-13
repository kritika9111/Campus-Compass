import assert from "node:assert/strict";
import test from "node:test";
import { getContactSmtpConfig, sendContactNotification } from "./contact-email.ts";

const env = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USER: "support@example.com",
  SMTP_APP_PASSWORD: "test-app-password",
  CONTACT_ADMIN_EMAIL: "admin@example.com",
};

const notification = {
  ticketId: "CC-0123456789AB",
  name: "Test Sender",
  email: "sender@example.com",
  category: "General Enquiry",
  subject: "Test subject",
  message: "This is a test message body.",
};

test("Gmail SMTP config requires all server-only values and TLS on port 465", () => {
  assert.equal(getContactSmtpConfig(env)?.port, 465);
  assert.equal(getContactSmtpConfig({ ...env, SMTP_APP_PASSWORD: "" }), null);
  assert.equal(getContactSmtpConfig({ ...env, SMTP_SECURE: "false" }), null);
  assert.equal(getContactSmtpConfig({ ...env, SMTP_PORT: "bad" }), null);
});

test("contact notification sends a plain-text ticket through the configured transport", async () => {
  let message: Record<string, unknown> | undefined;
  let options: Record<string, unknown> | undefined;
  const sent = await sendContactNotification(notification, env, (value) => {
    options = value as Record<string, unknown>;
    return {
      async sendMail(value) { message = value as Record<string, unknown>; return { messageId: "test-id", accepted: ["admin@example.com"] }; },
      close() {},
    };
  });

  assert.equal(sent, true);
  assert.equal(options?.host, "smtp.gmail.com");
  assert.equal(options?.port, 465);
  assert.equal(options?.secure, true);
  assert.equal((options?.auth as { pass: string }).pass, "test-app-password");
  assert.equal(message?.to, "admin@example.com");
  assert.equal(message?.replyTo, "sender@example.com");
  assert.match(String(message?.text), /CC-0123456789AB/);
});

test("unconfigured or failing SMTP returns false without throwing", async () => {
  assert.equal(await sendContactNotification(notification, { ...env, SMTP_APP_PASSWORD: "" }), false);

  const originalError = console.error;
  console.error = () => {};
  try {
    const sent = await sendContactNotification(notification, env, () => ({
      async sendMail() { throw Object.assign(new Error("SMTP failed"), { code: "EAUTH" }); },
      close() {},
    }));
    assert.equal(sent, false);
  } finally {
    console.error = originalError;
  }
});

test("rejected SMTP recipients are reported as an email failure", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const sent = await sendContactNotification(notification, env, () => ({
      async sendMail() { return { accepted: [], rejected: ["admin@example.com"] }; },
      close() {},
    }));
    assert.equal(sent, false);
  } finally {
    console.error = originalError;
  }
});
