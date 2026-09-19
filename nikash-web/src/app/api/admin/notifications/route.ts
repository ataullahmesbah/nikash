import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";

// প্ল্যাটফর্ম নোটিফিকেশন — audience='platform' সারিগুলোর RLS-এ কোনো
// authenticated policy নেই, তাই শুধু এই সার্ভার রুট (service_role) পড়তে পারে।
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 30), 100);
  const db = supabaseAdmin();

  const [listRes, countRes] = await Promise.all([
    db
      .from("notifications")
      .select("id, type, severity, title, body, link, read_at, created_at")
      .eq("audience", "platform")
      .order("created_at", { ascending: false })
      .limit(limit),
    db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("audience", "platform")
      .is("read_at", null),
  ]);

  return NextResponse.json({
    items: listRes.data ?? [],
    unread: countRes.count ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, all } = await req.json();
  const db = supabaseAdmin();
  const now = new Date().toISOString();

  if (all) {
    await db.from("notifications").update({ read_at: now }).eq("audience", "platform").is("read_at", null);
  } else if (id) {
    await db.from("notifications").update({ read_at: now }).eq("id", id).eq("audience", "platform");
  } else {
    return NextResponse.json({ error: "id অথবা all দিন" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
