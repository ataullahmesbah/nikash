import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { logAdminAction } from "@/lib/audit";

// নতুন প্ল্যাটফর্ম অ্যাডমিন — শুধু super_admin বানাতে পারবে।
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") {
    return NextResponse.json({ error: "শুধু সুপার অ্যাডমিন নতুন অ্যাডমিন বানাতে পারেন" }, { status: 403 });
  }

  const { name, email, password, role } = await req.json();
  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "নাম, ইমেইল ও পাসওয়ার্ড দিন" }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে" }, { status: 400 });
  }
  if (!["super_admin", "support_admin"].includes(role)) {
    return NextResponse.json({ error: "সঠিক রোল বাছুন" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const password_hash = await hashPassword(password);

  const { data, error } = await db
    .from("platform_admins")
    .insert({ name: name.trim(), email: email.toLowerCase().trim(), password_hash, role })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "এই ইমেইল আগেই ব্যবহৃত হয়েছে" : error.message },
      { status: 400 }
    );
  }

  await logAdminAction({
    adminId: session.adminId,
    action: "create_admin",
    targetType: "platform_admins",
    targetId: data.id,
    newValue: { name, email, role },
  });

  return NextResponse.json({ ok: true });
}
