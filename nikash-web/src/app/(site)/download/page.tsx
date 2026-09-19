import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPublicSettings, whatsappLink } from "@/lib/public-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "অ্যাপ ডাউনলোড — নিকাশ",
  description: "নিকাশ অ্যান্ড্রয়েড অ্যাপ ডাউনলোড করুন। QR কোড স্ক্যান করে সরাসরি ফোনে নিন, ইনস্টল গাইড ও ইউজার ম্যানুয়ালসহ।",
};

const REQUIREMENTS = [
  { icon: "📱", label: "অ্যান্ড্রয়েড", value: "৮.০ বা তার উপরে" },
  { icon: "💾", label: "জায়গা", value: "কমপক্ষে ১৫০ MB ফাঁকা" },
  { icon: "🌐", label: "ইন্টারনেট", value: "প্রথমবার লগইনে লাগবে, পরে ঐচ্ছিক" },
  { icon: "🖨️", label: "প্রিন্টার", value: "ব্লুটুথ থার্মাল প্রিন্টার (ঐচ্ছিক)" },
];

const INSTALL_STEPS = [
  {
    title: "APK ফাইল ডাউনলোড করুন",
    body: "উপরের বাটনে চাপুন বা QR কোড স্ক্যান করুন। ফাইলটি ফোনের Downloads ফোল্ডারে জমা হবে।",
  },
  {
    title: "অজানা সোর্স অনুমতি দিন",
    body: "সেটিংস → নিরাপত্তা → “Install unknown apps” — এখানে আপনার ব্রাউজার বা ফাইল ম্যানেজারকে অনুমতি দিন।",
  },
  {
    title: "ইনস্টল করুন",
    body: "ডাউনলোড করা ফাইলে ট্যাপ করুন। Play Protect সতর্কতা দেখালে “Install anyway” চাপুন — আমাদের APK নিরাপদ।",
  },
  {
    title: "লগইন বা সাইন আপ",
    body: "অ্যাপ খুলে ফোন নম্বর ও পাসওয়ার্ড দিন। নতুন হলে ওয়েবসাইট থেকে আগে সাইন আপ করে নিন।",
  },
];

const FIRST_STEPS = [
  { icon: "🏷️", title: "পণ্য যোগ করুন", body: "রেডিমেড তালিকা থেকে বেছে নিন, নয়তো নিজের পণ্য ও ইউনিট তৈরি করুন।" },
  { icon: "👥", title: "পার্টি যোগ করুন", body: "ক্রেতা ও সরবরাহকারীর নাম, নম্বর ও ঠিকানা তুলে রাখুন।" },
  { icon: "📥", title: "খোলা স্টক তুলুন", body: "এখন গুদামে যা আছে তা একবার এন্ট্রি দিন — এরপর থেকে সব নিজে থেকেই মিলবে।" },
  { icon: "🛒", title: "প্রথম বিক্রি দিন", body: "বিক্রয় স্ক্রিনে পণ্য বেছে পরিমাণ দিন — স্টক ও বাকি সাথে সাথে আপডেট হবে।" },
];

export default async function DownloadPage() {
  const db = supabaseAdmin();

  const [versionRes, historyRes, settings] = await Promise.all([
    db
      .from("app_versions")
      .select("*")
      .eq("platform", "android")
      .order("build_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("app_versions")
      .select("version, release_notes, released_at, file_size_mb")
      .eq("platform", "android")
      .order("build_number", { ascending: false })
      .limit(6),
    getPublicSettings(),
  ]);

  const version = versionRes.data;
  const { support, appLinks } = settings;

  // অ্যাপ লিংক সেটিংসে থাকলে সেটাই, নয়তো সর্বশেষ প্রকাশিত ভার্সনের লিংক
  const apkUrl = appLinks.apk_url || version?.apk_url || "";

  // QR সার্ভারেই বানাই — বাইরের কোনো QR সার্ভিসে লিংক পাঠাতে হয় না
  let qrDataUrl: string | null = null;
  if (apkUrl) {
    try {
      qrDataUrl = await QRCode.toDataURL(apkUrl, { width: 320, margin: 1 });
    } catch {
      qrDataUrl = null;
    }
  }

  const wa = support.whatsapp ? whatsappLink(support.whatsapp, "নিকাশ অ্যাপ ইনস্টলে সাহায্য দরকার।") : null;

  return (
    <>
      {/* হিরো + ডাউনলোড কার্ড */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-emerald-50/60 to-white">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700">
                অ্যান্ড্রয়েড অ্যাপ
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                নিকাশ অ্যাপ<br />
                <span className="text-emerald-600">ফোনে নিয়ে নিন</span>
              </h1>
              <p className="mt-4 max-w-lg text-lg text-slate-600">
                দোকান, গুদাম বা সরবরাহ — সব হিসাব এক অ্যাপে। ইন্টারনেট ছাড়াও চলে।
              </p>

              {version ? (
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  {apkUrl ? (
                    <a
                      href={apkUrl}
                      className="rounded-xl bg-emerald-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
                    >
                      ⬇️ APK ডাউনলোড (v{version.version})
                    </a>
                  ) : null}
                  {appLinks.play_store && (
                    <a
                      href={appLinks.play_store}
                      className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-700 transition hover:border-slate-400"
                    >
                      ▶️ প্লে স্টোর
                    </a>
                  )}
                  {appLinks.manual_url && (
                    <a
                      href={appLinks.manual_url}
                      className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-slate-700 transition hover:border-slate-400"
                    >
                      📘 ইউজার ম্যানুয়াল
                    </a>
                  )}
                </div>
              ) : (
                <div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                  এখনো কোনো ভার্সন প্রকাশিত হয়নি। শীঘ্রই আসছে — খবর পেতে{" "}
                  <Link href="/contact" className="font-semibold underline">
                    যোগাযোগ করুন
                  </Link>
                  ।
                </div>
              )}

              {version && (
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                  <span>ভার্সন {version.version}</span>
                  {version.file_size_mb && <span>{version.file_size_mb} MB</span>}
                  <span>
                    প্রকাশ{" "}
                    {new Date(version.released_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* QR কার্ড */}
            <div className="mx-auto w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
              <p className="font-bold text-slate-900">ফোন দিয়ে স্ক্যান করুন</p>
              <p className="mt-1 text-sm text-slate-500">
                ক্যামেরা খুলে কোডটি ধরুন — ডাউনলোড সরাসরি শুরু হবে।
              </p>

              <div className="mt-5 flex justify-center">
                {qrDataUrl ? (
                  <Image
                    src={qrDataUrl}
                    alt="নিকাশ APK ডাউনলোড QR কোড"
                    width={200}
                    height={200}
                    unoptimized
                    className="rounded-xl border border-slate-200"
                  />
                ) : (
                  <div className="flex h-[200px] w-[200px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
                    লিংক প্রস্তুত হলে QR আসবে
                  </div>
                )}
              </div>

              <p className="mt-5 text-xs text-slate-400">
                QR কাজ না করলে উপরের ডাউনলোড বাটন ব্যবহার করুন।
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* প্রয়োজনীয়তা */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">যা যা লাগবে</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REQUIREMENTS.map((r) => (
            <div key={r.label} className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-2xl">{r.icon}</span>
              <p className="mt-3 text-sm font-semibold text-slate-900">{r.label}</p>
              <p className="mt-1 text-sm text-slate-500">{r.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ইনস্টল গাইড */}
      <section className="border-y border-slate-200 bg-slate-50 py-14">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">ইনস্টল করার নিয়ম</h2>
          <p className="mt-2 text-slate-600">চার ধাপে শেষ — ৩ মিনিটের কাজ।</p>

          <ol className="mt-7 grid gap-4 sm:grid-cols-2">
            {INSTALL_STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{s.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-semibold">⚠️ Play Protect সতর্কতা নিয়ে ভয় পাবেন না</p>
            <p className="mt-1.5 leading-relaxed">
              প্লে স্টোরের বাইরের যেকোনো APK-তে অ্যান্ড্রয়েড এই সতর্কতা দেখায়। এটি ভাইরাসের
              ইঙ্গিত নয়। নিকাশের APK শুধু এই ওয়েবসাইট থেকেই নামাবেন — অন্য কোথাও পেলে সেটি
              আমাদের নয়।
            </p>
          </div>
        </div>
      </section>

      {/* প্রথম দিনের কাজ */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">ইনস্টলের পর প্রথম দিন</h2>
        <p className="mt-2 text-slate-600">এই চারটা কাজ করে নিলেই অ্যাপ পুরোপুরি আপনার ব্যবসার মতো হয়ে যাবে।</p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FIRST_STEPS.map((s) => (
            <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="text-2xl">{s.icon}</span>
              <p className="mt-3 font-semibold text-slate-900">{s.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ভার্সন ইতিহাস */}
      {(historyRes.data ?? []).length > 0 && (
        <section className="border-t border-slate-200 bg-slate-50 py-14">
          <div className="mx-auto max-w-4xl px-5">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">ভার্সনের ইতিহাস</h2>
            <div className="mt-6 space-y-3">
              {(historyRes.data ?? []).map((v) => (
                <div key={v.version} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">
                      v{v.version}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(v.released_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    {v.file_size_mb && <span className="text-xs text-slate-400">{v.file_size_mb} MB</span>}
                  </div>
                  {v.release_notes && (
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                      {v.release_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* সাহায্য */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="rounded-3xl bg-slate-900 p-8 text-white sm:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">ইনস্টলে সমস্যা হচ্ছে?</h2>
              <p className="mt-3 text-slate-300">
                ফোন করুন বা হোয়াটসঅ্যাপে লিখুন — আমরা রিমোটে ধরে ধরে সেট করে দেব।
                {support.hours ? ` (${support.hours})` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              {support.phone && (
                <a
                  href={`tel:${support.phone}`}
                  className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  ☎️ {support.phone}
                </a>
              )}
              {wa && (
                <a
                  href={wa}
                  className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700"
                >
                  💬 হোয়াটসঅ্যাপ
                </a>
              )}
              <Link
                href="/contact"
                className="rounded-xl border border-white/30 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                যোগাযোগ ফর্ম
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
