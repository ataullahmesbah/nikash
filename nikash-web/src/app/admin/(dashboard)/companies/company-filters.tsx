"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

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

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: q || null });
        }}
        className="flex flex-1 min-w-52 gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="নাম, ID বা ফোন দিয়ে খুঁজুন..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          খুঁজুন
        </button>
      </form>

      <select
        value={status}
        onChange={(e) => apply({ status: e.target.value || null })}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">সব স্ট্যাটাস</option>
        <option value="trial">ট্রায়াল</option>
        <option value="active">সক্রিয়</option>
        <option value="grace">গ্রেস</option>
        <option value="readonly">শুধু-দেখা</option>
        <option value="blocked">ব্লক</option>
      </select>

      <select
        value={type}
        onChange={(e) => apply({ type: e.target.value || null })}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">সব ধরন</option>
        <option value="shop">দোকান</option>
        <option value="warehouse">গুদাম</option>
        <option value="vendor">পরিবেশক</option>
      </select>

      <button
        onClick={() => apply({ expiring: expiring ? null : "1" })}
        className={`rounded-lg border px-3 py-2 text-sm font-medium ${
          expiring ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-300 text-slate-600"
        }`}
      >
        ⏰ শীঘ্রই মেয়াদ শেষ
      </button>

      {(status || type || expiring || sp.get("q")) && (
        <button
          onClick={() => router.push("/admin/companies")}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ফিল্টার মুছুন
        </button>
      )}
    </div>
  );
}
