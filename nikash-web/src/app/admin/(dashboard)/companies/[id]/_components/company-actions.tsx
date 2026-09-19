"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

const STATUS_OPTIONS = [
  { value: "active", label: "সক্রিয়", desc: "সব ফিচার চালু থাকবে" },
  { value: "readonly", label: "শুধু-দেখা", desc: "দেখতে পারবে, নতুন এন্ট্রি দিতে পারবে না" },
  { value: "blocked", label: "ব্লক", desc: "লগইনই করতে পারবে না" },
  { value: "grace", label: "গ্রেস পিরিয়ড", desc: "মেয়াদ শেষ, কিছুদিন ছাড় দেওয়া হচ্ছে" },
];

export function SubscriptionPanel({
  companyId,
  currentEnd,
}: {
  companyId: string;
  currentEnd: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"extend" | "reduce" | "date">("extend");
  const [days, setDays] = useState("30");
  const [newDate, setNewDate] = useState(currentEnd ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // পূর্বরূপ — সেভ করার আগেই নতুন মেয়াদ দেখা যাবে
  const preview = (() => {
    if (mode === "date") return newDate || "—";
    const base = currentEnd && new Date(currentEnd) > new Date() ? new Date(currentEnd) : new Date();
    const n = Number(days);
    if (!Number.isFinite(n)) return "—";
    const t = new Date(base);
    t.setDate(t.getDate() + (mode === "reduce" ? -Math.abs(n) : Math.abs(n)));
    return t.toISOString().slice(0, 10);
  })();

  async function submit() {
    setError(null);
    setOk(null);
    setLoading(true);
    const res = await fetch(`/api/admin/companies/${companyId}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, days, newDate, reason }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "পরিবর্তন করা যায়নি");
      return;
    }
    setOk(`নতুন মেয়াদ: ${data.end_date}`);
    setReason("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-800">⚡ মেয়াদ পরিবর্তন</p>

      <div className="mb-3 flex flex-wrap gap-2">
        {[
          { v: "extend", label: "দিন যোগ" },
          { v: "reduce", label: "দিন কমান" },
          { v: "date", label: "নির্দিষ্ট তারিখ" },
        ].map((o) => (
          <button
            key={o.v}
            onClick={() => setMode(o.v as typeof mode)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              mode === o.v ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {mode === "date" ? (
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {[7, 15, 30, 90, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDays(String(d))}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                days === String(d) ? "border-slate-900 bg-white font-semibold" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {d} দিন
            </button>
          ))}
          <input
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
      )}

      <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-600">
        বর্তমান মেয়াদ: <strong>{currentEnd ?? "—"}</strong> → নতুন:{" "}
        <strong className={mode === "reduce" ? "text-amber-700" : "text-emerald-700"}>{preview}</strong>
      </p>

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="কারণ লিখুন (আবশ্যক) — যেমন: বিকাশে ৳১০০০ পেমেন্ট"
        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {ok && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}

      <button
        onClick={submit}
        disabled={loading || !reason.trim()}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading && <Spinner />}
        পরিবর্তন করুন
      </button>
    </div>
  );
}

export function StatusPanel({
  companyId,
  currentStatus,
}: {
  companyId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = STATUS_OPTIONS.find((o) => o.value === status);

  async function submit() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/admin/companies/${companyId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "পরিবর্তন করা যায়নি");
      return;
    }
    setReason("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-800">⚙️ স্ট্যাটাস পরিবর্তন</p>

      <div className="space-y-2">
        {STATUS_OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
              status === o.value ? "border-slate-900 bg-white" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="status"
              className="mt-1"
              checked={status === o.value}
              onChange={() => setStatus(o.value)}
            />
            <div>
              <p className="text-sm font-medium text-slate-900">{o.label}</p>
              <p className="text-xs text-slate-500">{o.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {(status === "blocked" || status === "readonly") && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="কোম্পানিকে যে কারণ দেখানো হবে"
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      )}

      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        onClick={submit}
        disabled={loading || status === currentStatus}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading && <Spinner />}
        {selected ? `"${selected.label}" করুন` : "পরিবর্তন করুন"}
      </button>
    </div>
  );
}
