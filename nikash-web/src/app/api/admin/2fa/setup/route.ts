import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { generateTotpSecret, totpQrDataUrl } from "@/lib/auth/totp";

// Generates a fresh secret and stores it, but does NOT enable 2FA yet —
// is_2fa_enabled only flips to true once /api/admin/2fa/confirm verifies
// the admin actually scanned it and can produce a valid code.
export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: admin } = await db
    .from("platform_admins")
    .select("email")
    .eq("id", session.adminId)
    .maybeSingle();

  if (!admin) return NextResponse.json({ error: "অ্যাকাউন্ট পাওয়া যায়নি" }, { status: 404 });

  const secret = generateTotpSecret();
  await db.from("platform_admins").update({ totp_secret: secret }).eq("id", session.adminId);

  const qrDataUrl = await totpQrDataUrl(admin.email, secret);

  return NextResponse.json({ secret, qrDataUrl });
}
