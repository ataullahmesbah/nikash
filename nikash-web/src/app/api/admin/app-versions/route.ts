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
