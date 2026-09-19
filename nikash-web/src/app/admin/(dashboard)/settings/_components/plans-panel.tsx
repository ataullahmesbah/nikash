"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Spinner, Table } from "@/components/ui";

// প্ল্যান ও দাম — এখান থেকেই সাবস্ক্রিপশনের প্যাকেজ তৈরি/সম্পাদনা হয়।

export type Plan = {
  id: string;
  code: string;
  name_bn: string;
  name_en: string;
  business_type: string | null;
  duration_days: number;
  price: number;
  max_users: number;
  max_devices: number;
  is_active: boolean;
};

const TYPE_BN: Record<string, string> = {
  vendor: "ভেন্ডর",
  warehouse: "গুদাম",
  shop: "দোকান",
};

const empty: Plan = {
  id: "",
  code: "",
  name_bn: "",
  name_en: "",
  business_type: null,
  duration_days: 30,
  price: 0,
  max_users: 5,
  max_devices: 3,
  is_active: true,
};

const input =
  "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400";
const label = "mb-1.5 block text-sm font-medium text-slate-700";

export default function PlansPanel({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editing, id: editing.id || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "সেভ করা যায়নি");
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেভ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  async function remove(plan: Plan) {
    if (!confirm(`"${plan.name_bn}" প্ল্যানটি মুছবেন? কোনো কোম্পানি এটা ব্যবহার করলে শুধু নিষ্ক্রিয় হবে।`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/plans?id=${plan.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.result === "deactivated") {
        alert(`${data.companies} টি কোম্পানি এই প্ল্যানে আছে, তাই মুছে না ফেলে নিষ্ক্রিয় করা হয়েছে।`);
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "ব্যর্থ হয়েছে");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          মোট {plans.length} টি প্ল্যান · সক্রিয় {plans.filter((p) => p.is_active).length} টি
        </p>
        <button
          onClick={() => {
            setEditing({ ...empty });
            setError(null);
          }}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          + নতুন প্ল্যান
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <Table head={["প্ল্যান", "ধরন", "মেয়াদ", "দাম", "লিমিট", "স্ট্যাটাস", ""]}>
          {plans.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/60">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">{p.name_bn}</p>
                <p className="font-mono text-xs text-slate-400">{p.code}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {p.business_type ? TYPE_BN[p.business_type] ?? p.business_type : "সব"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{p.duration_days} দিন</td>
              <td className="px-4 py-3 font-semibold text-slate-900">
                ৳{Number(p.price).toLocaleString("en-BD")}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                {p.max_users} ইউজার · {p.max_devices} ডিভাইস
              </td>
              <td className="px-4 py-3">
                <Badge label={p.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"} tone={p.is_active ? "success" : "default"} />
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditing({ ...p });
                      setError(null);
                    }}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    সম্পাদনা
                  </button>
                  <button
                    onClick={() => remove(p)}
                    disabled={busy}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                  >
                    মুছুন
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {plans.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                কোনো প্ল্যান নেই
              </td>
            </tr>
          )}
        </Table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={save} className="my-8 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-900">{editing.id ? "প্ল্যান সম্পাদনা" : "নতুন প্ল্যান"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>কোড *</label>
                  <input
                    required
                    disabled={!!editing.id}
                    className={`${input} font-mono disabled:bg-slate-50 disabled:text-slate-400`}
                    value={editing.code}
                    onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                    placeholder="monthly_shop"
                  />
                </div>
                <div>
                  <label className={label}>ব্যবসার ধরন</label>
                  <select
                    className={input}
                    value={editing.business_type ?? ""}
                    onChange={(e) => setEditing({ ...editing, business_type: e.target.value || null })}
                  >
                    <option value="">সব ধরনের জন্য</option>
                    <option value="vendor">ভেন্ডর</option>
                    <option value="warehouse">গুদাম</option>
                    <option value="shop">দোকান</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>বাংলা নাম *</label>
                  <input
                    required
                    className={input}
                    value={editing.name_bn}
                    onChange={(e) => setEditing({ ...editing, name_bn: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>ইংরেজি নাম *</label>
                  <input
                    required
                    className={input}
                    value={editing.name_en}
                    onChange={(e) => setEditing({ ...editing, name_en: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>দাম (৳) *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    className={input}
                    value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className={label}>মেয়াদ (দিন) *</label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    required
                    className={input}
                    value={editing.duration_days}
                    onChange={(e) => setEditing({ ...editing, duration_days: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>সর্বোচ্চ ইউজার</label>
                  <input
                    type="number"
                    min={1}
                    className={input}
                    value={editing.max_users}
                    onChange={(e) => setEditing({ ...editing, max_users: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className={label}>সর্বোচ্চ ডিভাইস</label>
                  <input
                    type="number"
                    min={1}
                    className={input}
                    value={editing.max_devices}
                    onChange={(e) => setEditing({ ...editing, max_devices: Number(e.target.value) })}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                সক্রিয় (নতুন কোম্পানি এই প্ল্যান নিতে পারবে)
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy && <Spinner />} সেভ করুন
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
