import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/audit";

const STATUSES = ["new", "read", "replied", "closed"] as const;

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ভুল রিকোয়েস্ট" }, { status: 400 });
  }

  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  if (!id) return NextResponse.json({ error: "id লাগবে" }, { status: 400 });
  if (!(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "স্ট্যাটাস সঠিক নয়" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db.from("contact_submissions").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAdminAction({
    adminId: session.adminId,
    action: "update_contact_status",
    targetType: "contact_submission",
    targetId: id,
    newValue: { status },
  });

  return NextResponse.json({ ok: true });
}
