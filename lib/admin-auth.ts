import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const adminCookieName = "medsafe_admin_session";
const sessionDurationSeconds = 8 * 60 * 60;

function getAdminPassword(): string {
  const password = process.env.ADMIN_REVIEW_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("ADMIN_REVIEW_PASSWORD must be set to at least 12 characters.");
  }
  return password;
}

function signature(expiresAt: string): string {
  return createHmac("sha256", getAdminPassword()).update(`admin:${expiresAt}`).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function verifyAdminPassword(candidate: string): boolean {
  return safeEqual(candidate, getAdminPassword());
}

export function createAdminSession(): { value: string; maxAge: number } {
  const expiresAt = String(Math.floor(Date.now() / 1000) + sessionDurationSeconds);
  return { value: `${expiresAt}.${signature(expiresAt)}`, maxAge: sessionDurationSeconds };
}

export function isAdminRequest(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionCookie = cookieHeader.split(";").map(value => value.trim())
    .find(value => value.startsWith(`${adminCookieName}=`));
  if (!sessionCookie) return false;

  let token: string;
  try {
    token = decodeURIComponent(sessionCookie.slice(adminCookieName.length + 1));
  } catch {
    return false;
  }
  const separatorIndex = token.indexOf(".");
  if (separatorIndex < 1) return false;
  const expiresAt = token.slice(0, separatorIndex);
  const suppliedSignature = token.slice(separatorIndex + 1);
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;

  try {
    return safeEqual(suppliedSignature, signature(expiresAt));
  } catch {
    return false;
  }
}

export function adminCookieOptions(maxAge: number) {
  return [
    `${adminCookieName}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : [])
  ];
}
