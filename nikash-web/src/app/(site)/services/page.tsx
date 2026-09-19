import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "সেবা — নিকাশ",
  description:
    "নিকাশ কী কী সেবা দেয় — স্টক ব্যবস্থাপনা, বাকির হিসাব, বিক্রয়-ক্রয়, রিপোর্ট, মাল্টি-ব্রাঞ্চ ও সাপোর্ট।",
};

const MODULES = [
  {
    icon: "📦",
    title: "স্টক ও গুদাম ব্যবস্থাপনা",
    body: "পণ্য, ভ্যারিয়েন্ট ও একাধিক ইউনিট — পিস থেকে কার্টন পর্যন্ত। ব্যাচ ও মেয়াদ ধরে স্টক, গুদামভিত্তিক হিসাব, স্টক গণনা ও সমন্বয়।",
    points: ["রিয়েল-টাইম স্টক", "ব্যাচ ও মেয়াদ (FEFO)", "স্টক ট্রান্সফার", "ক্ষতি ও সমন্বয় এন্ট্রি"],
  },
  {
    icon: "🛒",
    title: "বিক্রয় ও ক্রয়",
    body: "দ্রুত এন্ট্রি স্ক্রিন, ড্রাফট ও পোস্ট ব্যবস্থা, রিটার্ন, আর ভুল হলে কারণসহ সংশোধন — স্টক ও বাকি নিজে থেকেই ঠিক হয়ে যায়।",
    points: ["ড্রাফট ও পোস্ট", "বিক্রয়/ক্রয় রিটার্ন", "সংশোধন ও অডিট লগ", "বাংলা ইনভয়েস PDF"],
  },
  {
    icon: "🧾",
    title: "বাকি ও পেমেন্ট",
    body: "প্রতিটি পার্টির বাকি, কতদিনের পুরনো, কোন বিলের বিপরীতে — সব এক পাতায়। আংশিক টাকা নিলে বাকিটা নিজে থেকেই আপডেট হয়।",
    points: ["পার্টিভিত্তিক বাকির খাতা", "আংশিক পেমেন্ট", "বয়স অনুযায়ী রং", "হোয়াটসঅ্যাপে তাগাদা"],
  },
  {
    icon: "📊",
    title: "রিপোর্ট ও বিশ্লেষণ",
    body: "দৈনিক সারাংশ নিজে থেকেই তৈরি হয়। তারিখ বেছে বিক্রি, ক্রয়, খরচ ও লাভ দেখুন — মাসিক তুলনাসহ।",
    points: ["দৈনিক লাভ-ক্ষতি", "তারিখ পরিসর বাছাই", "মাসিক বিশ্লেষণ", "শীর্ষ পণ্য ও পার্টি"],
  },
  {
    icon: "🚚",
    title: "গাড়ি, রুট ও ডেলিভারি",
    body: "পরিবেশকদের জন্য গাড়ি, চালক ও রুট ব্যবস্থাপনা। কোন গাড়ি কোন রুটে কত মাল নিল, কত ফিরল — সব হিসাব।",
    points: ["গাড়ি ও চালক", "রুটভিত্তিক দোকান", "ট্রিপের হিসাব", "ট্রিপ খরচ"],
  },
  {
    icon: "👥",
    title: "ব্যবহারকারী ও অনুমতি",
    body: "মালিক, ম্যানেজার ও বিক্রয়কর্মী — আলাদা রোল। কে কোন স্ক্রিন দেখবে, কে দাম বদলাতে পারবে, সব আপনি ঠিক করবেন।",
    points: ["তিন স্তরের রোল", "ডিভাইস সীমা", "লগইন ইতিহাস", "প্রতিটি এন্ট্রির দায়ভার"],
  },
];

const SERVICES = [
  {
    icon: "🎓",
    title: "বিনামূল্যে সেটআপ ও প্রশিক্ষণ",
    body: "প্রথম দিনে পণ্য তালিকা, খোলা স্টক ও পার্টি তুলে দিতে আমরা সাহায্য করি। ফোনে বা রিমোটে ধরে ধরে শিখিয়ে দিই।",
  },
  {
    icon: "📞",
    title: "বাংলায় সাপোর্ট",
    body: "ফোন, হোয়াটসঅ্যাপ বা ইমেইল — যেভাবে সহজ। কোনো রোবট নয়, মানুষই কথা বলবে।",
  },
  {
    icon: "☁️",
    title: "ব্যাকআপ ও পুনরুদ্ধার",
    body: "আপনার সব হিসাব ক্লাউডে নিরাপদ। ফোন হারালে বা বদলালে নতুন ফোনে লগইন করলেই সব ফিরে আসে।",
  },
  {
    icon: "🔧",
    title: "ব্যবসা অনুযায়ী কাস্টমাইজেশন",
    body: "বড় প্রতিষ্ঠানের জন্য বিশেষ রিপোর্ট, ইনভয়েস ডিজাইন বা ইন্টিগ্রেশন — কথা বললে ব্যবস্থা হবে।",
  },
];

export default function ServicesPage() {
  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-emerald-50/60 to-white">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:py-20">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            আমাদের সেবা
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            শুধু একটা অ্যাপ নয় — ব্যবসার হিসাব গুছিয়ে দেওয়া পর্যন্ত আমরা সাথে থাকি।
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">অ্যাপের মডিউল</h2>
        <p className="mt-2 text-slate-600">ব্যবসা চালানোর সব অংশ একই জায়গায়।</p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {MODULES.map((m) => (
            <div
              key={m.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-600/5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl">
                {m.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{m.body}</p>
              <ul className="mt-4 grid grid-cols-2 gap-1.5">
                {m.points.map((p) => (
                  <li key={p} className="flex gap-1.5 text-xs text-slate-500">
                    <span className="text-emerald-600">✓</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">অ্যাপের বাইরেও</h2>
          <p className="mt-2 text-slate-600">সফটওয়্যারের সাথে যে সেবাগুলো ফ্রি পাবেন।</p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s) => (
              <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="text-2xl">{s.icon}</span>
                <h3 className="mt-3 font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 text-center sm:py-20">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
          আপনার ব্যবসার জন্য কোনটা দরকার?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          ফ্রি ট্রায়ালে সব মডিউল খোলা থাকে — চালিয়ে দেখুন, তারপর সিদ্ধান্ত নিন।
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-xl bg-emerald-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700"
          >
            ফ্রি ট্রায়াল শুরু
          </Link>
          <Link
            href="/contact"
            className="rounded-xl border border-slate-300 px-7 py-3.5 font-semibold text-slate-700 hover:border-slate-400"
          >
            ডেমো চাই
          </Link>
        </div>
      </section>
    </>
  );
}
