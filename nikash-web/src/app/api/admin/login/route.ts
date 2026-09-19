import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/auth/password";
import { createAdminSession, createPending2faToken } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/audit";
import { RATE, clientIp, rateLimited } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ভুল রিকোয়েস্ট" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email এবং password দুটোই দিন" },
      { status: 400 }
    );
  }

  // ব্রুট-ফোর্স ঠেকাই — IP ধরে, আবার ইমেইল ধরেও (বিভিন্ন IP থেকে একই
  // অ্যাকাউন্টে হানা দিলেও ধরা পড়ে)।
  if (
    rateLimited(`admin-login:ip:${ip}`, RATE.adminLogin) ||
    rateLimited(`admin-login:email:${email.toLowerCase().trim()}`, RATE.adminLogin)
  ) {
    return NextResponse.json(
      { error: "অনেকবার ভুল চেষ্টা হয়েছে — ১৫ মিনিট পরে আবার দেখুন" },
      { status: 429 }
    );
  }

  const db = supabaseAdmin();
  const { data: admin, error } = await db
    .from("platform_admins")
    .select("id, name, email, password_hash, role, is_active, is_2fa_enabled")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (error || !admin || !admin.is_active) {
    await db.from("login_history").insert({
      user_type: "admin",
      success: false,
      failure_reason: "invalid_email",
      ip_address: ip,
    });
    return NextResponse.json({ error: "ভুল ইমেইল বা পাসওয়ার্ড" }, { status: 401 });
  }

  const ok = await verifyPassword(password, admin.password_hash);
  if (!ok) {
    await db.from("login_history").insert({
      user_id: admin.id,
      user_type: "admin",
      success: false,
      failure_reason: "invalid_password",
      ip_address: ip,
    });
    return NextResponse.json({ error: "ভুল ইমেইল বা পাসওয়ার্ড" }, { status: 401 });
  }

  // PRD 21.3 — 2FA (TOTP) is opt-in per admin. When enabled, the password
  // step alone doesn't grant a session; the client must submit the TOTP
  // code to /api/admin/login/verify-2fa using the pending token below.
  if (admin.is_2fa_enabled) {
    const pendingToken = await createPending2faToken(admin.id);
    return NextResponse.json({ require2fa: true, pendingToken });
  }

  await createAdminSession({ adminId: admin.id, name: admin.name, role: admin.role });

  await db
    .from("platform_admins")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", admin.id);

  await db.from("login_history").insert({
    user_id: admin.id,
    user_type: "admin",
    success: true,
    ip_address: ip,
  });

  await logAdminAction({ adminId: admin.id, action: "login", ipAddress: ip });

  return NextResponse.json({ ok: true, name: admin.name, role: admin.role });
}
