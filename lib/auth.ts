export const SESSION_COOKIE = "ln_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days
const PEPPER = "lool-network-desk-session-v1";

const enc = new TextEncoder();

function isProduction(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function configuredPassword(): string | null {
  const raw = process.env.INVESTOR_PASSWORD;
  if (raw && raw.trim()) return raw;
  return null;
}

/** Production refuses to serve without INVESTOR_PASSWORD. Local dev may use `dev`. */
export function investorPassword(): { password: string | null; setupRequired: boolean; usingDevDefault: boolean } {
  const set = configuredPassword();
  if (set) return { password: set, setupRequired: false, usingDevDefault: false };
  if (isProduction()) return { password: null, setupRequired: true, usingDevDefault: false };
  return { password: "dev", setupRequired: false, usingDevDefault: true };
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return hex(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function secretFor(password: string): string {
  return `${PEPPER}:${password}`;
}

export async function mintSession(password: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const exp = String(nowSec + SESSION_MAX_AGE_SEC);
  const payload = `v1.${exp}`;
  const sig = await hmacHex(secretFor(password), payload);
  return `${payload}.${sig}`;
}

export async function verifySession(token: string | undefined | null, password: string): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [ver, expStr, sig] = parts;
  if (ver !== "v1") return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${ver}.${expStr}`;
  const expected = await hmacHex(secretFor(password), payload);
  return timingSafeEqual(sig, expected);
}

export function passwordMatches(given: string, expected: string): boolean {
  return timingSafeEqual(given, expected);
}

export function cookieSerialize(value: string, maxAge = SESSION_MAX_AGE_SEC): string {
  const secure = isProduction() ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function cookieClear(): string {
  const secure = isProduction() ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
