// PIN hashing and login throttling.
//
// DEMO NOTE: everything runs in the browser, so this is not real security. The PIN is salted and
// hashed (SHA-256 via Web Crypto) only so that PINs are not kept as plain text in storage.

export async function hashPin(pin, salt) {
  const text = `${salt}:${pin}`;
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for insecure contexts (plain http on a LAN address): FNV-1a, not cryptographic.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv-${h.toString(16)}`;
}

export function randomSalt() {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const MAX_ATTEMPTS = 5;
export const LOCK_MS = 30_000;

export const initialLockout = () => ({ failures: 0, until: 0 });

export function isLocked(state, now) {
  return state.until > now;
}

export function remainingSeconds(state, now) {
  return Math.max(0, Math.ceil((state.until - now) / 1000));
}

/** Returns the next lockout state after a failed attempt. */
export function registerFailure(state, now) {
  // A lock that has expired starts a fresh series of attempts.
  const base = state.until && state.until <= now ? initialLockout() : state;
  const failures = base.failures + 1;
  if (failures >= MAX_ATTEMPTS) return { failures: 0, until: now + LOCK_MS };
  return { failures, until: 0 };
}
