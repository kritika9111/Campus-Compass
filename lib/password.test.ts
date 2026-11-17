import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./password.ts";

test("Password hashing verifies correct passwords and rejects wrong or malformed hashes", async () => {
  const hash = await hashPassword("Campus#2026");
  assert.equal(hash.startsWith("scrypt$"), true);

  assert.equal(await verifyPassword("Campus#2026", hash), true);
  assert.equal(await verifyPassword("WrongPass#2026", hash), false);
  assert.equal(await verifyPassword("Campus#2026", "not-a-valid-hash"), false);

  // Salted hashes differ for the same password
  const secondHash = await hashPassword("Campus#2026");
  assert.notEqual(hash, secondHash);
  assert.equal(await verifyPassword("Campus#2026", secondHash), true);
});
