"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

// ম্যানুয়াল পেমেন্ট — কোম্পানি হাতে হাতে/বিকাশে টাকা দিলে অ্যাডমিন
// এখানে তুলে দেয়; ইনভয়েস তৈরি হয় ও মেয়াদ বাড়ে এক ক্লিকে।

type Company = { id: string; name: string; nikash_id: string; end_date: string | null };
type Plan = { id: string; name_bn: string; price: number; duration_days: number };

const METHODS = [
  { value: "bkash", label: "বিকাশ" },
  { value: "nagad", label: "নগদ" },
  { value: "rocket", label: "রকেট" },
  { value: "bank", label: "ব্যাংক" },
  { value: "cash", label: "ক্যাশ" },
  { value: "cheque", label: "চেক" },
];

export default function ManualPaymentForm({
  companies,
  plans,
}: {
  companies: Company[];
  plans: Plan[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [planId, setPlanId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bkash");
  const [trxId, setTrxId] = useState("");
  const [extendDays, setExtendDays] = useState("30");
  const [note, setNote] = useState("");
  const [makeInvoice, setMakeInvoice] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies.slice(0, 50);
    return companies
      .filter((c) => c.name.toLowerCase().includes(q) || c.nikash_id.toLowerCase().includes(q))
      .slice(0, 50);
  }, [companies, search]);

  const selected = companies.find((c) => c.id === companyId);

  function pickPlan(id: string) {
    setPlanId(id);
    const p = plans.find((x) => x.id === id);
    if (p) {
      setAmount(String(p.price));
      setExtendDays(String(p.duration_days));
    }
  }

  function reset() {
    setCompanyId("");
    setPlanId("");
    setAmount("");
    setTrxId("");
    setNote("");
    setExtendDays("30");
    setSearch("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/payments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          planId: planId || null,
          amount: Number(amount),
          method,
          trxId,
          extendDays: Number(extendDays || 0),
          note,
          makeInvoice,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "সেভ করা যায়নি");
      setDone(
        data.invoice_no
          ? `সফল! ইনভয়েস ${data.invoice_no}${data.new_end_date ? ` · নতুন মেয়াদ ${data.new_end_date}` : ""}`
          : "পেমেন্ট রেকর্ড হয়েছে"
      );
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেভ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {done && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{done}</span>
          <button onClick={() => setDone(null)} className="text-emerald-600 hover:text-emerald-900">
            ✕
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        + ম্যানুয়াল পেমেন্ট
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={submit}
            className="my-8 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-900">ম্যানুয়াল পেমেন্ট রেকর্ড</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">কোম্পানি *</label>
                {selected ? (
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selected.name}</p>
                      <p className="font-mono text-xs text-slate-500">
                        {selected.nikash_id}
                        {selected.end_date ? ` · মেয়াদ ${selected.end_date}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCompanyId("")}
                      className="text-xs font-semibold text-sky-600"
                    >
                      বদলান
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="নাম বা Nikash ID দিয়ে খুঁজুন"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                    />
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200">
                      {filtered.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCompanyId(c.id)}
                          className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
                        >
                          <span className="text-sm text-slate-800">{c.name}</span>
                          <span className="font-mono text-xs text-slate-400">{c.nikash_id}</span>
                        </button>
                      ))}
                      {filtered.length === 0 && (
                        <p className="px-3 py-4 text-center text-sm text-slate-400">কিছু পাওয়া যায়নি</p>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">প্ল্যান (ঐচ্ছিক)</label>
                <select
                  value={planId}
                  onChange={(e) => pickPlan(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">— প্ল্যান ছাড়া —</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name_bn} · ৳{p.price} · {p.duration_days} দিন
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">টাকা *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">মাধ্যম *</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  >
                    {METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">TrxID</label>
                  <input
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value)}
                    placeholder="8N7A2K9X"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">মেয়াদ বাড়বে (দিন)</label>
                  <input
                    type="number"
                    min="0"
                    max="3650"
                    value={extendDays}
                    onChange={(e) => setExtendDays(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">নোট</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="যেমন: অফিসে এসে ক্যাশ দিয়েছে"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={makeInvoice}
                  onChange={(e) => setMakeInvoice(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                ইনভয়েস তৈরি করুন (NK-INV-…)
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={busy || !companyId || !amount}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy && <Spinner />}
                সেভ করুন
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
