import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "আমাদের কথা — নিকাশ",
  description: "নিকাশ কেন তৈরি হলো, কারা আছি আর কী লক্ষ্য নিয়ে কাজ করছি।",
};

const VALUES = [
  {
    icon: "🇧🇩",
    title: "বাংলায়, বাংলাদেশের জন্য",
    body: "মেনু থেকে ইনভয়েস — সব বাংলায়। আমাদের বাজারের নিয়ম মেনেই বানানো, বিদেশি সফটওয়্যারের অনুবাদ নয়।",
  },
  {
    icon: "🤝",
    title: "সহজ না হলে কেউ ব্যবহার করবে না",
    body: "যিনি কখনো কম্পিউটার ধরেননি, তিনিও যেন পারেন — এই ভাবনা থেকেই প্রতিটি স্ক্রিন সাজানো।",
  },
  {
    icon: "🔐",
    title: "আপনার হিসাব আপনারই",
    body: "প্রতিটি ব্যবসার ডেটা ডাটাবেস স্তরেই আলাদা। আমরা আপনার হিসাব বিক্রি করি না, করবও না।",
  },
  {
    icon: "📶",
    title: "নেট ছাড়াও চলতে হবে",
    body: "বাংলাদেশের বাস্তবতায় নেট সবসময় থাকে না। তাই অ্যাপ আগে ফোনে কাজ করে, পরে সিঙ্ক হয়।",
  },
];

const TIMELINE = [
  { year: "শুরু", title: "সমস্যাটা দেখা", body: "গুদাম ও দোকান ঘুরে দেখলাম — খাতার হিসাব আর বাস্তব স্টক কখনোই মেলে না।" },
  { year: "গবেষণা", title: "৫০+ ব্যবসার সাথে কথা", body: "সরবরাহকারী, পরিবেশক ও খুচরা দোকানির দৈনন্দিন কাজ ধরে ধরে বুঝলাম।" },
  { year: "তৈরি", title: "তিন স্তরের একটাই অ্যাপ", body: "একই সাপ্লাই চেইনের তিন স্তরের জন্য আলাদা স্ক্রিন, কিন্তু এক হিসাব।" },
  { year: "এখন", title: "প্রতিদিন উন্নতি", body: "ব্যবহারকারীর পরামর্শ ধরে ধরে নতুন ফিচার যোগ হচ্ছে।" },
];

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-emerald-50/60 to-white">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center sm:py-20">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            আমাদের কথা
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            নিকাশ শুরু হয়েছিল একটা সহজ প্রশ্ন থেকে — বাংলাদেশের লাখো মুদি ব্যবসায়ী কেন
            এখনো খাতায় হিসাব রাখেন? উত্তরটা ছিল সহজ: তাঁদের জন্য বানানো কিছু ছিল না।
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">আমরা যা চাই</h2>
          <p className="mt-4 leading-relaxed text-slate-600">
            দেশের মুদি সাপ্লাই চেইনের প্রতিটি স্তর — মিল থেকে পরিবেশক, পরিবেশক থেকে দোকান —
            যেন একই ভাষায় হিসাব রাখতে পারে। যেন মাস শেষে কারও অনুমান করতে না হয় যে লাভ হলো
            কত। আর যেন কোনো ব্যবসায়ীকে হিসাব রাখার জন্য ইংরেজি শিখতে না হয়।
          </p>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-14">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">যেসব নীতি মেনে চলি</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="text-2xl">{v.icon}</span>
                <h3 className="mt-3 text-lg font-bold text-slate-900">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-14">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">যেভাবে এলাম</h2>
        <div className="mt-8 space-y-0">
          {TIMELINE.map((t, i) => (
            <div key={t.title} className="flex gap-5">
              <div className="flex flex-col items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                {i < TIMELINE.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
              </div>
              <div className="pb-8">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">{t.year}</p>
                <p className="mt-1 font-bold text-slate-900">{t.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-900 py-14 text-center text-white">
        <div className="mx-auto max-w-2xl px-5">
          <h2 className="text-3xl font-extrabold tracking-tight">আমাদের সাথে যুক্ত হোন</h2>
          <p className="mt-3 text-slate-300">
            আপনার ব্যবসার হিসাব গুছিয়ে দিতে আমরা প্রস্তুত।
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700"
            >
              ফ্রি ট্রায়াল
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              যোগাযোগ
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
