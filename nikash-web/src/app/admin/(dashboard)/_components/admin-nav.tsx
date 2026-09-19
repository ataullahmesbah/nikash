"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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

export default function AdminNav({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {g.title}
          </p>
          <div className="space-y-0.5">
            {g.links.map((l) => {
              const active = pathname === l.href || (l.href !== "/admin" && pathname.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-base">{l.icon}</span>
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* মোবাইল টপ বার */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <button onClick={() => setMobileOpen(true)} className="text-xl" aria-label="মেনু">
          ☰
        </button>
        <p className="font-bold text-slate-900">Nikash Admin</p>
        <NotificationBell />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white p-4">
            <div className="mb-5 flex items-center justify-between px-2">
              <p className="text-lg font-bold text-slate-900">Nikash</p>
              <button onClick={() => setMobileOpen(false)} className="text-slate-400">
                ✕
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      {/* ডেস্কটপ সাইডবার */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-5 flex items-center justify-between px-2">
          <div>
            <p className="text-lg font-bold text-slate-900">Nikash</p>
            <p className="text-xs text-slate-500">Super Admin</p>
          </div>
          <NotificationBell />
        </div>

        {nav}

        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="px-2 text-sm font-medium text-slate-800">{name}</p>
          <p className="px-2 text-xs text-slate-400">{role}</p>
          <button
            onClick={handleLogout}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            লগ আউট
          </button>
        </div>
      </aside>
    </>
  );
}
