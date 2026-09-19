import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { version, buildNumber, apkUrl, fileSizeMb, releaseNotes, forceUpdate, minSupported } = body;

  if (!version || !buildNumber || !apkUrl) {
    return NextResponse.json(
      { error: "Version, build number ও APK URL আবশ্যক" },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();
  const { error } = await db.from("app_versions").insert({
    version,
    build_number: Number(buildNumber),
    platform: "android",
    apk_url: apkUrl,
    file_size_mb: fileSizeMb ? Number(fileSizeMb) : null,
    release_notes: releaseNotes || null,
    force_update: Boolean(forceUpdate),
    min_supported: minSupported || null,
  });

  if (error) {
    // একই প্ল্যাটফর্মে একই বিল্ড নম্বর দুবার দেওয়া যায় না
    // (unique index: idx_app_versions_build)
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `বিল্ড নম্বর ${buildNumber} আগেই আছে — নিচের তালিকা থেকে সেটি সম্পাদনা করুন, অথবা অন্য নম্বর দিন` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAdminAction({
    adminId: session.adminId,
    action: "publish_app_version",
    targetType: "app_versions",
    newValue: { version, buildNumber },
  });

  return NextResponse.json({ ok: true });
}


// ---------------------------------------------------------------------
// ভার্সন সম্পাদনা
//
// ভুল লিংক বা ভুল সাইজ দিয়ে ফেললে মুছে নতুন করে বানানোর দরকার নেই।
// বিল্ড নম্বরও বদলানো যায়, তবে অন্য কোনো সারিতে সেটি থাকলে আটকাবে।
// ---------------------------------------------------------------------
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

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : null);
  const patch: Record<string, unknown> = {};

  const version = str(body.version);
  if (version !== null) {
    if (!/^\d+(\.\d+){0,3}$/.test(version)) {
      return NextResponse.json({ error: "ভার্সন এমন হতে হবে: 1.0.0" }, { status: 400 });
    }
    patch.version = version;
  }

  if (body.buildNumber !== undefined && body.buildNumber !== "") {
    const n = Number(body.buildNumber);
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: "বিল্ড নম্বর পূর্ণসংখ্যা হতে হবে" }, { status: 400 });
    }
    patch.build_number = n;
  }

  const apkUrl = str(body.apkUrl);
  if (apkUrl !== null) {
    if (!/^https?:\/\//.test(apkUrl)) {
      return NextResponse.json({ error: "লিংকটি http:// বা https:// দিয়ে শুরু হতে হবে" }, { status: 400 });
    }
    patch.apk_url = apkUrl;
  }

  if (body.fileSizeMb !== undefined) {
    const raw = str(body.fileSizeMb) ?? String(body.fileSizeMb ?? "");
    patch.file_size_mb = raw === "" ? null : Number(raw);
  }
  if (body.releaseNotes !== undefined) patch.release_notes = str(body.releaseNotes) || null;
  if (body.minSupported !== undefined) patch.min_supported = str(body.minSupported) || null;
  if (typeof body.forceUpdate === "boolean") patch.force_update = body.forceUpdate;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "বদলানোর মতো কিছু নেই" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("app_versions")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "এই বিল্ড নম্বর অন্য একটি ভার্সনে আছে" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: "ভার্সনটি পাওয়া যায়নি" }, { status: 404 });

  await logAdminAction({
    adminId: session.adminId,
    action: "update_app_version",
    targetType: "app_versions",
    targetId: id,
    newValue: patch,
  });

  return NextResponse.json({ ok: true });
}


// ---------------------------------------------------------------------
// ভার্সন মুছে ফেলা
//
// ⚠️ সত্যিই মুছে যায় (soft delete নয়) — এটা প্ল্যাটফর্মের তথ্য, কারো
// ব্যবসার হিসাব নয়। ভুল করে যোগ করা সারি সরানোর জন্য।
//
// মুছে ফেললে অ্যাপ আর ওই ভার্সনের খবর পাবে না; সবচেয়ে বড় বিল্ড
// নম্বরের সারিটাই "সর্বশেষ" হিসেবে ধরা হবে।
// ---------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id দিন" }, { status: 400 });

  const db = supabaseAdmin();

  // কোনটা মুছছি সেটা অডিট লগে রাখি
  const { data: before } = await db
    .from("app_versions")
    .select("version, build_number, apk_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await db.from("app_versions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAdminAction({
    adminId: session.adminId,
    action: "delete_app_version",
    targetType: "app_versions",
    targetId: id,
    oldValue: before ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
