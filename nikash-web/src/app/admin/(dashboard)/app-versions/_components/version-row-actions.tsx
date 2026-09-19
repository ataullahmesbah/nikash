"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

// প্রতিটি ভার্সনের সারিতে সম্পাদনা ও মুছে ফেলা।
//
// ভুল লিংক বা ভুল সাইজ দিয়ে ফেললে আগে কিছুই করার ছিল না — একই বিল্ড
// নম্বরে নতুন সারি বসানো যায় না (unique index), তাই আটকে যেত।

export type VersionRow = {
  id: string;
  version: string;
  build_number: number;
  apk_url: string;
  file_size_mb: number | null;
  release_notes: string | null;
  min_supported: string | null;
  force_update: boolean;
};

const labelCls = "mb-1 block text-xs font-medium text-slate-600";
const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

export default function VersionRowActions({ version: v }: { version: VersionRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    version: v.version,
    buildNumber: String(v.build_number),
    apkUrl: v.apk_url,
    fileSizeMb: v.file_size_mb === null ? "" : String(v.file_size_mb),
    minSupported: v.min_supported ?? "",
    releaseNotes: v.release_notes ?? "",
    forceUpdate: v.force_update,
  });

  async function save() {
    setError(null);
    setBusy("save");
    try {
      const res = await fetch("/api/admin/app-versions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "সেভ করা যায়নি");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "সেভ করা যায়নি");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (
      !confirm(
        `ভার্সন ${v.version} (বিল্ড ${v.build_number}) মুছে ফেলবেন?\n\n` +
          `অ্যাপ আর এই ভার্সনের খবর পাবে না। এটি ফেরানো যাবে না।`
      )
    ) {
      return;
    }
    setError(null);
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/app-versions?id=${v.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "মোছা যায়নি");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "মোছা যায়নি");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={() => setEditing(true)}
          disabled={busy !== null}
          title="সম্পাদনা"
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          ✏️
        </button>
        <button
          onClick={remove}
          disabled={busy !== null}
          title="মুছুন"
          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          {busy === "delete" ? <Spinner /> : "🗑️"}
        </button>
      </div>

      {error && !editing && <p className="mt-1 text-right text-xs text-red-600">{error}</p>}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-xl rounded-2xl border border-slate-200 bg-white text-left shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-900">ভার্সন সম্পাদনা</h2>
              <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>ভার্সন *</label>
                  <input
                    className={inputCls}
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>বিল্ড নম্বর *</label>
                  <input
                    type="number"
                    min="1"
                    className={inputCls}
                    value={form.buildNumber}
                    onChange={(e) => setForm({ ...form, buildNumber: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>APK ডাউনলোড লিংক *</label>
                <input
                  className={inputCls}
                  value={form.apkUrl}
                  onChange={(e) => setForm({ ...form, apkUrl: e.target.value })}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  লিংক বদলালে অ্যাপের ডাউনলোড বোতামও নতুন ফাইলে যাবে
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>ফাইল সাইজ (MB)</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.fileSizeMb}
                    onChange={(e) => setForm({ ...form, fileSizeMb: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>সর্বনিম্ন সমর্থিত ভার্সন</label>
                  <input
                    className={inputCls}
                    value={form.minSupported}
                    onChange={(e) => setForm({ ...form, minSupported: e.target.value })}
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <input
                  type="checkbox"
                  checked={form.forceUpdate}
                  onChange={(e) => setForm({ ...form, forceUpdate: e.target.checked })}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="text-sm font-semibold text-amber-900">
                    জরুরি আপডেট (সবাইকে আটকে দিন)
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-amber-700">
                    চালু করলে পুরনো ভার্সনের সব ব্যবহারকারীর অ্যাপ আটকে যাবে।
                  </span>
                </span>
              </label>

              <div>
                <label className={labelCls}>এই সংস্করণে কী বদলেছে</label>
                <textarea
                  rows={3}
                  className={inputCls}
                  value={form.releaseNotes}
                  onChange={(e) => setForm({ ...form, releaseNotes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                onClick={() => setEditing(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                বাতিল
              </button>
              <button
                onClick={save}
                disabled={busy !== null || !form.version.trim() || !form.apkUrl.trim()}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "save" && <Spinner />}
                সেভ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
