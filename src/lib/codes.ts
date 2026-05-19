import { customAlphabet } from "nanoid";

// Unambiguous alphabet — no 0/O/1/I.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const nano = customAlphabet(ALPHABET, 6);

/** Generate a 6-character fleet code. */
export function generateFleetCode(): string {
  return nano();
}

/** Normalize user-typed codes (uppercase, strip junk) for lookup. */
export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .split("")
    .filter((c) => ALPHABET.includes(c))
    .join("");
}

/** Whether a normalized code is structurally valid. */
export function isValidCode(code: string): boolean {
  return code.length === 6;
}
