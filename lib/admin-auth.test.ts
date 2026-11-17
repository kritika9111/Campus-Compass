import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  getAdminPortalConfig,
  verifyAdminCredentials,
  verifyAdminSessionToken,
} from "./admin-auth.ts";

const env = {
  ADMIN_EMAIL: "Admin@Campus.edu",
  ADMIN_PASSWORD: "SuperSecretPassword!99",
  ADMIN_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
};

test("Admin portal config requires email, password, and secret (falling back to AUTH_SECRET)", () => {
  assert.equal(getAdminPortalConfig(env)?.email, "admin@campus.edu");
  assert.equal(getAdminPortalConfig({ ...env, ADMIN_PASSWORD: "" }), null);
  assert.equal(
    getAdminPortalConfig({
      ADMIN_EMAIL: "admin@campus.edu",
      ADMIN_PASSWORD: "secret",
      AUTH_SECRET: "fallback-secret",
    })?.secret,
    "fallback-secret",
  );
  assert.equal(
    getAdminPortalConfig({ ADMIN_EMAIL: "admin@campus.edu", ADMIN_PASSWORD: "secret" }),
    null,
  );
});

test("Admin credential verification is case-insensitive on email and strict on password", () => {
  assert.ok(verifyAdminCredentials("  admin@campus.edu ", "SuperSecretPassword!99", env));
  assert.equal(verifyAdminCredentials("admin@campus.edu", "wrong-password", env), null);
  assert.equal(verifyAdminCredentials("other@campus.edu", "SuperSecretPassword!99", env), null);
});

test("Admin session tokens validate signatures, expiry, and matching configured email", () => {
  const now = 1_700_000_000_000;
  const token = createAdminSessionToken("admin@campus.edu", env.ADMIN_SESSION_SECRET, now);

  const verified = verifyAdminSessionToken(token, env, now + 1000);
  assert.equal(verified?.email, "admin@campus.edu");

  // Tampered signature rejected
  assert.equal(verifyAdminSessionToken(`${token}x`, env, now + 1000), null);

  // Expired token rejected
  assert.equal(
    verifyAdminSessionToken(token, env, now + (ADMIN_SESSION_TTL_SECONDS + 5) * 1000),
    null,
  );

  // Secret rotation invalidates existing tokens
  assert.equal(
    verifyAdminSessionToken(token, { ...env, ADMIN_SESSION_SECRET: "rotated-secret" }, now + 1000),
    null,
  );

  // Admin email change invalidates old session
  assert.equal(
    verifyAdminSessionToken(token, { ...env, ADMIN_EMAIL: "newadmin@campus.edu" }, now + 1000),
    null,
  );
});
