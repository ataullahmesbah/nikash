import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { verifyTotpCode } from "@/lib/auth/totp";
import { logAdminAction } from "@/lib/audit";

// Requires a valid current TOTP code before disabling — otherwise anyone
// with just a stolen session cookie could turn 2FA off.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "কোড দিন" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: admin } = await db
    .from("platform_admins")
    .select("totp_secret, is_2fa_enabled")
    .eq("id", session.adminId)
    .maybeSingle();

  if (!admin?.is_2fa_enabled || !admin.totp_secret) {
    return NextResponse.json({ error: "2FA চালু নেই" }, { status: 400 });
  }

  if (!(await verifyTotpCode(admin.totp_secret, code))) {
    return NextResponse.json({ error: "ভুল কোড" }, { status: 401 });
  }

  await db
    .from("platform_admins")
    .update({ is_2fa_enabled: false, totp_secret: null })
    .eq("id", session.adminId);
  await logAdminAction({ adminId: session.adminId, action: "disable_2fa" });

  return NextResponse.json({ ok: true });
}
