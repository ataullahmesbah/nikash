"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui";

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500";
const label = "mb-1.5 block text-sm font-medium text-slate-700";

export default function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
    website: "", // হানিপট — মানুষ দেখবে না
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "পাঠানো যায়নি");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "পাঠানো যায়নি");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center">
        <span className="text-4xl">✅</span>
        <p className="mt-4 text-lg font-bold text-emerald-900">বার্তা পৌঁছে গেছে</p>
        <p className="mt-2 text-sm text-emerald-800">
          আমরা সাধারণত এক কর্মদিবসের মধ্যে উত্তর দিই। জরুরি হলে সরাসরি ফোন করুন।
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-8">
      <h2 className="text-xl font-bold text-slate-900">বার্তা পাঠান</h2>
      <p className="mt-1.5 text-sm text-slate-500">ফর্মটি পূরণ করুন — আমরা যোগাযোগ করব।</p>

      {error && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-4">
        <div>
          <label className={label} htmlFor="c-name">
            আপনার নাম *
          </label>
          <input
            id="c-name"
            required
            maxLength={80}
            className={input}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="c-phone">
              ফোন নম্বর
            </label>
            <input
              id="c-phone"
              maxLength={25}
              inputMode="tel"
              className={input}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="01XXXXXXXXX"
            />
          </div>
          <div>
            <label className={label} htmlFor="c-email">
              ইমেইল
            </label>
            <input
              id="c-email"
              type="email"
              maxLength={120}
              className={input}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-slate-400">ফোন বা ইমেইল — অন্তত একটি দিন।</p>

        <div>
          <label className={label} htmlFor="c-subject">
            বিষয়
          </label>
          <select
            id="c-subject"
            className={input}
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          >
            <option value="">— বেছে নিন —</option>
            <option value="ডেমো চাই">ডেমো চাই</option>
            <option value="দাম ও প্ল্যান">দাম ও প্ল্যান</option>
            <option value="ইনস্টলে সমস্যা">ইনস্টলে সমস্যা</option>
            <option value="অ্যাপে সমস্যা">অ্যাপে সমস্যা</option>
            <option value="পেমেন্ট">পেমেন্ট</option>
            <option value="অন্যান্য">অন্যান্য</option>
          </select>
        </div>

        <div>
          <label className={label} htmlFor="c-message">
            বার্তা *
          </label>
          <textarea
            id="c-message"
            required
            rows={5}
            maxLength={2000}
            className={input}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="আপনার ব্যবসা ও প্রয়োজন সম্পর্কে একটু লিখুন…"
          />
        </div>

        {/* হানিপট — স্ক্রিন রিডার ও চোখ, দুই থেকেই লুকানো */}
        <div aria-hidden className="hidden">
          <label htmlFor="c-website">Website</label>
          <input
            id="c-website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy && <Spinner />} বার্তা পাঠান
      </button>
    </form>
  );
}
