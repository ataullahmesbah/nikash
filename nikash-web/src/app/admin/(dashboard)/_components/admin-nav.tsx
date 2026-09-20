"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import NotificationBell from "./notification-bell";

const GROUPS: { title: string; links: { href: string; label: string; icon: string }[] }[] = [
  {
    title: "সারসংক্ষেপ",
    links: [
      { href: "/admin", label: "ড্যাশবোর্ড", icon: "📊" },
      { href: "/admin/notifications", label: "নোটিফিকেশন", icon: "🔔" },
    ],
  },
  {
    title: "গ্রাহক",
    links: [
      { href: "/admin/companies", label: "কোম্পানি", icon: "🏢" },
      { href: "/admin/notices", label: "নোটিশ", icon: "📢" },
      { href: "/admin/contacts", label: "যোগাযোগ বার্তা", icon: "📬" },
    ],
  },
  {
    title: "আর্থিক",
    links: [
      { href: "/admin/payments", label: "পেমেন্ট", icon: "💳" },
      { href: "/admin/finance", label: "ফাইন্যান্স", icon: "💰" },
      { href: "/admin/analytics", label: "রাজস্ব (MRR/ARR)", icon: "📈" },
    ],
  },
  {
    title: "ব্যবস্থাপনা",
    links: [
      { href: "/admin/users", label: "ব্যবহারকারী ও রোল", icon: "👥" },
      { href: "/admin/app-versions", label: "অ্যাপ ভার্সন", icon: "📱" },
      { href: "/admin/audit", label: "অডিট", icon: "🕓" },
      { href: "/admin/settings", label: "সেটিংস", icon: "⚙️" },
    ],
  },
];

const ROLE_BN: Record<string, string> = {
  super_admin: "সুপার অ্যাডমিন",
  support_admin: "সাপোর্ট অ্যাডমিন",
  finance_admin: "ফাইন্যান্স অ্যাডমিন",
  viewer: "শুধু দেখা",
};

/** নামের প্রথম অক্ষর — অ্যাভাটারের বদলে */
function initial(name: string) {
  return name.trim().charAt(0) || "অ";
}

export default function AdminNav({
  name,
  role,
  email,
}: {
  name: string;
  role: string;
  email?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // পাতা বদলালে মোবাইলের ড্রয়ার নিজে থেকে বন্ধ হবে
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // ড্রয়ার খোলা থাকলে পেছনের পাতা স্ক্রল করা বন্ধ
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Esc চাপলে বন্ধ
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  /* ------------------------------ লোগো ------------------------------ */
  const brand = (
    <Link href="/admin" className="flex items-center gap-2.5 px-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white shadow-sm shadow-emerald-600/30">
        নি
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-bold leading-tight text-slate-900">নিকাশ</span>
        <span className="block text-[11px] font-medium leading-tight text-slate-400">
          অ্যাডমিন প্যানেল
        </span>
      </span>
    </Link>
  );

  /* --------------------------- ব্যবহারকারী --------------------------- */
  const userCard = (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
        {initial(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight text-slate-900">{name}</p>
        {email && (
          <p className="truncate text-[11px] leading-tight text-slate-500" title={email}>
            {email}
          </p>
        )}
        <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
          {ROLE_BN[role] ?? role}
        </span>
      </div>
    </div>
  );

  /* ------------------------------ মেনু ------------------------------ */
  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-1 py-1">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {g.title}
          </p>
          <div className="space-y-0.5">
            {g.links.map((l) => {
              // "/admin" শুধু হুবহু মিললে সক্রিয়, নইলে সব পাতাতেই জ্বলে থাকত
              const active =
                l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-slate-900 font-semibold text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {l.icon}
                  </span>
                  <span className="truncate">{l.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  /* ------------------------------ নিচের অংশ ------------------------------ */
  const footer = (
    <div className="space-y-2 border-t border-slate-200 pt-3">
      <Link
        href="/"
        target="_blank"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <span className="text-base leading-none" aria-hidden>
          🌐
        </span>
        <span className="flex-1">ওয়েবসাইট দেখুন</span>
        <span className="text-xs text-slate-400" aria-hidden>
          ↗
        </span>
      </Link>

      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
      >
        <span className="text-base leading-none" aria-hidden>
          🚪
        </span>
        {loggingOut ? "লগ আউট হচ্ছে…" : "লগ আউট"}
      </button>
    </div>
  );

  return (
    <>
      {/* ------------------------- মোবাইল টপ বার ------------------------- */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="মেনু খুলুন"
          className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <Link href="/admin" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
            নি
          </span>
          <span className="font-bold text-slate-900">নিকাশ</span>
        </Link>

        <NotificationBell />
      </div>

      {/* --------------------------- মোবাইল ড্রয়ার --------------------------- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[17rem] max-w-[85vw] flex-col gap-3 bg-white p-3 shadow-2xl">
            <div className="flex items-center justify-between">
              {brand}
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="বন্ধ করুন"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {userCard}
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* --------------------------- ডেস্কটপ সাইডবার --------------------------- */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-3 border-r border-slate-200 bg-white p-3 md:flex">
        <div className="flex items-center justify-between">
          {brand}
          <NotificationBell />
        </div>

        {userCard}
        {nav}
        {footer}
      </aside>
    </>
  );
}
