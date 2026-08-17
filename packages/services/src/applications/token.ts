/**
 * Token generation/verification for the applicant's token-based access
 * model (ARCHITECTURE.md §5.1): "a signed, expiring token tied to a single
 * applications row... re-verified by a secondary identifier". Applicants
 * never get a Supabase Auth session, so `applications` has intentionally
 * NO anon/authenticated RLS policy at all (0005_onboarding.sql) — every
 * applicant-facing operation runs through the RLS-bypassing service-role
 * client, which makes the token check performed here the ENTIRE
 * authorization boundary for that path, not a defense-in-depth layer on
 * top of RLS. Get this wrong and any anonymous caller can read/edit any
 * application.
 *
 * Uses Web Crypto (`globalThis.crypto.subtle`), not Node's `crypto` module,
 * so this stays usable from an Edge Function runtime as well as Next.js
 * (packages/services is framework-agnostic — ARCHITECTURE.md §3).
 */

const TOKEN_BYTES = 32; // 256 bits — matches a typical session-token strength

/** A random, URL-safe token shown to the applicant exactly once at creation time. Never stored raw — only its hash (see hashToken) persists in the database. */
export function generateAccessToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return base64UrlEncode(bytes);
}

/** SHA-256 hex digest of the raw token — what actually persists in `applications.access_token_hash`. */
export async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bufferToHex(digest);
}

/**
 * Constant-time-ish comparison of two hex digest strings. A hash
 * comparison is already far less timing-sensitive than comparing the raw
 * secret (an attacker learns nothing usable about the secret from timing
 * differences in a hash of it), but this avoids a short-circuiting
 * `===`/`localeCompare` anyway as cheap, standard practice for anything
 * gating access to a record.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
