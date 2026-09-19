"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Notif = {
  id: string;
  type: string;
  severity: "info" | "success" | "warning" | "critical";
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const ICON: Record<string, string> = {
  payment: "💳", signup: "🏢", subscription: "📅",
  notice: "📢", system: "⚙️", due: "📋",
};

const DOT: Record<string, string> = {
  info: "bg-sky-500", success: "bg-emerald-500",
  warning: "bg-amber-500", critical: "bg-red-500",
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "এইমাত্র";
  if (mins < 60) return `${mins} মিনিট আগে`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ঘণ্টা আগে`;
  return `${Math.floor(hrs / 24)} দিন আগে`;
}

// প্রতি ১৫ সেকেন্ডে পোল করে — কোম্পানি সাইনআপ/পেমেন্ট জমা দিলে
// প্রায় সাথে সাথেই ঘণ্টায় ব্যাজ দেখা যায়।
export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications?limit=15", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      // নেটওয়ার্ক সমস্যা — পরের পোলে আবার চেষ্টা হবে
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markRead(id: string, link: string | null) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    if (link) {
      setOpen(false);
      router.push(link);
    }
  }

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnread(0);
    await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
        aria-label="নোটিফিকেশন"
      >
        <span className="text-base">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* মোবাইলে ঘণ্টাটা টপ বারের ডান কোণে — তাই right-0 ঠিক আছে।
          কিন্তু ট্যাব/ল্যাপটপ/ডেস্কটপে ঘণ্টাটা ২৪০px চওড়া বাঁ সাইডবারের
          ভেতরে বসে; সেখানে right-0 মানে প্যানেলটা (৩২০px) পর্দার বাঁ
          দিকে বেরিয়ে যায়। md থেকে তাই উল্টো দিকে খোলে — ঘণ্টার বাঁ
          প্রান্ত ধরে ডান দিকে, কনটেন্টের উপরে। */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg md:left-0 md:right-auto">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">নোটিফিকেশন</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-medium text-blue-600 hover:underline">
                সব পড়া হিসেবে চিহ্নিত
              </button>
            )}
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">কোনো নোটিফিকেশন নেই</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id, n.link)}
                  className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    n.read_at ? "" : "bg-blue-50/40"
                  }`}
                >
                  <span className="text-lg">{ICON[n.type] ?? "🔔"}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.read_at ? "text-slate-700" : "font-semibold text-slate-900"}`}>
                      {n.title}
                    </p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read_at && <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[n.severity]}`} />}
                </button>
              ))
            )}
          </div>

          <Link
            href="/admin/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-3 text-center text-sm font-medium text-blue-600 hover:bg-slate-50"
          >
            সব নোটিফিকেশন দেখুন
          </Link>
        </div>
      )}
    </div>
  );
}