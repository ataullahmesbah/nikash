import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { RATE, clientIp, rateLimited } from "@/lib/rate-limit";

// পাবলিক যোগাযোগ ফর্ম। কেউ লগইন করা নেই, তাই এখানে বাড়তি সতর্কতা:
// হানিপট, রেট লিমিট ও কড়া দৈর্ঘ্য যাচাই।

const MAX = { name: 80, email: 120, phone: 25, subject: 120, message: 2000 };

export async function POST(req: NextRequest) {
  if (rateLimited(`contact:${clientIp(req)}`, RATE.contact)) {
    return NextResponse.json(
      { error: "একটু পরে আবার চেষ্টা করুন — অল্প সময়ে অনেকবার পাঠানো হয়েছে।" },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "ভুল রিকোয়েস্ট" }, { status: 400 });
  }

  // হানিপট — মানুষ এই ঘরটি দেখতেই পায় না, বট ভরে ফেলে
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const email = str(body.email);
  const phone = str(body.phone);
  const subject = str(body.subject);
  const message = str(body.message);

  if (name.length < 2 || name.length > MAX.name) {
    return NextResponse.json({ error: "নাম ২–৮০ অক্ষরের হতে হবে" }, { status: 400 });
  }
  if (message.length < 5 || message.length > MAX.message) {
    return NextResponse.json({ error: "বার্তা ৫–২০০০ অক্ষরের হতে হবে" }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json({ error: "ইমেইল বা ফোন নম্বর — অন্তত একটি দিন" }, { status: 400 });
  }
  if (email && (email.length > MAX.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return NextResponse.json({ error: "ইমেইল ঠিকানা সঠিক নয়" }, { status: 400 });
  }
  if (phone && (phone.length > MAX.phone || !/^[\d+\-\s()]+$/.test(phone))) {
    return NextResponse.json({ error: "ফোন নম্বর সঠিক নয়" }, { status: 400 });
  }
  if (subject.length > MAX.subject) {
    return NextResponse.json({ error: "বিষয় খুব বড়" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: row, error } = await db
    .from("contact_submissions")
    .insert({
      name,
      email: email || null,
      phone: phone || null,
      subject: subject || null,
      message,
      status: "new",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "পাঠানো যায়নি, একটু পরে চেষ্টা করুন" }, { status: 500 });
  }

  // অ্যাডমিন প্যানেলের ঘণ্টায় দেখাবে
  await db.rpc("notify", {
    p_audience: "platform",
    p_type: "contact_submission",
    p_title: "নতুন যোগাযোগ বার্তা",
    p_body: `${name}${subject ? ` — ${subject}` : ""}`,
    p_link: "/admin/contacts",
    p_severity: "info",
    p_entity_type: "contact_submission",
    p_entity_id: row.id,
  });

  return NextResponse.json({ ok: true });
}
