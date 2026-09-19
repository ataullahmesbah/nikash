import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/audit";

// সাবস্ক্রিপশন প্ল্যান — দাম, মেয়াদ, ইউজার/ডিভাইস লিমিট।

const BUSINESS_TYPES = ["vendor", "warehouse", "shop"] as const;

type PlanInput = {
  code: string;
  name_bn: string;
  name_en: string;
  business_type: string | null;
  duration_days: number;
  price: number;
  max_users: number;
  max_devices: number;
  is_active: boolean;
};

function parsePlan(body: Record<string, unknown>): { data?: PlanInput; error?: string } {
  const code = String(body.code ?? "").trim();
  const nameBn = String(body.name_bn ?? "").trim();
  const nameEn = String(body.name_en ?? "").trim();
  const durationDays = Math.trunc(Number(body.duration_days));
  const price = Number(body.price);
  const maxUsers = Math.trunc(Number(body.max_users ?? 5));
  const maxDevices = Math.trunc(Number(body.max_devices ?? 3));
  const businessType = body.business_type ? String(body.business_type) : null;

  if (!/^[a-z0-9_]{2,40}$/.test(code)) {
    return { error: "কোড ছোট হাতের অক্ষর, সংখ্যা ও আন্ডারস্কোর দিয়ে ২–৪০ অক্ষরের হতে হবে" };
  }
  if (!nameBn || !nameEn) return { error: "বাংলা ও ইংরেজি নাম দুটোই লাগবে" };
  if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 3650) {
    return { error: "মেয়াদ ১–৩৬৫০ দিনের মধ্যে হতে হবে" };
  }
  if (!Number.isFinite(price) || price < 0) return { error: "দাম সঠিক নয়" };
  if (maxUsers < 1 || maxUsers > 1000) return { error: "ইউজার লিমিট ১–১০০০" };
  if (maxDevices < 1 || maxDevices > 1000) return { error: "ডিভাইস লিমিট ১–১০০০" };
  if (businessType && !(BUSINESS_TYPES as readonly string[]).includes(businessType)) {
    return { error: "ব্যবসার ধরন সঠিক নয়" };
  }

  return {
    data: {
      code,
      name_bn: nameBn,
      name_en: nameEn,
      business_type: businessType,
      duration_days: durationDays,
      price,
      max_users: maxUsers,
      max_devices: maxDevices,
      is_active: body.is_active !== false,
    },
  };
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db.from("plans").select("*").order("price");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") {
    return NextResponse.json({ error: "শুধু সুপার অ্যাডমিন প্ল্যান বদলাতে পারে" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ভুল রিকোয়েস্ট" }, { status: 400 });
  }

  const { data: plan, error: parseErr } = parsePlan(body);
  if (parseErr || !plan) return NextResponse.json({ error: parseErr }, { status: 400 });

  const db = supabaseAdmin();
  const id = typeof body.id === "string" && body.id ? body.id : null;

  if (id) {
    const { data: before } = await db.from("plans").select("*").eq("id", id).maybeSingle();
    if (!before) return NextResponse.json({ error: "প্ল্যান পাওয়া যায়নি" }, { status: 404 });

    const { error } = await db
      .from("plans")
      .update({ ...plan, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logAdminAction({
      adminId: session.adminId,
      action: "update_plan",
      targetType: "plan",
      targetId: id,
      oldValue: before,
      newValue: plan,
    });
    return NextResponse.json({ ok: true, id });
  }

  const { data: created, error } = await db.from("plans").insert(plan).select("id").single();
  if (error) {
    const msg = error.code === "23505" ? "এই কোডে আগেই একটা প্ল্যান আছে" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await logAdminAction({
    adminId: session.adminId,
    action: "create_plan",
    targetType: "plan",
    targetId: created.id,
    newValue: plan,
  });
  return NextResponse.json({ ok: true, id: created.id });
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") {
    return NextResponse.json({ error: "শুধু সুপার অ্যাডমিন প্ল্যান বদলাতে পারে" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id লাগবে" }, { status: 400 });

  const db = supabaseAdmin();

  // কোনো কোম্পানি বা ইনভয়েস এই প্ল্যান ধরে থাকলে ডিলিট নয় — নিষ্ক্রিয় করি,
  // নাহলে পুরনো রেকর্ডের হিসাব ভেঙে যাবে।
  const { count } = await db
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", id);

  if ((count ?? 0) > 0) {
    const { error } = await db.from("plans").update({ is_active: false }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await logAdminAction({
      adminId: session.adminId,
      action: "deactivate_plan",
      targetType: "plan",
      targetId: id,
    });
    return NextResponse.json({ ok: true, result: "deactivated", companies: count });
  }

  const { error } = await db.from("plans").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAdminAction({
    adminId: session.adminId,
    action: "delete_plan",
    targetType: "plan",
    targetId: id,
  });
  return NextResponse.json({ ok: true, result: "deleted" });
}
