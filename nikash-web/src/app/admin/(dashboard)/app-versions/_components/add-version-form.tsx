"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddVersionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [buildNumber, setBuildNumber] = useState("");
  const [apkUrl, setApkUrl] = useState("");
  const [fileSizeMb, setFileSizeMb] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [forceUpdate, setForceUpdate] = useState(false);
  const [minSupported, setMinSupported] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/app-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version, buildNumber, apkUrl, fileSizeMb, releaseNotes, forceUpdate, minSupported,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVersion("");
      setBuildNumber("");
      setApkUrl("");
      setFileSizeMb("");
      setReleaseNotes("");
      setForceUpdate(false);
      setMinSupported("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
      >
        + নতুন ভার্সন প্রকাশ করুন
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">ভার্সন *</label>
          <input
            required
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.1.0"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            app.json-এ যেটা লিখেছেন, হুবহু সেটাই
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">বিল্ড নম্বর *</label>
          <input
            required
            type="number"
            min="1"
            value={buildNumber}
            onChange={(e) => setBuildNumber(e.target.value)}
            placeholder="2"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            প্রতিবার ১ করে বাড়ান — সবচেয়ে বড়টাই &ldquo;নতুন&rdquo; ধরা হয়
          </p>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-slate-500">APK ডাউনলোড লিংক *</label>
          <input
            required
            value={apkUrl}
            onChange={(e) => setApkUrl(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="https://expo.dev/artifacts/eas/....apk"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            EAS বিল্ড শেষে যে লিংকটা দেয়, অথবা GitHub Releases-এর লিংক
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">ফাইল সাইজ (MB)</label>
          <input
            type="number"
            value={fileSizeMb}
            onChange={(e) => setFileSizeMb(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">
            সর্বনিম্ন সমর্থিত ভার্সন
          </label>
          <input
            value={minSupported}
            onChange={(e) => setMinSupported(e.target.value)}
            placeholder="1.0.0"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            এর চেয়ে পুরনো ভার্সনের অ্যাপ আটকে যাবে। খালি রাখলে কেউ আটকাবে না।
          </p>
        </div>

        <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <label htmlFor="forceUpdate" className="flex items-start gap-2.5">
            <input
              id="forceUpdate"
              type="checkbox"
              checked={forceUpdate}
              onChange={(e) => setForceUpdate(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="text-sm font-semibold text-amber-900">
                জরুরি আপডেট (সবাইকে আটকে দিন)
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-amber-700">
                চালু করলে পুরনো ভার্সনের সব ব্যবহারকারীর অ্যাপ আটকে যাবে — আপডেট
                না করে তারা কিছুই করতে পারবে না। শুধু হিসাব ভুল হওয়ার মতো
                গুরুতর বাগ হলে ব্যবহার করুন।
              </span>
            </span>
          </label>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-slate-500">এই সংস্করণে কী বদলেছে</label>
          <textarea
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            rows={3}
            placeholder="• বাকির হিসাবে ভুল সংখ্যা ঠিক করা হয়েছে&#10;• ক্রয় সম্পাদনা এখন কাজ করে"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            এই লেখাটাই ব্যবহারকারী অ্যাপে দেখবে — দোকানির ভাষায় লিখুন
          </p>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          প্রকাশ করুন
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500"
        >
          বাতিল
        </button>
      </div>
    </form>
  );
}
