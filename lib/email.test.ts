import assert from "node:assert/strict";
import test from "node:test";
import { getEmailConfig, sendContactNotification, sendEmail } from "./email.ts";

const env = {
  RESEND_API_KEY: "re_test_123456789",
  EMAIL_FROM: "Campus Compass <support@example.com>",
  CONTACT_ADMIN_EMAIL: "admin@example.com",
};

const notification = {
  ticketId: "CC-0123456789AB",
  name: "Test Sender",
  email: "sender@example.com",
  partyRole: "Lost item owner",
  category: "Handover Dispute — Finder Refuses Return",
  subject: "Test subject",
  message: "This is a test message body.",
};

test("Email config requires RESEND_API_KEY and EMAIL_FROM", () => {
  assert.equal(getEmailConfig(env)?.from, "Campus Compass <support@example.com>");
  assert.equal(getEmailConfig({ ...env, RESEND_API_KEY: "" }), null);
  assert.equal(getEmailConfig({ ...env, EMAIL_FROM: "" }), null);
});

test("contact notification sends plain-text payload via HTTP Resend API and strips header newlines", async () => {
  let capturedUrl = "";
  let capturedHeaders: Record<string, string> = {};
  let capturedBody: Record<string, unknown> = {};

  const mockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
    capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
  }) as typeof fetch;

  const sent = await sendContactNotification(
    { ...notification, name: "Test\r\nSender", subject: "Line 1\r\nBcc: evil@example.com" },
    env,
    mockFetch,
  );

  assert.equal(sent, true);
  assert.equal(capturedUrl, "https://api.resend.com/emails");
  assert.equal(capturedHeaders.Authorization, "Bearer re_test_123456789");
  assert.deepEqual(capturedBody.to, ["admin@example.com"]);
  assert.equal(capturedBody.reply_to, "sender@example.com");
  assert.equal(String(capturedBody.subject).includes("\n"), false);
  assert.equal(String(capturedBody.subject).includes("\r"), false);
  assert.match(String(capturedBody.text), /CC-0123456789AB/);
  assert.match(String(capturedBody.text), /Lost item owner/);
});

test("unconfigured, non-2xx, or failing HTTP email requests return false without throwing", async () => {
  assert.equal(await sendContactNotification(notification, { ...env, RESEND_API_KEY: "" }), false);
  assert.equal(await sendContactNotification(notification, { ...env, CONTACT_ADMIN_EMAIL: "" }), false);

  const originalError = console.error;
  console.error = () => {};
  try {
    const failedStatus = await sendEmail(
      { to: "user@example.com", subject: "Hello", text: "Body" },
      env,
      (async () => new Response("Unauthorized", { status: 401 })) as typeof fetch,
    );
    assert.equal(failedStatus, false);

    const networkError = await sendEmail(
      { to: "user@example.com", subject: "Hello", text: "Body" },
      env,
      (async () => { throw new Error("Network down"); }) as typeof fetch,
    );
    assert.equal(networkError, false);
  } finally {
    console.error = originalError;
  }
});
