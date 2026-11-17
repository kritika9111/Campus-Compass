import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function deriveKey(password: string, saltHex: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, Buffer.from(saltHex, "hex"), KEY_LENGTH, SCRYPT_PARAMS, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const saltHex = randomBytes(16).toString("hex");
  const key = await deriveKey(password, saltHex);
  return `scrypt$${saltHex}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (typeof storedHash !== "string") return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltHex, keyHex] = parts;
  if (!/^[0-9a-f]{32}$/i.test(saltHex) || !/^[0-9a-f]{128}$/i.test(keyHex)) return false;

  const expectedKey = Buffer.from(keyHex, "hex");
  const derivedKey = await deriveKey(password, saltHex);
  if (derivedKey.length !== expectedKey.length) return false;
  return timingSafeEqual(derivedKey, expectedKey);
}
