"use client";

import { useState } from "react";
import Image from "next/image";

type Step = "idle" | "setup" | "confirm" | "disable";

export function TwoFactorPanel({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<Step>("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
      setStep("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "সেটআপ শুরু করা যায়নি");
    } finally {
      setLoading(false);
    }
  }

  async function confirmSetup() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEnabled(true);
      setStep("idle");
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "নিশ্চিত করা যায়নি");
    } finally {
      setLoading(false);
    }
  }

  async function disable2fa() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEnabled(false);
      setStep("idle");
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "নিষ্ক্রিয় করা যায়নি");
    } finally {
      setLoading(false);
    }
  }

  if (enabled && step !== "disable") {
    return (
      <div>
        <p className="mb-3 inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
          চালু আছে
        </p>
        <button
          onClick={() => setStep("disable")}
          className="block rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          নিষ্ক্রিয় করুন
        </button>
      </div>
    );
  }

  if (step === "disable") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">নিষ্ক্রিয় করতে বর্তমান ৬-সংখ্যার কোড দিন:</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-slate-900"
          placeholder="000000"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={disable2fa}
            disabled={loading || code.length !== 6}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            নিষ্ক্রিয় করুন
          </button>
          <button
            onClick={() => {
              setStep("idle");
              setCode("");
              setError(null);
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500"
          >
            বাতিল
          </button>
        </div>
      </div>
    );
  }

  if (step === "confirm" && qrDataUrl && secret) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Google Authenticator বা Authy দিয়ে QR কোড স্ক্যান করুন:</p>
        <Image src={qrDataUrl} alt="2FA QR code" width={180} height={180} className="rounded-lg border border-slate-200" unoptimized />
        <p className="text-xs text-slate-400">
          স্ক্যান করতে না পারলে ম্যানুয়ালি এই কী লিখুন: <span className="font-mono">{secret}</span>
        </p>
        <p className="text-sm text-slate-600">অ্যাপে দেখানো ৬-সংখ্যার কোড দিয়ে নিশ্চিত করুন:</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-slate-900"
          placeholder="000000"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={confirmSetup}
            disabled={loading || code.length !== 6}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            নিশ্চিত করুন
          </button>
          <button
            onClick={() => {
              setStep("idle");
              setCode("");
              setError(null);
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500"
          >
            বাতিল
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
        নিষ্ক্রিয় আছে
      </p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <button
        onClick={startSetup}
        disabled={loading}
        className="block rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "..." : "সক্রিয় করুন"}
      </button>
    </div>
  );
}
