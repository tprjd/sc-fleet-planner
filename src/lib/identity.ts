import { nanoid } from "nanoid";

const MEMBER_ID_KEY = "fp.memberId";
const DISPLAY_NAME_KEY = "fp.displayName";
const FLEET_CODE_KEY = "fp.currentFleetCode";

/** Stable per-browser member id, created on first access. */
export function getMemberId(): string {
  let id = localStorage.getItem(MEMBER_ID_KEY);
  if (!id) {
    id = `m_${nanoid(10)}`;
    localStorage.setItem(MEMBER_ID_KEY, id);
  }
  return id;
}

export function getDisplayName(): string {
  return localStorage.getItem(DISPLAY_NAME_KEY) ?? "";
}

export function setDisplayName(name: string): void {
  localStorage.setItem(DISPLAY_NAME_KEY, name.trim());
}

export function getCurrentFleetCode(): string | null {
  return localStorage.getItem(FLEET_CODE_KEY);
}

export function setCurrentFleetCode(code: string | null): void {
  if (code) localStorage.setItem(FLEET_CODE_KEY, code);
  else localStorage.removeItem(FLEET_CODE_KEY);
}

// ---- Per-fleet session tokens ----------------------------------------
// The Worker issues a private token to each member when they join a
// fleet. Clients must send it back on every (re)connection; the Worker
// rejects connections from a known memberId without the matching token.
// Stored as one JSON blob keyed by fleet code.

const TOKENS_KEY = "fp.tokens";

function readTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getToken(code: string): string | undefined {
  return readTokens()[code];
}

export function setToken(code: string, token: string): void {
  const tokens = readTokens();
  tokens[code] = token;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearToken(code: string): void {
  const tokens = readTokens();
  if (!(code in tokens)) return;
  delete tokens[code];
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}
