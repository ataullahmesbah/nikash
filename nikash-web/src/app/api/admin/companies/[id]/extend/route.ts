import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/audit";

// মেয়াদ বাড়ানো **ও কমানো** দুটোই — v1-এ শুধু বাড়ানো যেত, ভুল করে
// বেশি দিলে ঠিক করার উপায় ছিল না।
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { mode, days, newDate, reason } = await req.json();

  if (!reason?.trim()) {
    return NextResponse.json({ error: "কারণ লিখুন" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: company } = await db
    .from("companies")
    .select("id, name, end_date")
    .eq("id", id)
    .maybeSingle();

  if (!company) return NextResponse.json({ error: "কোম্পানি পাওয়া যায়নি" }, { status: 404 });

  // বর্তমান মেয়াদ অতীত হলে আজ থেকেই গোনা শুরু
  const base = company.end_date && new Date(company.end_date) > new Date()
    ? new Date(company.end_date)
    : new Date();

  let target: Date;
  if (mode === "date") {
    if (!newDate) return NextResponse.json({ error: "তারিখ দিন" }, { status: 400 });
    target = new Date(newDate);
  } else {
    const n = Number(days);
    if (!Number.isFinite(n) || n === 0) {
      return NextResponse.json({ error: "সঠিক দিনসংখ্যা দিন" }, { status: 400 });
    }
    target = new Date(base);
    target.setDate(target.getDate() + (mode === "reduce" ? -Math.abs(n) : Math.abs(n)));
  }

  const iso = target.toISOString().slice(0, 10);

  const { error } = await db.rpc("set_subscription_end", {
    p_company: id,
    p_new_end: iso,
    p_reason: reason.trim(),
    p_admin: session.adminId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAdminAction({
    adminId: session.adminId,
    action: mode === "reduce" ? "reduce_subscription" : "extend_subscription",
    targetType: "companies",
    targetId: id,
    oldValue: { end_date: company.end_date },
    newValue: { end_date: iso, reason },
  });

  return NextResponse.json({ ok: true, end_date: iso });
}
