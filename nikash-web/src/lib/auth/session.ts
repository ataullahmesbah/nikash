import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "nikash_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function secretKey() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "ADMIN_JWT_SECRET is missing or too short (set a random 32+ char string in .env.local)"
    );
  }
  return new TextEncoder().encode(secret);
}

export type AdminSession = {
  adminId: string;
  name: string;
  role: "super_admin" | "support_admin";
};

export async function createAdminSession(session: AdminSession) {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      adminId: payload.adminId as string,
      name: payload.name as string,
      role: payload.role as AdminSession["role"],
    };
  } catch {
    return null;
  }
}

// Short-lived token for the gap between "password verified" and "TOTP code
// verified" on a 2FA-enabled account. Deliberately not a cookie — it's
// handed back in the login response body and round-tripped by the client
// in the verify-2fa request, so it never persists past that single flow.
const PENDING_2FA_TTL_SECONDS = 5 * 60;

export async function createPending2faToken(adminId: string) {
  return new SignJWT({ adminId, pending2fa: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_2FA_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyPending2faToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.pending2fa !== true) return null;
    return payload.adminId as string;
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
