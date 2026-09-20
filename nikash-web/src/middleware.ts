import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "nikash_admin_session";

async function isValidSession(token: string | undefined) {
  if (!token) return false;
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // লগইনের রাস্তাগুলো খোলা থাকতেই হবে — /api/admin/login/verify-2fa
  // এখানে আলাদা করে ছাড় না দিলে 2FA চালু করা অ্যাডমিন কখনো ঢুকতেই
  // পারত না (কোড দেওয়ার সময় তো এখনো সেশন কুকি নেই)।
  const isLoginPath =
    pathname === "/admin/login" || pathname.startsWith("/api/admin/login");

  const token = req.cookies.get(COOKIE_NAME)?.value;

  // লগইন পাতায় এসে সেশন আগে থেকেই বৈধ পেলে ফর্ম না দেখিয়ে সোজা
  // ড্যাশবোর্ডে পাঠাই। (শুধু পাতাটা — /api/admin/login-এর POST গুলো
  // খোলা থাকতেই হবে, নইলে কেউ লগইনই করতে পারবে না।)
  if (pathname === "/admin/login") {
    if (await isValidSession(token)) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }

  const isAdminRoute = pathname.startsWith("/admin") && !isLoginPath;
  const isAdminApiRoute = pathname.startsWith("/api/admin") && !isLoginPath;

  if (!isAdminRoute && !isAdminApiRoute) return NextResponse.next();

  const valid = await isValidSession(token);

  if (!valid) {
    if (isAdminApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
