import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended Argon2id parameters (2026 password storage cheat sheet
// baseline). Never swap this for bcrypt or a fast general-purpose hash
// (MD5/SHA family) -- that's a bug, not a style choice.
//
// `algorithm: 2` is @node-rs/argon2's `Algorithm.Argon2id` -- imported as a
// literal (not the ambient const enum) because const enums can't cross the
// isolatedModules boundary that Next.js's per-file SWC/Turbopack transforms
// require.
const ARGON2ID_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return hash(plainTextPassword, ARGON2ID_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  plainTextPassword: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, plainTextPassword, ARGON2ID_OPTIONS);
  } catch {
    // Malformed/foreign hash format -- treat as a failed verification, not a crash.
    return false;
  }
}
