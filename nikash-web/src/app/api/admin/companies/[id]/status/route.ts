import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/audit";

const ALLOWED = ["active", "readonly", "blocked"] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") {
    return NextResponse.json({ error: "শুধু Super Admin এটা করতে পারবে" }, { status: 403 });
  }

  const { id } = await params;
  const { status, reason, makeFree } = await req.json();

  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "অগ্রহণযোগ্য স্ট্যাটাস" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: before } = await db
    .from("companies")
    .select("status, is_free")
    .eq("id", id)
    .single();

  const patch: Record<string, unknown> = { status };
  if (status === "blocked") patch.blocked_reason = reason ?? null;
  if (typeof makeFree === "boolean") patch.is_free = makeFree;

  const { error } = await db.from("companies").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAdminAction({
    adminId: session.adminId,
    action: "set_company_status",
    targetType: "company",
    targetId: id,
    oldValue: before,
    newValue: patch,
  });

  return NextResponse.json({ ok: true });
}
