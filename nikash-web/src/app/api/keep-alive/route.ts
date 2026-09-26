import { createClient } from "@supabase/supabase-js";

// ফ্রি Supabase প্রজেক্ট ৭ দিন নিষ্ক্রিয় থাকলে নিজে থেকেই থেমে যায়, আর
// তখন ড্যাশবোর্ডে ঢুকে হাতে চালু করতে হয়। Vercel Cron দিনে একবার এই
// রাস্তাটা ডাকে — একটা ছোট query চলে, প্রজেক্ট সক্রিয় থাকে।
//
// app_versions বেছে নেওয়া হয়েছে কারণ এই একটাই টেবিল anon রোল পড়তে
// পারে (13_app_version_check.sql-এর policy)। তাই query সত্যিই সফল হয় —
// RLS-এ আটকে চুপচাপ খালি ফিরে আসে না, ভেঙে গেলে আমরা টের পাই।

// Vercel যেন বিল্ডের সময় এটা স্ট্যাটিক বানিয়ে না ফেলে
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // CRON_SECRET সেট করা থাকলে Vercel নিজেই এই হেডার পাঠায়। বাইরের কেউ
  // যেন রাস্তাটা ডাকতে না পারে, তাই মিলিয়ে দেখি।
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return Response.json(
      { ok: false, error: "Supabase env missing" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // head: true — সারি আনে না, শুধু গুনে দেখে। সবচেয়ে হালকা query.
  const { count, error } = await supabase
    .from("app_versions")
    .select("*", { head: true, count: "exact" });

  return Response.json(
    { ok: !error, count: count ?? null, error: error?.message, at: new Date().toISOString() },
    { status: error ? 500 : 200, headers: { "Cache-Control": "no-store" } }
  );
}
