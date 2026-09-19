"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

// নোটিশের প্রতি সারিতে তিনটে কাজ: চালু/বন্ধ · সম্পাদনা · মুছে ফেলা।
//
// ভুল নোটিশ পাঠিয়ে ফেললে সবচেয়ে দ্রুত সমাধান "বন্ধ" — এক ক্লিকে অ্যাপ
// থেকে উধাও, ডেটা থেকে যায়। লেখা ঠিক করতে "সম্পাদনা", আর একেবারে
// সরাতে "মুছুন" (soft delete, ইতিহাসে থেকে যায়)।

export type NoticeRow = {
    id: string;
    title_bn: string;
    body_bn: string | null;
    severity: string;
    show_as: string;
    end_at: string | null;
    is_active: boolean;
};

const SEVERITIES = [
    { value: "info", label: "তথ্য" },
    { value: "warning", label: "সতর্কতা" },
    { value: "critical", label: "জরুরি" },
];

/** "2026-09-19T18:00:00Z" → "2026-09-19T18:00" (datetime-local যা চায়) */
function toLocalInput(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NoticeRowActions({ notice }: { notice: NoticeRow }) {
    const router = useRouter();
    const [busy, setBusy] = useState<"toggle" | "save" | "delete" | null>(null);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [titleBn, setTitleBn] = useState(notice.title_bn);
    const [bodyBn, setBodyBn] = useState(notice.body_bn ?? "");
    const [severity, setSeverity] = useState(notice.severity);
    const [showAs, setShowAs] = useState(notice.show_as);
    const [endAt, setEndAt] = useState(toLocalInput(notice.end_at));

    async function send(payload: Record<string, unknown>, which: "toggle" | "save") {
        setError(null);
        setBusy(which);
        try {
            const res = await fetch("/api/admin/notices", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: notice.id, ...payload }),
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
        if (!confirm(`"${notice.title_bn}" নোটিশটি মুছে ফেলবেন?\n\nঅ্যাপ থেকে সাথে সাথেই সরে যাবে।`)) return;
        setError(null);
        setBusy("delete");
        try {
            const res = await fetch(`/api/admin/notices?id=${notice.id}`, { method: "DELETE" });
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
                    onClick={() => send({ isActive: !notice.is_active }, "toggle")}
                    disabled={busy !== null}
                    title={notice.is_active ? "বন্ধ করুন" : "চালু করুন"}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${notice.is_active
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                >
                    {busy === "toggle" ? <Spinner /> : notice.is_active ? "চালু" : "বন্ধ"}
                </button>

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
                    <div className="my-8 w-full max-w-lg rounded-2xl border border-slate-200 bg-white text-left shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <h2 className="font-bold text-slate-900">নোটিশ সম্পাদনা</h2>
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

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">শিরোনাম *</label>
                                <input
                                    value={titleBn}
                                    onChange={(e) => setTitleBn(e.target.value)}
                                    maxLength={150}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">বার্তা</label>
                                <textarea
                                    value={bodyBn}
                                    onChange={(e) => setBodyBn(e.target.value)}
                                    rows={4}
                                    maxLength={2000}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700">গুরুত্ব</label>
                                    <select
                                        value={severity}
                                        onChange={(e) => setSeverity(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                                    >
                                        {SEVERITIES.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-slate-700">কীভাবে দেখাবে</label>
                                    <select
                                        value={showAs}
                                        onChange={(e) => setShowAs(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                                    >
                                        <option value="banner">ব্যানার (উপরে)</option>
                                        <option value="popup">পপআপ</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                                    কবে পর্যন্ত দেখাবে <span className="font-normal text-slate-400">(খালি = চিরকাল)</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={endAt}
                                    onChange={(e) => setEndAt(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                                />
                            </div>

                            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                ℹ️ কাদের কাছে গেছে সেটা বদলানো যায় না — নোটিফিকেশন আগেই পাঠানো হয়ে গেছে।
                                ভুল কোম্পানিতে গিয়ে থাকলে এটা মুছে নতুন করে পাঠান।
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                            <button
                                onClick={() => setEditing(false)}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                            >
                                বাতিল
                            </button>
                            <button
                                onClick={() =>
                                    send(
                                        {
                                            titleBn,
                                            bodyBn,
                                            severity,
                                            showAs,
                                            endAt: endAt ? new Date(endAt).toISOString() : "",
                                        },
                                        "save"
                                    )
                                }
                                disabled={busy !== null || titleBn.trim().length < 2}
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
