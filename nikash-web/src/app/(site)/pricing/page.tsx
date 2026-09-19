import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPublicSettings } from "@/lib/public-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "প্ল্যান ও দাম — নিকাশ",
  description: "নিকাশের সাবস্ক্রিপশন প্ল্যান ও দাম। ১৫ দিন ফ্রি ট্রায়াল, লুকানো খরচ নেই।",
};

const TYPE_BN: Record<string, string> = {
  vendor: "সরবরাহকারী",
  warehouse: "গুদাম",
  shop: "দোকান",
};

const INCLUDED = [
  "সীমাহীন পণ্য ও পার্টি",
  "বিক্রয়, ক্রয় ও রিটার্ন",
  "বাকির পূর্ণ হিসাব",
  "ব্যাচ ও মেয়াদ ট্র্যাকিং",
  "অফলাইন এন্ট্রি ও সিঙ্ক",
  "বাংলা ইনভয়েস PDF",
  "দৈনিক ও মাসিক রিপোর্ট",
  "ক্লাউড ব্যাকআপ",
];

function duration(days: number) {
  if (days % 365 === 0) return `${days / 365} বছর`;
  if (days % 30 === 0) return `${days / 30} মাস`;
  return `${days} দিন`;
}

export default async function PricingPage() {
  const db = supabaseAdmin();
  const [plansRes, settings] = await Promise.all([
    db.from("plans").select("*").eq("is_active", true).order("price"),
    getPublicSettings(),
  ]);

  const plans = plansRes.data ?? [];
  const { paymentNumbers, support } = settings;

  const methods = [
    { label: "বিকাশ", value: paymentNumbers.bkash, icon: "📲" },
    { label: "নগদ", value: paymentNumbers.nagad, icon: "📲" },
    { label: "রকেট", value: paymentNumbers.rocket, icon: "📲" },
    { label: "ব্যাংক", value: paymentNumbers.bank, icon: "🏦" },
  ].filter((m) => m.value);

  // মাঝেরটাকে "জনপ্রিয়" হিসেবে দেখাই
  const popularIndex = plans.length > 2 ? Math.floor(plans.length / 2) : plans.length - 1;

  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-emerald-50/60 to-white">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:py-20">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            সহজ দাম, লুকানো খরচ নেই
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            প্রথম ১৫ দিন সম্পূর্ণ ফ্রি — কার্ড লাগবে না। পছন্দ হলে তারপর প্ল্যান নিন।
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        {plans.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p, i) => {
              const popular = i === popularIndex;
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col rounded-3xl border p-7 transition ${
                    popular
                      ? "border-emerald-500 bg-white shadow-xl shadow-emerald-600/10"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  {popular && (
                    <span className="absolute -top-3 left-7 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                      জনপ্রিয়
                    </span>
                  )}

                  <p className="text-sm font-semibold text-slate-500">
                    {p.business_type ? TYPE_BN[p.business_type] ?? p.business_type : "সব ধরনের ব্যবসা"}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{p.name_bn}</h2>

                  <div className="mt-5 flex items-end gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-slate-900">
                      ৳{Number(p.price).toLocaleString("en-BD")}
                    </span>
                    <span className="pb-1.5 text-sm text-slate-500">/ {duration(p.duration_days)}</span>
                  </div>

                  <ul className="mt-6 space-y-2.5 text-sm">
                    <li className="flex gap-2 text-slate-700">
                      <span className="text-emerald-600">✓</span> {p.max_users} জন ব্যবহারকারী
                    </li>
                    <li className="flex gap-2 text-slate-700">
                      <span className="text-emerald-600">✓</span> {p.max_devices} টি ডিভাইস
                    </li>
                    {INCLUDED.slice(0, 5).map((f) => (
                      <li key={f} className="flex gap-2 text-slate-700">
                        <span className="text-emerald-600">✓</span> {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/signup"
                    className={`mt-7 rounded-xl px-5 py-3 text-center font-semibold transition ${
                      popular
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border border-slate-300 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    ফ্রি ট্রায়াল শুরু
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-lg font-semibold text-slate-900">প্ল্যান শীঘ্রই প্রকাশিত হবে</p>
            <p className="mt-2 text-slate-500">
              এর মধ্যে ফ্রি ট্রায়াল নিয়ে অ্যাপ চালিয়ে দেখুন।
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white"
            >
              ফ্রি ট্রায়াল শুরু
            </Link>
          </div>
        )}
      </section>

      {/* সব প্ল্যানে যা থাকে */}
      <section className="border-y border-slate-200 bg-slate-50 py-14">
        <div className="mx-auto max-w-4xl px-5">
          <h2 className="text-center text-2xl font-extrabold tracking-tight text-slate-900">
            সব প্ল্যানেই যা পাবেন
          </h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {INCLUDED.map((f) => (
              <div key={f} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <span className="text-emerald-600">✓</span>
                <span className="text-sm text-slate-700">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* কীভাবে টাকা দেবেন */}
      {methods.length > 0 && (
        <section className="mx-auto max-w-4xl px-5 py-14">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">টাকা যেভাবে দেবেন</h2>
          <p className="mt-2 text-slate-600">
            নিচের যেকোনো নম্বরে টাকা পাঠিয়ে অ্যাপে TrxID দিন — আমরা যাচাই করে সাথে সাথে মেয়াদ
            বাড়িয়ে দেব।
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {methods.map((m) => (
              <div key={m.label} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">
                  {m.icon} {m.label}
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-900">{m.value}</p>
              </div>
            ))}
          </div>

          {paymentNumbers.note && (
            <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              ℹ️ {paymentNumbers.note}
            </p>
          )}
        </section>
      )}

      <section className="border-t border-slate-200 bg-slate-900 py-14 text-center text-white">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-3xl font-extrabold tracking-tight">কোন প্ল্যান নেবেন বুঝতে পারছেন না?</h2>
          <p className="mt-3 text-slate-300">
            ফোন করুন — আপনার ব্যবসার আকার শুনে আমরাই বলে দেব।
            {support.hours ? ` (${support.hours})` : ""}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {support.phone && (
              <a
                href={`tel:${support.phone}`}
                className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-100"
              >
                ☎️ {support.phone}
              </a>
            )}
            <Link
              href="/contact"
              className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              যোগাযোগ করুন
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
