"use client";

import { useState } from "react";
import Link from "next/link";

const BUSINESS_TYPES = [
  { value: "shop", label: "দোকান", hint: "খুচরা বিক্রেতা, POS" },
  { value: "warehouse", label: "গুদাম", hint: "পরিবেশক, গাড়ি/রুট" },
  { value: "vendor", label: "সরবরাহকারী", hint: "উৎপাদক/মিল, বড় লটে বিক্রি" },
] as const;

export default function SignupPage() {
  const [businessType, setBusinessType] = useState<(typeof BUSINESS_TYPES)[number]["value"]>("shop");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, businessType, ownerName, phone, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "সাইনআপ ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto min-h-screen max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">অ্যাকাউন্ট তৈরি হয়েছে! 🎉</h1>
        <p className="mt-3 text-slate-600">
          এখন Nikash অ্যাপ ডাউনলোড করে আপনার ফোন নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন।
        </p>
        <Link
          href="/download"
          className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white"
        >
          অ্যাপ ডাউনলোড করুন
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold text-slate-900">নতুন অ্যাকাউন্ট</h1>
      <p className="mt-1 text-sm text-slate-500">১৫ দিনের ফ্রি ট্রায়াল — কোনো টাকা লাগবে না</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">ব্যবসার ধরন</label>
          <div className="grid grid-cols-3 gap-2">
            {BUSINESS_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setBusinessType(t.value)}
                className={`rounded-xl border p-3 text-center text-sm ${
                  businessType === t.value
                    ? "border-slate-900 bg-slate-50 font-semibold text-slate-900"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <input
          required
          placeholder="ব্যবসার নাম"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="আপনার নাম"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="ফোন নম্বর (01XXXXXXXXX)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          required
          type="password"
          placeholder="পাসওয়ার্ড (অন্তত ৮ অক্ষর)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "তৈরি হচ্ছে..." : "ট্রায়াল শুরু করুন"}
        </button>
      </form>
    </main>
  );
}
