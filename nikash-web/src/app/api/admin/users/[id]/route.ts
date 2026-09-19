import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { logAdminAction } from "@/lib/audit";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") {
    return NextResponse.json({ error: "অনুমতি নেই" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const { name, role, is_active, password } = await req.json();
  const db = supabaseAdmin();

  const patch: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) patch.name = name.trim();
  if (role && ["super_admin", "support_admin"].includes(role)) patch.role = role;
  if (typeof is_active === "boolean") patch.is_active = is_active;
  if (password) {
    if (String(password).length < 8) {
      return NextResponse.json({ error: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে" }, { status: 400 });
    }
    patch.password_hash = await hashPassword(password);
  }

  // শেষ সক্রিয় super_admin-কে নিষ্ক্রিয় বা ডিমোট করা যাবে না
  if (patch.is_active === false || (patch.role && patch.role !== "super_admin")) {
    const { count } = await db
      .from("platform_admins")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin")
      .eq("is_active", true)
      .neq("id", id);
    if ((count ?? 0) === 0) {
      return NextResponse.json({ error: "শেষ সুপার অ্যাডমিনকে নিষ্ক্রিয়/পরিবর্তন করা যাবে না" }, { status: 400 });
    }
  }

  const { error } = await db.from("platform_admins").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAdminAction({
    adminId: session.adminId,
    action: "update_admin",
    targetType: "platform_admins",
    targetId: id,
    newValue: { ...patch, password_hash: undefined },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") {
    return NextResponse.json({ error: "অনুমতি নেই" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (id === session.adminId) {
    return NextResponse.json({ error: "নিজেকে মুছে ফেলা যাবে না" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { count } = await db
    .from("platform_admins")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin")
    .eq("is_active", true)
    .neq("id", id);
  if ((count ?? 0) === 0) {
    return NextResponse.json({ error: "শেষ সুপার অ্যাডমিনকে মুছে ফেলা যাবে না" }, { status: 400 });
  }

  // হার্ড ডিলিট নয় — অডিট রেফারেন্স রাখতে নিষ্ক্রিয় করা হয়
  const { error } = await db.from("platform_admins").update({ is_active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAdminAction({
    adminId: session.adminId,
    action: "deactivate_admin",
    targetType: "platform_admins",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
