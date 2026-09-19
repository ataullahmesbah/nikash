import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { reason } = await req.json();

  if (!reason) {
    return NextResponse.json({ error: "বাতিলের কারণ লিখুন" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { error } = await db
    .from("payment_requests")
    .update({
      status: "rejected",
      reject_reason: reason,
      approved_by: session.adminId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAdminAction({
    adminId: session.adminId,
    action: "reject_payment",
    targetType: "payment_request",
    targetId: id,
    newValue: { reason },
  });

  return NextResponse.json({ ok: true });
}
