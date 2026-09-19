import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    titleBn, titleEn, bodyBn, bodyEn, type, severity, showAs,
    targetMode, businessType, companyIds, statuses, endAt,
  } = body;

  if (!titleBn?.trim()) {
    return NextResponse.json({ error: "শিরোনাম আবশ্যক" }, { status: 400 });
  }

  // টার্গেটিং: all | type | companies | status
  const row: Record<string, unknown> = {
    type: type || "info",
    severity: severity || "info",
    title_bn: titleBn.trim(),
    title_en: (titleEn || titleBn).trim(),
    body_bn: bodyBn || null,
    body_en: bodyEn || null,
    show_as: showAs || "banner",
    end_at: endAt || null,
    created_by: session.adminId,
    company_id: null,
    business_type: null,
    target_company_ids: null,
    target_statuses: null,
  };

  if (targetMode === "type" && businessType) {
    row.business_type = businessType;
  } else if (targetMode === "companies") {
    const ids = Array.isArray(companyIds) ? companyIds.filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "অন্তত একটি কোম্পানি বাছুন" }, { status: 400 });
    }
    row.target_company_ids = ids;
  } else if (targetMode === "status") {
    const st = Array.isArray(statuses) ? statuses.filter(Boolean) : [];
    if (st.length === 0) {
      return NextResponse.json({ error: "অন্তত একটি স্ট্যাটাস বাছুন" }, { status: 400 });
    }
    row.target_statuses = st;
  }

  const db = supabaseAdmin();
  // ইনসার্টের পর ট্রিগার (trg_notice_notify) টার্গেট কোম্পানিগুলোর
  // notifications সারি বানিয়ে দেয় — অ্যাপে ঘণ্টা বাজে সাথে সাথেই।
  const { data, error } = await db.from("notices").insert(row).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAdminAction({
    adminId: session.adminId,
    action: "create_notice",
    targetType: "notices",
    targetId: data.id,
    newValue: { titleBn, severity, targetMode },
  });

  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id দিন" }, { status: 400 });

  const db = supabaseAdmin();
  // soft delete — নোটিশটা ইতিহাসে থেকে যায়, কিন্তু অ্যাপে আর দেখায় না
  // (RLS নীতিতে `deleted_at is null` শর্ত আছে, দেখুন 11 নম্বর মাইগ্রেশন)
  const { error } = await db
    .from("notices")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAdminAction({
    adminId: session.adminId,
    action: "delete_notice",
    targetType: "notices",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}


// নোটিশ সম্পাদনা ও চালু/বন্ধ।
//
// ভুল নোটিশ পাঠিয়ে ফেললে এখান দিয়েই ঠিক করা যায়:
//   • { id, isActive } → এক ক্লিকে বন্ধ/চালু
//   • { id, titleBn, ... } → লেখা ও সেটিংস বদলানো
//
// কাদের কাছে গেছে (টার্গেটিং) সেটা বদলানো যায় না — নোটিফিকেশন তো
// আগেই পাঠানো হয়ে গেছে, টার্গেট বদলালে হিসাব মিলবে না। ভুল কোম্পানিতে
// গিয়ে থাকলে এটা মুছে নতুন করে পাঠানোই ঠিক।
const SEVERITIES = ["info", "warning", "critical"] as const;
const SHOW_AS = ["banner", "popup"] as const;
const MAX = { title: 150, body: 2000 };

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ভুল রিকোয়েস্ট" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id দিন" }, { status: 400 });

  const patch: Record<string, unknown> = {};

  // শুধু চালু/বন্ধ
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : null);

  const titleBn = str(body.titleBn);
  if (titleBn !== null) {
    if (titleBn.length < 2 || titleBn.length > MAX.title) {
      return NextResponse.json({ error: `শিরোনাম ২–${MAX.title} অক্ষরের হতে হবে` }, { status: 400 });
    }
    patch.title_bn = titleBn;
    patch.title_en = str(body.titleEn) || titleBn;
  }

  const bodyBn = str(body.bodyBn);
  if (bodyBn !== null) {
    if (bodyBn.length > MAX.body) {
      return NextResponse.json({ error: "বার্তা খুব বড়" }, { status: 400 });
    }
    patch.body_bn = bodyBn || null;
    patch.body_en = str(body.bodyEn) || bodyBn || null;
  }

  const severity = str(body.severity);
  if (severity) {
    if (!(SEVERITIES as readonly string[]).includes(severity)) {
      return NextResponse.json({ error: "গুরুত্ব সঠিক নয়" }, { status: 400 });
    }
    patch.severity = severity;
  }

  const showAs = str(body.showAs);
  if (showAs) {
    if (!(SHOW_AS as readonly string[]).includes(showAs)) {
      return NextResponse.json({ error: "দেখানোর ধরন সঠিক নয়" }, { status: 400 });
    }
    patch.show_as = showAs;
  }

  if ("endAt" in body) {
    const endAt = str(body.endAt);
    if (endAt && Number.isNaN(Date.parse(endAt))) {
      return NextResponse.json({ error: "শেষ তারিখ সঠিক নয়" }, { status: 400 });
    }
    patch.end_at = endAt || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "বদলানোর মতো কিছু নেই" }, { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const db = supabaseAdmin();
  // মুছে ফেলা নোটিশ আর সম্পাদনা করা যাবে না
  const { data, error } = await db
    .from("notices")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "নোটিশটি পাওয়া যায়নি" }, { status: 404 });

  await logAdminAction({
    adminId: session.adminId,
    action: typeof body.isActive === "boolean" && Object.keys(patch).length === 2
      ? (body.isActive ? "enable_notice" : "disable_notice")
      : "update_notice",
    targetType: "notices",
    targetId: id,
    newValue: patch,
  });

  return NextResponse.json({ ok: true });
}
