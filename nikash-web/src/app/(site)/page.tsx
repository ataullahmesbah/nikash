import Link from "next/link";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "নিকাশ — স্টক, বাকি ও লাভের হিসাব এক অ্যাপে",
  description:
    "সরবরাহকারী, গুদাম ও দোকানের জন্য বাংলায় তৈরি ব্যবসা ব্যবস্থাপনা অ্যাপ। ইন্টারনেট ছাড়াও চলে, একবার এন্ট্রি দিলেই স্টক-বাকি-লাভ নিজে থেকেই হালনাগাদ হয়।",
};

const TIERS = [
  {
    icon: "🏭",
    name: "সরবরাহকারী / মিল",
    points: ["বড় লটে বিক্রি ও ডেলিভারি", "গুদামভিত্তিক স্টক", "ডিলার বাকির হিসাব"],
    tone: "from-violet-500 to-indigo-600",
  },
  {
    icon: "🏬",
    name: "গুদাম / পরিবেশক",
    points: ["গাড়ি ও রুট ব্যবস্থাপনা", "ব্যাচ ও মেয়াদ ট্র্যাকিং", "দোকানভিত্তিক বাকি"],
    tone: "from-emerald-500 to-teal-600",
  },
  {
    icon: "🏪",
    name: "দোকান / খুচরা",
    points: ["দ্রুত বিক্রির স্ক্রিন", "ক্রেতার বাকি খাতা", "দৈনিক লাভ-ক্ষতি"],
    tone: "from-amber-500 to-orange-600",
  },
];

const FEATURES = [
  {
    icon: "📦",
    title: "বহুস্তর ইউনিট",
    body: "পিস, প্যাক, কার্টন, বস্তা — প্রতিটির আলাদা দাম ও রূপান্তর। একবার সেট করলেই সব হিসাব মিলে যাবে।",
  },
  {
    icon: "🧾",
    title: "বাকির হিসাব",
    body: "কার কাছে কত বাকি, কতদিনের পুরনো — এক নজরে। আংশিক টাকা নিলে বাকিটা নিজে থেকেই আপডেট হয়।",
  },
  {
    icon: "📅",
    title: "তারিখভিত্তিক সব রিপোর্ট",
    body: "আজ, গতকাল, এই সপ্তাহ, এই মাস — যেকোনো তারিখের বিক্রি, ক্রয় ও লাভ দেখুন ক্যালেন্ডার থেকে।",
  },
  {
    icon: "📶",
    title: "ইন্টারনেট ছাড়াও চলে",
    body: "নেট না থাকলেও এন্ট্রি দিন — নেট এলে নিজে থেকেই সিঙ্ক হয়ে যাবে। গ্রামে-গঞ্জেও কাজ থামবে না।",
  },
  {
    icon: "⏳",
    title: "ব্যাচ ও মেয়াদ",
    body: "কোন লটের মাল কবে মেয়াদ শেষ হবে — আগেই সতর্কতা। FEFO অনুযায়ী পুরনো মাল আগে বিক্রি হয়।",
  },
  {
    icon: "✏️",
    title: "ভুল হলে সংশোধন",
    body: "বিক্রি বা ক্রয়ে ভুল হলে এডিট করুন — স্টক ও বাকি নিজে থেকেই ঠিক হয়ে যাবে, সব পরিবর্তন লগে থাকে।",
  },
  {
    icon: "📊",
    title: "লাভ-ক্ষতির গ্রাফ",
    body: "প্রতিদিনের বিক্রি, খরচ ও লাভ স্বয়ংক্রিয়ভাবে হিসাব হয়ে গ্রাফে দেখা যায়। মাসিক বিশ্লেষণও আছে।",
  },
  {
    icon: "📄",
    title: "বাংলা ইনভয়েস PDF",
    body: "যেকোনো বিক্রির ইনভয়েস বাংলায় PDF বানিয়ে হোয়াটসঅ্যাপে পাঠান বা প্রিন্ট করুন।",
  },
  {
    icon: "🔒",
    title: "নিরাপদ ও আলাদা",
    body: "প্রতিটি ব্যবসার ডেটা সম্পূর্ণ আলাদা। রোল অনুযায়ী কে কী দেখবে সেটাও আপনি ঠিক করবেন।",
  },
];

const STEPS = [
  { n: "১", title: "সাইন আপ করুন", body: "ব্যবসার ধরন বেছে নিন — দোকান, গুদাম বা সরবরাহকারী। ১৫ দিন ফ্রি।" },
  { n: "২", title: "পণ্য ও পার্টি যোগ করুন", body: "রেডিমেড পণ্য তালিকা থেকে বেছে নিন, নয়তো নিজের মতো সাজান।" },
  { n: "৩", title: "রোজ এন্ট্রি দিন", body: "বিক্রি-ক্রয় লিখুন, বাকি রেকর্ড করুন — বাকিটা অ্যাপ নিজেই সামলাবে।" },
];

const FAQ = [
  {
    q: "ইন্টারনেট না থাকলে কি অ্যাপ চলবে?",
    a: "হ্যাঁ। সব এন্ট্রি প্রথমে ফোনেই জমা হয়, নেট এলে নিজে থেকেই সার্ভারে চলে যায়। কাজ কখনো থামে না।",
  },
  {
    q: "আমার ডেটা কি নিরাপদ?",
    a: "প্রতিটি ব্যবসার ডেটা ডাটাবেস স্তরেই আলাদা করা (Row Level Security)। অন্য কোনো ব্যবসা আপনার হিসাব দেখতে পারে না।",
  },
  {
    q: "একাধিক কর্মচারী ব্যবহার করতে পারবে?",
    a: "পারবে। মালিক, ম্যানেজার ও বিক্রয়কর্মী — আলাদা রোল আছে। কে কী দেখবে ও করতে পারবে, তা আপনি ঠিক করবেন।",
  },
  {
    q: "ভুল এন্ট্রি হলে কী করব?",
    a: "ড্রাফট সরাসরি এডিট করা যায়। পোস্ট করা বিল এডিট করতে কারণ লিখে আনপোস্ট করুন — স্টক ও বাকি নিজে থেকেই ফিরে আসবে।",
  },
  {
    q: "টাকা কীভাবে দেব?",
    a: "বিকাশ, নগদ, রকেট বা ব্যাংকে পাঠিয়ে অ্যাপে TrxID দিন। আমরা যাচাই করে সাথে সাথে মেয়াদ বাড়িয়ে দেব।",
  },
  {
    q: "ট্রায়াল শেষ হলে ডেটা কি মুছে যাবে?",
    a: "না। মেয়াদ শেষ হলে অ্যাপ কিছু দিন শুধু-দেখা অবস্থায় থাকে — আপনার হিসাব থাকে, শুধু নতুন এন্ট্রি বন্ধ থাকে।",
  },
];

export default async function HomePage() {
  // বাস্তব সংখ্যা — খালি দাবি নয়
  const db = supabaseAdmin();
  const [{ count: companyCount }, { data: plan }] = await Promise.all([
    db.from("companies").select("id", { count: "exact", head: true }),
    db.from("plans").select("price, duration_days").eq("is_active", true).order("price").limit(1).maybeSingle(),
  ]);

  const startingPrice = plan?.price ? Number(plan.price) : null;

  return (
    <>
      {/* ১ · হিরো */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/70 via-white to-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 top-40 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700">
                🇧🇩 বাংলাদেশের মুদি ব্যবসার জন্যই বানানো
              </span>

              <h1 className="mt-5 text-4xl font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl">
                স্টক, বাকি ও লাভ —<br />
                <span className="text-emerald-600">এক অ্যাপেই সব হিসাব</span>
              </h1>

              <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">
                খাতা-কলম আর মুখস্থ হিসাবের দিন শেষ। একবার এন্ট্রি দিলেই স্টক কমবে, বাকি
                উঠবে, লাভ হিসাব হবে — ইন্টারনেট ছাড়াও।
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="rounded-xl bg-emerald-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
                >
                  ১৫ দিন ফ্রি শুরু করুন
                </Link>
                <Link
                  href="/download"
                  className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-700 transition hover:border-slate-400"
                >
                  📱 APK ডাউনলোড
                </Link>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                <span>✓ কার্ড লাগবে না</span>
                <span>✓ পুরো অ্যাপ বাংলায়</span>
                <span>✓ যেকোনো সময় বাতিল</span>
              </div>
            </div>

            {/* ফোন মকআপ */}
            <div className="relative mx-auto w-full max-w-xs">
              <div className="rounded-[2.2rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl">
                <div className="overflow-hidden rounded-[1.5rem] bg-slate-50">
                  <div className="bg-slate-900 px-4 pb-5 pt-3 text-white">
                    <p className="text-[10px] opacity-60">শুভ সকাল</p>
                    <p className="text-sm font-bold">মেসার্স রহমান স্টোর</p>
                  </div>
                  <div className="-mt-3 grid grid-cols-2 gap-2 px-3">
                    {[
                      { l: "আজকের বিক্রি", v: "৳১২,৪৫০", c: "text-emerald-600" },
                      { l: "আজকের ক্রয়", v: "৳৮,২০০", c: "text-slate-900" },
                      { l: "বাকি পাওনা", v: "৳৩৪,৭০০", c: "text-red-600" },
                      { l: "আজকের লাভ", v: "৳৪,২৫০", c: "text-emerald-600" },
                    ].map((s) => (
                      <div key={s.l} className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-[9px] text-slate-500">{s.l}</p>
                        <p className={`text-sm font-bold ${s.c}`}>{s.v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-1.5 px-3 pb-4">
                    {["🛒 বিক্রয়", "📥 ক্রয়", "💵 পেমেন্ট", "📦 স্টক"].map((m) => (
                      <div
                        key={m}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                      >
                        <span>{m}</span>
                        <span className="text-slate-300">›</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ২ · সংখ্যা */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 sm:grid-cols-4">
          {[
            { v: companyCount && companyCount > 0 ? `${companyCount}+` : "নতুন", l: "ব্যবসা নিকাশে" },
            { v: "৩ স্তর", l: "সরবরাহকারী · গুদাম · দোকান" },
            { v: "১০০%", l: "বাংলা ইন্টারফেস" },
            { v: "অফলাইন", l: "নেট ছাড়াও চলে" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <p className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{s.v}</p>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ৩ · সমস্যা */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            খাতার হিসাব কেন মেলে না?
          </h2>
          <p className="mt-3 text-slate-600">
            প্রতিদিন যে সমস্যাগুলো ব্যবসার লাভ খেয়ে ফেলে — নিকাশ ঠিক সেগুলোই সমাধান করে।
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { bad: "কে কত বাকি রেখেছে মনে নেই", good: "প্রতিটি পার্টির বাকি, তারিখসহ এক পাতায়" },
            { bad: "স্টক কত আছে জানতে গুদামে যেতে হয়", good: "রিয়েল-টাইম স্টক, ইউনিট অনুযায়ী" },
            { bad: "মাস শেষে লাভ কত বোঝা যায় না", good: "প্রতিদিনের লাভ স্বয়ংক্রিয়ভাবে হিসাব" },
            { bad: "মেয়াদোত্তীর্ণ মাল পড়ে থেকে নষ্ট হয়", good: "মেয়াদ শেষের আগেই সতর্কবার্তা" },
            { bad: "কর্মচারী ভুল দাম নিলে ধরা যায় না", good: "প্রতিটি এন্ট্রি কে দিল, লগে থাকে" },
            { bad: "খাতা হারালে সব হিসাব শেষ", good: "ক্লাউডে ব্যাকআপ, ফোন বদলালেও ডেটা থাকে" },
          ].map((p) => (
            <div key={p.bad} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="flex gap-2 text-sm text-slate-400 line-through">
                <span className="not-italic no-underline">❌</span> {p.bad}
              </p>
              <p className="mt-3 flex gap-2 text-sm font-medium text-slate-800">
                <span>✅</span> {p.good}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ৪ · তিন স্তর */}
      <section className="bg-slate-900 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">আপনার ব্যবসা যেমনই হোক</h2>
            <p className="mt-3 text-slate-300">
              সাপ্লাই চেইনের তিন স্তরের জন্য আলাদা আলাদা স্ক্রিন ও হিসাব।
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:bg-white/10"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${t.tone} text-2xl`}
                >
                  {t.icon}
                </div>
                <h3 className="mt-4 text-lg font-bold">{t.name}</h3>
                <ul className="mt-3 space-y-2">
                  {t.points.map((p) => (
                    <li key={p} className="flex gap-2 text-sm text-slate-300">
                      <span className="text-emerald-400">✓</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ৫ · ফিচার */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">যা যা পাবেন</h2>
          <p className="mt-3 text-slate-600">
            ব্যবসা চালানোর জন্য দরকারি সব কিছু — আলাদা কোনো সফটওয়্যার লাগবে না।
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-600/5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-xl">
                {f.icon}
              </div>
              <h3 className="mt-4 font-bold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ৬ · কীভাবে শুরু */}
      <section className="border-y border-slate-200 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">তিন ধাপে শুরু</h2>
            <p className="mt-3 text-slate-600">১০ মিনিটেই প্রথম বিক্রির এন্ট্রি দিতে পারবেন।</p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-slate-200 bg-white p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ৭ · অফলাইন */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="grid items-center gap-10 rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50 to-white p-8 sm:p-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
              অফলাইন-ফার্স্ট
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
              নেট নেই? কাজ থামবে না।
            </h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              বাজারে, গুদামে বা গাড়িতে — যেখানেই থাকুন, এন্ট্রি দিতে থাকুন। সব কিছু আগে
              ফোনেই জমা হয়, নেটওয়ার্ক পেলে নিজে থেকেই সার্ভারে চলে যায়। একই এন্ট্রি দুইবার
              যাওয়ার ভয় নেই।
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "ফোনেই লোকাল ডাটাবেস — সাথে সাথে সেভ",
                "নেট এলে নিজে থেকেই সিঙ্ক",
                "একই বিল দুইবার যাবে না",
                "একাধিক ডিভাইসে একই হিসাব",
              ].map((x) => (
                <li key={x} className="flex gap-2 text-sm text-slate-700">
                  <span className="text-sky-600">✓</span> {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">📴</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">অফলাইন মোড</p>
                  <p className="text-xs text-slate-500">৩টি এন্ট্রি অপেক্ষমাণ</p>
                </div>
              </div>
              <div className="space-y-2 pt-3">
                {["বিক্রয় · ৳২,৪০০", "ক্রয় · ৳৮,১০০", "পেমেন্ট · ৳১,০০০"].map((r) => (
                  <div key={r} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="text-slate-700">{r}</span>
                    <span className="text-amber-600">⏳</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-700">
                নেট এলেই ✓ সিঙ্ক হয়ে যাবে
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ৮ · দামের ঝলক */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:pb-20">
        <div className="rounded-3xl bg-slate-900 p-8 text-center text-white sm:p-12">
          <h2 className="text-3xl font-extrabold tracking-tight">সহজ দাম, লুকানো খরচ নেই</h2>
          <p className="mt-3 text-slate-300">
            {startingPrice !== null
              ? `মাত্র ৳${startingPrice.toLocaleString("en-BD")} থেকে শুরু। প্রথম ১৫ দিন সম্পূর্ণ ফ্রি।`
              : "প্রথম ১৫ দিন সম্পূর্ণ ফ্রি। এরপর ব্যবসার আকার অনুযায়ী প্ল্যান।"}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/pricing"
              className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              সব প্ল্যান দেখুন
            </Link>
            <Link
              href="/signup"
              className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              ফ্রি ট্রায়াল
            </Link>
          </div>
        </div>
      </section>

      {/* ৯ · প্রশ্নোত্তর */}
      <section className="border-t border-slate-200 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-slate-900">
            সাধারণ প্রশ্ন
          </h2>

          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-slate-900">
                  {f.q}
                  <span className="shrink-0 text-slate-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            আরও প্রশ্ন আছে?{" "}
            <Link href="/contact" className="font-semibold text-emerald-600 hover:underline">
              আমাদের সাথে যোগাযোগ করুন
            </Link>
          </p>
        </div>
      </section>

      {/* ১০ · শেষ CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16 text-center sm:py-24">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          আজই হিসাব গুছিয়ে ফেলুন
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          ১৫ দিন ফ্রি — কার্ড লাগবে না। পছন্দ না হলে কিছুই দিতে হবে না।
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-xl bg-emerald-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
          >
            ফ্রি ট্রায়াল শুরু করুন
          </Link>
          <Link
            href="/download"
            className="rounded-xl border border-slate-300 px-7 py-3.5 font-semibold text-slate-700 transition hover:border-slate-400"
          >
            অ্যাপ ডাউনলোড
          </Link>
        </div>
      </section>
    </>
  );
}
