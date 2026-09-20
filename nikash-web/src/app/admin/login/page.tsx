"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// অ্যাডমিন লগইন — দুই ধাপ: পাসওয়ার্ড, তারপর (2FA চালু থাকলে) কোড।
//
// একটাই পাতা, কিন্তু দুটো আলাদা কার্ড — pendingToken এলেই কোডের ধাপে যায়।

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "লগইন ব্যর্থ হয়েছে");
        return;
      }
      if (data.require2fa) {
        setPendingToken(data.pendingToken);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("সার্ভারে পৌঁছানো যায়নি — ইন্টারনেট দেখুন");
    } finally {
      setLoading(false);
    }
  }

  async function verify(codeValue: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, code: codeValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "যাচাই ব্যর্থ হয়েছে");
        setCode("");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("সার্ভারে পৌঁছানো যায়নি");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      {/* পটভূমির নরম আলো — ছবি নয়, তাই কিছু লোড হয় না */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-0 h-[24rem] w-[24rem] rounded-full bg-sky-500/10 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        {/* লোগো */}
        <div className="mb-7 flex flex-col items-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold text-white shadow-lg shadow-emerald-600/30">
            নি
          </span>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-white">নিকাশ অ্যাডমিন</h1>
          <p className="mt-1 text-sm text-slate-400">
            {pendingToken ? "নিরাপত্তা যাচাই" : "প্ল্যাটফর্ম নিয়ন্ত্রণ প্যানেল"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/95 p-6 shadow-2xl backdrop-blur sm:p-7">
          {error && (
            <p className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
              <span aria-hidden>⚠️</span>
              <span>{error}</span>
            </p>
          )}

          {pendingToken ? (
            <TwoFactorStep
              code={code}
              setCode={setCode}
              loading={loading}
              onVerify={verify}
              onBack={() => {
                setPendingToken(null);
                setCode("");
                setError(null);
              }}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  ইমেইল
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@nikash.app"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  পাসওয়ার্ড
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
                    title={showPassword ? "লুকান" : "দেখুন"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && <Spinner />}
                {loading ? "যাচাই করা হচ্ছে…" : "লগইন করুন"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          শুধু অনুমোদিত কর্মীদের জন্য · সব কার্যক্রম রেকর্ড হয়
        </p>
      </div>
    </main>
  );
}

/* ----------------------------- ২FA ধাপ ----------------------------- */

function TwoFactorStep({
  code,
  setCode,
  loading,
  onVerify,
  onBack,
}: {
  code: string;
  setCode: (v: string) => void;
  loading: boolean;
  onVerify: (code: string) => void;
  onBack: () => void;
}) {
  // ছয়টা আলাদা ঘর দেখতে ভালো লাগে, কিন্তু কপি-পেস্ট আর অটোফিল ভেঙে যায়।
  // তাই একটাই ইনপুট — শুধু অক্ষরগুলো ফাঁক ফাঁক করে বড় করে দেখাই।
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ছয় অঙ্ক পূর্ণ হলেই নিজে থেকে যাচাই — বোতাম চাপার দরকার নেই
  useEffect(() => {
    if (code.length === 6 && !loading) onVerify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div>
      <div className="mb-5 flex items-start gap-3 rounded-xl bg-slate-50 p-3.5">
        <span className="text-xl" aria-hidden>
          🔐
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">দুই-ধাপ যাচাইকরণ</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            আপনার অথেনটিকেটর অ্যাপে (Google Authenticator / Authy) যে ৬ সংখ্যার কোডটি দেখাচ্ছে সেটি দিন।
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onVerify(code);
        }}
      >
        <label htmlFor="code" className="mb-2 block text-center text-xs font-medium text-slate-500">
          ৬ সংখ্যার কোড
        </label>

        <div className="relative">
          <input
            id="code"
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="······"
            maxLength={6}
            disabled={loading}
            className="w-full rounded-xl border-2 border-slate-300 bg-white py-4 text-center font-mono text-3xl tracking-[0.5em] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 disabled:opacity-60"
          />
          {/* কয়টা অঙ্ক হলো তার ছোট ইঙ্গিত */}
          <div className="mt-2 flex justify-center gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className={`h-1 w-6 rounded-full transition ${
                  i < code.length ? "bg-emerald-500" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Spinner />}
          {loading ? "যাচাই করা হচ্ছে…" : "যাচাই করুন"}
        </button>
      </form>

      <button
        onClick={onBack}
        disabled={loading}
        className="mt-4 w-full text-center text-xs font-medium text-slate-500 transition hover:text-slate-800 disabled:opacity-50"
      >
        ← অন্য অ্যাকাউন্টে লগইন করুন
      </button>
    </div>
  );
}

/* ----------------------------- ছোট অংশ ----------------------------- */

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    // চোখ কাটা — এখন পাসওয়ার্ড দেখা যাচ্ছে, চাপলে লুকাবে
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
