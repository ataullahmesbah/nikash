"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// পাবলিক সাইটের নেভিগেশন — মোবাইলে হ্যামবার্গার, স্ক্রল করলে ছায়া পড়ে।

const LINKS = [
  { href: "/services", label: "সেবা" },
  { href: "/pricing", label: "প্ল্যান ও দাম" },
  { href: "/download", label: "ডাউনলোড" },
  { href: "/about", label: "আমাদের কথা" },
  { href: "/contact", label: "যোগাযোগ" },
];

export default function SiteNav({ adminName }: { adminName: string | null }) {
  // adminName এলে বোঝা যায় অ্যাডমিন সেশন চালু আছে — তখন "লগইন"-এর
  // বদলে "ড্যাশবোর্ড" দেখাই। লেআউট (সার্ভার কম্পোনেন্ট) কুকি পড়ে এটা
  // পাঠায়, তাই পাতা লোড হওয়ার সময়ই ঠিক লেখাটা দেখা যায় — ঝিলিক দেয় না।
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-white/90 backdrop-blur transition ${scrolled ? "border-slate-200 shadow-sm" : "border-transparent"
        }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
            নি
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">নিকাশ</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {adminName ? (
            <Link
              href="/admin"
              title={`${adminName} হিসেবে লগইন করা আছে`}
              className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              ড্যাশবোর্ড
            </Link>
          ) : (
            <Link
              href="/admin/login"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              লগইন
            </Link>
          )}
          <Link
            href="/signup"
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            ফ্রি ট্রায়াল
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-xl text-slate-700 md:hidden"
          aria-label="মেনু"
          aria-expanded={open}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-5 py-3">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-slate-100 pt-3">
              {adminName ? (
                <Link
                  href="/admin"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-700"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                  ড্যাশবোর্ড
                </Link>
              ) : (
                <Link
                  href="/admin/login"
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700"
                >
                  লগইন
                </Link>
              )}
              <Link
                href="/signup"
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                ফ্রি ট্রায়াল
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
