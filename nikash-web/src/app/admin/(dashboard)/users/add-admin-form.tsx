"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

export default function AddAdminForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("support_admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "যোগ করা যায়নি");
      return;
    }
    setOpen(false);
    setName("");
    setEmail("");
    setPassword("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        + নতুন অ্যাডমিন
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-slate-900">নতুন অ্যাডমিন</h2>

        <div className="space-y-3">
          <Field label="নাম" value={name} onChange={setName} required />
          <Field label="ইমেইল" value={email} onChange={setEmail} type="email" required />
          <Field label="পাসওয়ার্ড (৮+ অক্ষর)" value={password} onChange={setPassword} type="password" required />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">রোল</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="support_admin">সাপোর্ট অ্যাডমিন</option>
              <option value="super_admin">সুপার অ্যাডমিন</option>
            </select>
          </div>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600">
            বাতিল
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading && <Spinner />}
            যোগ করুন
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
      />
    </div>
  );
}
