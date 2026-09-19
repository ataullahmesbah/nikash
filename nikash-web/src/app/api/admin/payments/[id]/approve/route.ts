import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = supabaseAdmin();

  const { data: request, error: reqErr } = await db
    .from("payment_requests")
    .select("*, plans(duration_days, price)")
    .eq("id", id)
    .maybeSingle();

  if (reqErr || !request) {
    return NextResponse.json({ error: "Payment request পাওয়া যায়নি" }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "এটা আগেই প্রসেস হয়ে গেছে" }, { status: 400 });
  }

  const durationDays = request.plans?.duration_days ?? 30;

  const { data: newEndDate, error: extendErr } = await db.rpc("extend_subscription", {
    p_company: request.company_id,
    p_days: durationDays,
    p_amount: request.amount,
    p_trx: request.trx_id,
    p_method: request.method,
    p_admin: session.adminId,
  });

  if (extendErr) {
    return NextResponse.json({ error: extendErr.message }, { status: 400 });
  }

  await db.from("platform_payments").insert({
    company_id: request.company_id,
    request_id: request.id,
    amount: request.amount,
    method: request.method,
    trx_id: request.trx_id,
    status: "approved",
    verified_by: session.adminId,
    verified_at: new Date().toISOString(),
  });

  await db
    .from("payment_requests")
    .update({ status: "approved", approved_by: session.adminId, approved_at: new Date().toISOString() })
    .eq("id", id);

  await logAdminAction({
    adminId: session.adminId,
    action: "approve_payment",
    targetType: "payment_request",
    targetId: id,
    newValue: { newEndDate },
  });

  return NextResponse.json({ ok: true, newEndDate });
}
