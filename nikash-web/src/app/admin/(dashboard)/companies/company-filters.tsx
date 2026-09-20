"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

// কোম্পানি তালিকার ফিল্টার।
//
// আগে সব কটা ঘর এক লাইনে `flex-wrap` দিয়ে বসানো ছিল — মোবাইলে
// খোঁজার বাক্স আর ড্রপডাউনগুলো একটার ঘাড়ে আরেকটা উঠে যেত। এখন
// মোবাইলে উপর-নিচে, বড় পর্দায় পাশাপাশি।

const STATUSES = [
  { value: "", label: "সব স্ট্যাটাস" },
  { value: "trial", label: "ট্রায়াল" },
  { value: "active", label: "সক্রিয়" },
  { value: "grace", label: "গ্রেস" },
  { value: "readonly", label: "শুধু-দেখা" },
  { value: "blocked", label: "ব্লক" },
];

const TYPES = [
  { value: "", label: "সব ধরন" },
  { value: "shop", label: "দোকান" },
  { value: "warehouse", label: "গুদাম" },
  { value: "vendor", label: "পরিবেশক" },
];

const selectCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-900 sm:w-auto";

export default function CompanyFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function apply(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v) next.set(k, v);
      else next.delete(k);
    });
    router.push(`/admin/companies?${next.toString()}`);
  }

  const status = sp.get("status") ?? "";
  const type = sp.get("type") ?? "";
  const expiring = sp.get("expiring") === "1";
  const hasFilter = Boolean(status || type || expiring || sp.get("q"));

  return (
    <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3">
      {/* খোঁজা — মোবাইলে নিজের পুরো লাইন */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: q || null });
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="নাম, ID বা ফোন দিয়ে খুঁজুন…"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          খুঁজুন
        </button>
      </form>

      {/* ফিল্টার — মোবাইলে দুই কলাম, বড় পর্দায় এক লাইনে */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <select
          value={status}
          onChange={(e) => apply({ status: e.target.value || null })}
          className={selectCls}
          aria-label="স্ট্যাটাস"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => apply({ type: e.target.value || null })}
          className={selectCls}
          aria-label="ব্যবসার ধরন"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => apply({ expiring: expiring ? null : "1" })}
          className={`col-span-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition sm:col-span-1 ${
            expiring
              ? "border-amber-400 bg-amber-50 text-amber-700"
              : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          ⏰ শীঘ্রই মেয়াদ শেষ
        </button>

        {hasFilter && (
          <button
            onClick={() => router.push("/admin/companies")}
            className="col-span-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:text-slate-900 sm:col-span-1 sm:ml-auto"
          >
            ✕ ফিল্টার মুছুন
          </button>
        )}
      </div>
    </div>
  );
}
