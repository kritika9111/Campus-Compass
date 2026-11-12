import test from "node:test";
import assert from "node:assert/strict";
import { passwordSchema, signUpInput, reportInput, claimInput } from "./validation.ts";

test("Password Rules: Rejects invalid passwords", () => {
  // Too short
  assert.equal(passwordSchema.safeParse("Short1!").success, false);
  // Missing uppercase
  assert.equal(passwordSchema.safeParse("lowercase1!").success, false);
  // Missing lowercase
  assert.equal(passwordSchema.safeParse("UPPERCASE1!").success, false);
  // Missing number
  assert.equal(passwordSchema.safeParse("NoNumber!Pass").success, false);
  // Missing special character
  assert.equal(passwordSchema.safeParse("NoSpecial123").success, false);
});

test("Password Rules: Accepts strong passwords", () => {
  assert.equal(passwordSchema.safeParse("Campus#2026").success, true);
  assert.equal(passwordSchema.safeParse("SecurePass@1").success, true);
  assert.equal(passwordSchema.safeParse("LpuLost&Found9").success, true);
});

test("SignUp Schema: Validates registration fields", () => {
  const valid = signUpInput.safeParse({
    fullName: "Aman Sharma",
    email: "aman@domain.com",
    password: "Campus#2026",
  });
  assert.equal(valid.success, true);

  const missingName = signUpInput.safeParse({
    fullName: " ",
    email: "aman@domain.com",
    password: "Campus#2026",
  });
  assert.equal(missingName.success, false);

  const invalidEmail = signUpInput.safeParse({
    fullName: "Aman Sharma",
    email: "not-an-email",
    password: "Campus#2026",
  });
  assert.equal(invalidEmail.success, false);
});

test("Report Input: Validates campus report constraints", () => {
  const valid = reportInput.safeParse({
    kind: "lost",
    title: "Casio Calculator",
    category: "Electronics",
    description: "Left in the library study zone on the second floor.",
    location: "Central Library",
    happened_at: new Date(Date.now() - 3600000).toISOString(),
  });
  assert.equal(valid.success, true);

  // Future date rejected
  const futureDate = reportInput.safeParse({
    kind: "lost",
    title: "Casio Calculator",
    category: "Electronics",
    description: "Left in the library study zone on the second floor.",
    location: "Central Library",
    happened_at: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(futureDate.success, false);
});

test("Claim Input: Validates private claim evidence constraints", () => {
  const valid = claimInput.safeParse({
    report_id: "12345678-1234-1234-1234-123456789abc",
    ownership_details: "Has an orange sticker on the lower left corner and my name written inside.",
  });
  assert.equal(valid.success, true);

  // Too short details
  const tooShort = claimInput.safeParse({
    report_id: "12345678-1234-1234-1234-123456789abc",
    ownership_details: "Mine",
  });
  assert.equal(tooShort.success, false);
});
