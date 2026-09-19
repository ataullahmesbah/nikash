import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/audit";

// হাতে হাতে (বিকাশ/নগদ/ব্যাংক/ক্যাশ) পেমেন্ট নিলে অ্যাডমিন এখান দিয়ে
// রেকর্ড তোলে — ইনভয়েস, পেমেন্ট এন্ট্রি ও মেয়াদ একসাথে আপডেট হয়।

// payment_method enum (01_schema.sql) — এর বাইরে কিছু পাঠালে DB error দিবে,
// তাই এখানেই আটকে দিই।
const METHODS = ["cash", "bkash", "nagad", "rocket", "bank", "cheque", "card"] as const;

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ভুল রিকোয়েস্ট" }, { status: 400 });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  const amount = Number(body.amount);
  const method = String(body.method ?? "");
  const trxId = typeof body.trxId === "string" ? body.trxId.trim() : "";
  const planId = typeof body.planId === "string" && body.planId ? body.planId : null;
  const extendDays = Number.isFinite(Number(body.extendDays)) ? Math.trunc(Number(body.extendDays)) : 0;
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const makeInvoice = body.makeInvoice !== false;

  if (!companyId) {
    return NextResponse.json({ error: "কোম্পানি নির্বাচন করুন" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "টাকার পরিমাণ সঠিক নয়" }, { status: 400 });
  }
  if (!(METHODS as readonly string[]).includes(method)) {
    return NextResponse.json({ error: "পেমেন্ট মাধ্যম সঠিক নয়" }, { status: 400 });
  }
  if (extendDays < 0 || extendDays > 3650) {
    return NextResponse.json({ error: "দিনের সংখ্যা ০–৩৬৫০ এর মধ্যে হতে হবে" }, { status: 400 });
  }

  const db = supabaseAdmin();

  // একই TrxID দুইবার তুললে ডাবল এন্ট্রি হয়ে যাবে — আগেই আটকাই।
  if (trxId) {
    const { data: dup } = await db
      .from("platform_payments")
      .select("id")
      .eq("company_id", companyId)
      .eq("trx_id", trxId)
      .maybeSingle();
    if (dup) {
      return NextResponse.json(
        { error: "এই TrxID দিয়ে আগেই পেমেন্ট তোলা হয়েছে" },
        { status: 409 }
      );
    }
  }

  const { data, error } = await db.rpc("record_manual_payment", {
    p_company: companyId,
    p_amount: amount,
    p_method: method,
    p_trx: trxId || null,
    p_plan: planId,
    p_extend_days: extendDays,
    p_note: note || null,
    p_admin: session.adminId,
    p_make_invoice: makeInvoice,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAdminAction({
    adminId: session.adminId,
    action: "record_manual_payment",
    targetType: "company",
    targetId: companyId,
    newValue: { amount, method, trxId, extendDays, note, result: data },
  });

  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
