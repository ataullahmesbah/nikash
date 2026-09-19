import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { phoneToEmail, isValidBangladeshiPhone } from "@/lib/phone";
import { RATE, clientIp, rateLimited } from "@/lib/rate-limit";

// PUBLIC route — this is how a brand-new company actually gets created.
// provision_company() itself is service_role-only (see
// 05_security_and_feature_fixes.sql section 1), so this server route is
// the one legitimate caller: it creates the auth user with the admin API,
// then calls provision_company with that user's id. No admin session is
// required here on purpose — anyone starting a 15-day trial is the point.
const BUSINESS_TYPES = ["vendor", "warehouse", "shop"] as const;

// প্রতিটি সাইনআপ একটি ১৫ দিনের ট্রায়াল কোম্পানি তৈরি করে — খোলা রাস্তা
// রাখলে বট দিয়ে হাজারটা ভুয়া কোম্পানি বানিয়ে ফেলা যায়।
export async function POST(req: NextRequest) {
  if (rateLimited(`signup:${clientIp(req)}`, RATE.signup)) {
    return NextResponse.json(
      { error: "একটু পরে আবার চেষ্টা করুন — অল্প সময়ে অনেকবার চেষ্টা হয়েছে।" },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ভুল রিকোয়েস্ট" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const businessName = str(body.businessName);
  const businessType = str(body.businessType);
  const ownerName = str(body.ownerName);
  const phone = str(body.phone);
  const password = typeof body.password === "string" ? body.password : "";

  if (!businessName || !ownerName || !phone || !password) {
    return NextResponse.json({ error: "সব ঘর পূরণ করুন" }, { status: 400 });
  }
  // নাম দুটো ডেটাবেজে যায় ও অ্যাডমিন প্যানেলে দেখানো হয় — দৈর্ঘ্য বেঁধে দিই
  if (businessName.length < 2 || businessName.length > 100) {
    return NextResponse.json({ error: "ব্যবসার নাম ২–১০০ অক্ষরের হতে হবে" }, { status: 400 });
  }
  if (ownerName.length < 2 || ownerName.length > 80) {
    return NextResponse.json({ error: "মালিকের নাম ২–৮০ অক্ষরের হতে হবে" }, { status: 400 });
  }
  if (password.length > 128) {
    return NextResponse.json({ error: "পাসওয়ার্ড খুব বড়" }, { status: 400 });
  }
  if (!(BUSINESS_TYPES as readonly string[]).includes(businessType)) {
    return NextResponse.json({ error: "ব্যবসার ধরন সঠিক নয়" }, { status: 400 });
  }
  if (!isValidBangladeshiPhone(phone)) {
    return NextResponse.json({ error: "ফোন নম্বর সঠিক নয় (01XXXXXXXXX)" }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const email = phoneToEmail(phone);

  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phone },
  });

  if (authErr || !authUser?.user) {
    const message = authErr?.message?.includes("already been registered")
      ? "এই ফোন নম্বর দিয়ে আগেই অ্যাকাউন্ট আছে — লগইন করুন"
      : authErr?.message ?? "অ্যাকাউন্ট তৈরি ব্যর্থ হয়েছে";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data: companyId, error: provisionErr } = await db.rpc("provision_company", {
    p_name: businessName,
    p_business_type: businessType,
    p_owner_name: ownerName,
    p_phone: phone,
    p_owner_auth_id: authUser.user.id,
  });

  if (provisionErr) {
    // Roll back the auth user so a failed signup doesn't leave an orphan
    // account that can never be provisioned (the phone would look "taken").
    await db.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: provisionErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, companyId });
}
