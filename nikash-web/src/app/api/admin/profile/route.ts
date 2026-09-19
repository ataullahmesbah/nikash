import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { logAdminAction } from "@/lib/audit";

// নিজের নাম বা পাসওয়ার্ড বদলানো। পাসওয়ার্ড বদলাতে পুরনোটা লাগবেই —
// সেশন কুকি চুরি হলেও যেন পাসওয়ার্ড বদলে দখল নেওয়া না যায়।

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ভুল রিকোয়েস্ট" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "নাম ২–৮০ অক্ষরের হতে হবে" }, { status: 400 });
    }
    updates.name = name;
  }

  if (body.newPassword) {
    if (!body.currentPassword) {
      return NextResponse.json({ error: "বর্তমান পাসওয়ার্ড লাগবে" }, { status: 400 });
    }
    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: "নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে" }, { status: 400 });
    }

    const { data: admin } = await db
      .from("platform_admins")
      .select("password_hash")
      .eq("id", session.adminId)
      .maybeSingle();

    if (!admin?.password_hash || !(await verifyPassword(body.currentPassword, admin.password_hash))) {
      return NextResponse.json({ error: "বর্তমান পাসওয়ার্ড ভুল" }, { status: 400 });
    }
    updates.password_hash = await hashPassword(body.newPassword);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "বদলানোর মতো কিছু নেই" }, { status: 400 });
  }

  const { error } = await db.from("platform_admins").update(updates).eq("id", session.adminId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAdminAction({
    adminId: session.adminId,
    action: updates.password_hash ? "change_own_password" : "update_own_profile",
    targetType: "platform_admin",
    targetId: session.adminId,
  });

  return NextResponse.json({ ok: true });
}
