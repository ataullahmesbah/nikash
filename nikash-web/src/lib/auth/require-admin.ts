import { NextResponse } from "next/server";
import { getAdminSession } from "./session";

// Use inside API route handlers. Returns the session, or an early
// NextResponse(401) you must return immediately if `res` is set.
export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) {
    return {
      session: null,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, res: null };
}

export function requireSuperAdmin(session: { role: string }) {
  return session.role === "super_admin";
}
