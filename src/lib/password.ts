/** Argon2id hashing, password rules, and reset-token helpers. Policy text: CREDENTIAL_HINT. */
import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export async function hashPassword(password: string) {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hashValue: string, password: string) {
  try {
    return await verify(hashValue, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createResetToken() {
  const token = randomBytes(32).toString("hex");
  return { token, hash: sha256(token) };
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export const CREDENTIAL_COMPLEXITY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const CREDENTIAL_HINT =
  "At least 8 characters, with uppercase, lowercase, a number, and a special character.";
