import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { verifyTotpCode } from "@/lib/auth/totp";
import { logAdminAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "কোড দিন" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: admin } = await db
    .from("platform_admins")
    .select("totp_secret")
    .eq("id", session.adminId)
    .maybeSingle();

  if (!admin?.totp_secret) {
    return NextResponse.json({ error: "আগে সেটআপ শুরু করুন" }, { status: 400 });
  }

  if (!(await verifyTotpCode(admin.totp_secret, code))) {
    return NextResponse.json({ error: "ভুল কোড, আবার চেষ্টা করুন" }, { status: 401 });
  }

  await db.from("platform_admins").update({ is_2fa_enabled: true }).eq("id", session.adminId);
  await logAdminAction({ adminId: session.adminId, action: "enable_2fa" });

  return NextResponse.json({ ok: true });
}
