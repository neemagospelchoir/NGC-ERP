/**
 * Token generation/verification for the organizer's token-based access
 * model — the same shape as `applications/token.ts` (ARCHITECTURE.md
 * §5.1: "a signed, expiring token tied to a single record... re-verified
 * by a secondary identifier"), deliberately re-implemented here rather
 * than imported from `applications/` so this module stays independently
 * reviewable and doesn't reach into another module's internals for a
 * ~40-line crypto utility. `invitations` has intentionally NO anon/
 * authenticated RLS policy for the organizer's own record
 * (0008_invitations_events.sql) — every organizer-facing operation runs
 * through the RLS-bypassing service-role client, which makes the check
 * performed here the ENTIRE authorization boundary for that path, not a
 * defense-in-depth layer on top of RLS.
 */

const TOKEN_BYTES = 32;

export function generateAccessToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return base64UrlEncode(bytes);
}

export async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bufferToHex(digest);
}

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
