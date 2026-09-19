import Link from "next/link";
import { getPublicSettings } from "@/lib/public-settings";

// ফুটার — সাপোর্ট তথ্য অ্যাডমিন সেটিংস থেকে আসে, হার্ডকোড করা নেই।

export default async function SiteFooter() {
  const { support } = await getPublicSettings();

  const cols = [
    {
      title: "পণ্য",
      links: [
        { href: "/services", label: "সেবা" },
        { href: "/pricing", label: "প্ল্যান ও দাম" },
        { href: "/download", label: "অ্যাপ ডাউনলোড" },
        { href: "/signup", label: "ফ্রি ট্রায়াল" },
      ],
    },
    {
      title: "প্রতিষ্ঠান",
      links: [
        { href: "/about", label: "আমাদের কথা" },
        { href: "/contact", label: "যোগাযোগ" },
        { href: "/admin/login", label: "অ্যাডমিন লগইন" },
      ],
    },
    {
      title: "আইনি",
      links: [
        { href: "/privacy", label: "গোপনীয়তা নীতি" },
        { href: "/terms", label: "শর্তাবলী" },
        { href: "/refund", label: "রিফান্ড নীতি" },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 py-12 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
              নি
            </span>
            <span className="text-lg font-bold text-slate-900">নিকাশ</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            বাংলাদেশের মুদি সাপ্লাই চেইনের জন্য বানানো স্টক, বাকি ও হিসাবের সফটওয়্যার।
          </p>
        </div>

        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-bold text-slate-900">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-500 transition hover:text-slate-900">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} নিকাশ। সর্বস্বত্ব সংরক্ষিত।</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {support.phone && (
              <a href={`tel:${support.phone}`} className="hover:text-slate-900">
                ☎️ {support.phone}
              </a>
            )}
            {support.email && (
              <a href={`mailto:${support.email}`} className="hover:text-slate-900">
                ✉️ {support.email}
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
