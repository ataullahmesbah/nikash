import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/audit";

// platform_settings (key → jsonb)। শুধু জানা key গুলোই লেখা যাবে, যাতে
// কেউ ইচ্ছেমতো নতুন key ঢুকিয়ে অ্যাপে আজেবাজে ডেটা না পাঠাতে পারে।

type Shape = "object" | "number";

const ALLOWED: Record<string, { shape: Shape; fields?: string[]; min?: number; max?: number }> = {
  "public.support": { shape: "object", fields: ["phone", "whatsapp", "email", "hours", "address"] },
  "public.payment_numbers": { shape: "object", fields: ["bkash", "nagad", "rocket", "bank", "note"] },
  "public.app_links": { shape: "object", fields: ["apk_url", "play_store", "manual_url", "version"] },
  "billing.trial_days": { shape: "number", min: 0, max: 365 },
  "billing.grace_days": { shape: "number", min: 0, max: 90 },
};

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db.from("platform_settings").select("key, value, updated_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const map: Record<string, unknown> = {};
  for (const row of data ?? []) map[row.key] = row.value;
  return NextResponse.json({ settings: map });
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") {
    return NextResponse.json({ error: "শুধু সুপার অ্যাডমিন সেটিংস বদলাতে পারে" }, { status: 403 });
  }

  let body: { key?: string; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ভুল রিকোয়েস্ট" }, { status: 400 });
  }

  const key = String(body.key ?? "");
  const rule = ALLOWED[key];
  if (!rule) return NextResponse.json({ error: "অজানা সেটিংস key" }, { status: 400 });

  let value: unknown;
  if (rule.shape === "number") {
    const n = Number(body.value);
    if (!Number.isFinite(n) || n < (rule.min ?? 0) || n > (rule.max ?? 9999)) {
      return NextResponse.json(
        { error: `মান ${rule.min ?? 0}–${rule.max ?? 9999} এর মধ্যে হতে হবে` },
        { status: 400 }
      );
    }
    value = Math.trunc(n);
  } else {
    if (typeof body.value !== "object" || body.value === null || Array.isArray(body.value)) {
      return NextResponse.json({ error: "মান সঠিক নয়" }, { status: 400 });
    }
    const src = body.value as Record<string, unknown>;
    const clean: Record<string, string> = {};
    for (const f of rule.fields ?? []) {
      const v = src[f];
      if (v === undefined || v === null) continue;
      if (typeof v !== "string") {
        return NextResponse.json({ error: `"${f}" টেক্সট হতে হবে` }, { status: 400 });
      }
      if (v.length > 300) {
        return NextResponse.json({ error: `"${f}" খুব বড়` }, { status: 400 });
      }
      clean[f] = v.trim();
    }
    value = clean;
  }

  const db = supabaseAdmin();
  const { data: before } = await db.from("platform_settings").select("value").eq("key", key).maybeSingle();

  const { error } = await db
    .from("platform_settings")
    .upsert(
      { key, value, updated_by: session.adminId, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAdminAction({
    adminId: session.adminId,
    action: "update_setting",
    targetType: "platform_settings",
    targetId: key,
    oldValue: before?.value ?? null,
    newValue: value,
  });

  return NextResponse.json({ ok: true, key, value });
}
