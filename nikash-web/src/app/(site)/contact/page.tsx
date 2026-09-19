import type { Metadata } from "next";
import { getPublicSettings, whatsappLink } from "@/lib/public-settings";
import ContactForm from "./_components/contact-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "যোগাযোগ — নিকাশ",
  description: "নিকাশের সাথে যোগাযোগ করুন — ফোন, হোয়াটসঅ্যাপ, ইমেইল বা বার্তা পাঠান।",
};

export default async function ContactPage() {
  const { support } = await getPublicSettings();
  const wa = support.whatsapp ? whatsappLink(support.whatsapp, "নিকাশ সম্পর্কে জানতে চাই।") : null;

  const channels = [
    support.phone && {
      icon: "☎️",
      title: "ফোন করুন",
      value: support.phone,
      href: `tel:${support.phone}`,
      hint: support.hours,
    },
    wa && {
      icon: "💬",
      title: "হোয়াটসঅ্যাপ",
      value: support.whatsapp,
      href: wa,
      hint: "দ্রুত উত্তর পেতে",
    },
    support.email && {
      icon: "✉️",
      title: "ইমেইল",
      value: support.email,
      href: `mailto:${support.email}`,
      hint: "বিস্তারিত লিখে পাঠান",
    },
  ].filter(Boolean) as { icon: string; title: string; value: string; href: string; hint?: string }[];

  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-emerald-50/60 to-white">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center sm:py-20">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            যোগাযোগ করুন
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            প্রশ্ন, ডেমো বা সমস্যা — যেটাই হোক, আমরা বাংলায় উত্তর দেব।
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4">
            {channels.map((c) => (
              <a
                key={c.title}
                href={c.href}
                className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-sm"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">
                  {c.icon}
                </span>
                <div>
                  <p className="font-bold text-slate-900">{c.title}</p>
                  <p className="mt-0.5 text-sm font-medium text-emerald-700">{c.value}</p>
                  {c.hint && <p className="mt-0.5 text-xs text-slate-500">{c.hint}</p>}
                </div>
              </a>
            ))}

            {support.address && (
              <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                  📍
                </span>
                <div>
                  <p className="font-bold text-slate-900">ঠিকানা</p>
                  <p className="mt-0.5 text-sm text-slate-600">{support.address}</p>
                </div>
              </div>
            )}

            {channels.length === 0 && !support.address && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                যোগাযোগের তথ্য শীঘ্রই যুক্ত হবে। ততক্ষণ পাশের ফর্মে বার্তা পাঠান।
              </div>
            )}

            <div className="rounded-2xl bg-slate-900 p-6 text-white">
              <p className="font-bold">সাপোর্টের সময়</p>
              <p className="mt-1.5 text-sm text-slate-300">
                {support.hours || "সকাল ৯টা – রাত ৯টা"}
              </p>
              <p className="mt-3 text-xs text-slate-400">
                এই সময়ের বাইরে বার্তা পাঠালে পরদিন সকালেই উত্তর পাবেন।
              </p>
            </div>
          </div>

          <ContactForm />
        </div>
      </section>
    </>
  );
}
