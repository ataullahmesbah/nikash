"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

type Company = { id: string; name: string; nikash_id: string; status: string; business_type: string };

const STATUSES = [
  { value: "trial", label: "ট্রায়াল" },
  { value: "active", label: "সক্রিয়" },
  { value: "grace", label: "গ্রেস" },
  { value: "readonly", label: "শুধু-দেখা" },
  { value: "blocked", label: "ব্লক" },
];

export default function AddNoticeForm({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const [titleBn, setTitleBn] = useState("");
  const [bodyBn, setBodyBn] = useState("");
  const [severity, setSeverity] = useState("info");
  const [showAs, setShowAs] = useState("banner");
  const [endAt, setEndAt] = useState("");

  const [targetMode, setTargetMode] = useState<"all" | "type" | "companies" | "status">("all");
  const [businessType, setBusinessType] = useState("shop");
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies.slice(0, 50);
    return companies
      .filter((c) => c.name.toLowerCase().includes(q) || c.nikash_id.toLowerCase().includes(q))
      .slice(0, 50);
  }, [companies, search]);

  const reach = useMemo(() => {
    if (targetMode === "all") return companies.length;
    if (targetMode === "type") return companies.filter((c) => c.business_type === businessType).length;
    if (targetMode === "companies") return companyIds.length;
    return companies.filter((c) => statuses.includes(c.status)).length;
  }, [targetMode, companies, businessType, companyIds, statuses]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/admin/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleBn, bodyBn, severity, showAs, endAt: endAt || null,
        targetMode, businessType, companyIds, statuses,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "পাঠানো যায়নি");
      return;
    }
    setTitleBn("");
    setBodyBn("");
    setCompanyIds([]);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">নতুন নোটিশ পাঠান</h2>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">শিরোনাম *</label>
          <input
            value={titleBn}
            onChange={(e) => setTitleBn(e.target.value)}
            required
            placeholder="যেমন: সার্ভার রক্ষণাবেক্ষণের নোটিশ"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">বার্তা</label>
          <textarea
            value={bodyBn}
            onChange={(e) => setBodyBn(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">গুরুত্ব</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="info">তথ্য</option>
              <option value="warning">সতর্কতা</option>
              <option value="critical">জরুরি</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">কীভাবে দেখাবে</label>
            <select value={showAs} onChange={(e) => setShowAs(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="banner">ব্যানার (উপরে)</option>
              <option value="popup">পপআপ (অ্যাপ খুললেই)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">মেয়াদ শেষ (ঐচ্ছিক)</label>
            <input
              type="date"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* টার্গেটিং */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">🎯 কাদের পাঠাবেন?</p>

          <div className="space-y-2">
            {[
              { v: "all", label: "সব কোম্পানি" },
              { v: "type", label: "নির্দিষ্ট ব্যবসার ধরন" },
              { v: "companies", label: "নির্দিষ্ট কোম্পানি (একাধিক বাছাই)" },
              { v: "status", label: "নির্দিষ্ট স্ট্যাটাস" },
            ].map((o) => (
              <label key={o.v} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="targetMode"
                  checked={targetMode === o.v}
                  onChange={() => setTargetMode(o.v as typeof targetMode)}
                />
                {o.label}
              </label>
            ))}
          </div>

          {targetMode === "type" && (
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="shop">দোকান (Shop)</option>
              <option value="warehouse">গুদাম (Warehouse)</option>
              <option value="vendor">পরিবেশক (Vendor)</option>
            </select>
          )}

          {targetMode === "status" && (
            <div className="mt-3 flex flex-wrap gap-3">
              {STATUSES.map((s) => (
                <label key={s.value} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={statuses.includes(s.value)}
                    onChange={(e) =>
                      setStatuses((prev) =>
                        e.target.checked ? [...prev, s.value] : prev.filter((x) => x !== s.value)
                      )
                    }
                  />
                  {s.label}
                </label>
              ))}
            </div>
          )}

          {targetMode === "companies" && (
            <div className="mt-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="কোম্পানি খুঁজুন..."
                className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                {filtered.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 border-b border-slate-50 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={companyIds.includes(c.id)}
                      onChange={(e) =>
                        setCompanyIds((prev) =>
                          e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                        )
                      }
                    />
                    <span className="flex-1 text-slate-800">{c.name}</span>
                    <span className="text-xs text-slate-400">{c.nikash_id}</span>
                  </label>
                ))}
                {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-400">পাওয়া যায়নি</p>}
              </div>
              {companyIds.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">{companyIds.length}টি কোম্পানি বাছাই করা হয়েছে</p>
              )}
            </div>
          )}

          <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-600">
            আনুমানিক {reach} টি কোম্পানির কাছে পৌঁছাবে
          </p>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {loading && <Spinner />}
        নোটিশ পাঠান
      </button>
    </form>
  );
}
