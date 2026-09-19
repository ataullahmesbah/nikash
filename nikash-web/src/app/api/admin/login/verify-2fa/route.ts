import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAdminSession, verifyPending2faToken } from "@/lib/auth/session";
import { verifyTotpCode } from "@/lib/auth/totp";
import { logAdminAction } from "@/lib/audit";
import { RATE, clientIp, rateLimited } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  let body: { pendingToken?: unknown; code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ভুল রিকোয়েস্ট" }, { status: 400 });
  }

  const pendingToken = typeof body.pendingToken === "string" ? body.pendingToken : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!pendingToken || !code) {
    return NextResponse.json({ error: "কোড দিন" }, { status: 400 });
  }

  const adminId = await verifyPending2faToken(pendingToken);
  if (!adminId) {
    return NextResponse.json({ error: "সেশনের মেয়াদ শেষ, আবার লগইন করুন" }, { status: 401 });
  }

  // কোডটা মাত্র ৬ সংখ্যার — সীমা না দিলে অনুমান করে বের করে ফেলা সম্ভব
  if (
    rateLimited(`totp:ip:${ip}`, RATE.totp) ||
    rateLimited(`totp:admin:${adminId}`, RATE.totp)
  ) {
    return NextResponse.json(
      { error: "অনেকবার ভুল কোড দেওয়া হয়েছে — ১৫ মিনিট পরে আবার দেখুন" },
      { status: 429 }
    );
  }

  const db = supabaseAdmin();

  const { data: admin } = await db
    .from("platform_admins")
    .select("id, name, role, is_active, totp_secret")
    .eq("id", adminId)
    .maybeSingle();

  if (!admin || !admin.is_active || !admin.totp_secret) {
    return NextResponse.json({ error: "অ্যাকাউন্ট পাওয়া যায়নি" }, { status: 401 });
  }

  const ok = await verifyTotpCode(admin.totp_secret, code);
  if (!ok) {
    await db.from("login_history").insert({
      user_id: admin.id,
      user_type: "admin",
      success: false,
      failure_reason: "invalid_totp",
      ip_address: ip,
    });
    return NextResponse.json({ error: "ভুল কোড" }, { status: 401 });
  }

  await createAdminSession({ adminId: admin.id, name: admin.name, role: admin.role });

  await db.from("platform_admins").update({ last_login_at: new Date().toISOString() }).eq("id", admin.id);

  await db.from("login_history").insert({
    user_id: admin.id,
    user_type: "admin",
    success: true,
    ip_address: ip,
  });

  await logAdminAction({ adminId: admin.id, action: "login", ipAddress: ip });

  return NextResponse.json({ ok: true, name: admin.name, role: admin.role });
}
