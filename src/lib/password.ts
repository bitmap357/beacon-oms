/** Argon2id hashing and reset-token helpers. Policy text: password-policy.ts. */
import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes } from "node:crypto";
import { CREDENTIAL_COMPLEXITY, CREDENTIAL_HINT } from "@/lib/password-policy";

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

export { CREDENTIAL_COMPLEXITY, CREDENTIAL_HINT };
