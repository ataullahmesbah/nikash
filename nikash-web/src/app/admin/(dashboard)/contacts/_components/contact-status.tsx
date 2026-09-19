"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [
  { value: "new", label: "নতুন" },
  { value: "read", label: "পড়া হয়েছে" },
  { value: "replied", label: "উত্তর দেওয়া" },
  { value: "closed", label: "বন্ধ" },
];

export default function ContactStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(status);

  async function change(next: string) {
    const prev = value;
    setValue(next);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
    } catch (e) {
      setValue(prev);
      alert(e instanceof Error ? e.message : "বদলানো যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      value={value}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 disabled:opacity-50"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
