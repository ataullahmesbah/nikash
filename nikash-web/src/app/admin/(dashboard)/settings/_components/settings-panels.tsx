"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

// সেটিংসের ফর্মগুলো — সবগুলোই একই সেভ-প্যাটার্ন: বদলান → সেভ → টোস্ট।

const input =
  "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400";
const label = "mb-1.5 block text-sm font-medium text-slate-700";
const btn =
  "flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50";

function useSave() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(fn: () => Promise<Response>, okText = "সেভ হয়েছে") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fn();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "সেভ করা যায়নি");
      setMsg({ ok: true, text: okText });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "সেভ করা যায়নি" });
    } finally {
      setBusy(false);
    }
  }

  return { busy, msg, run, setMsg };
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm ${
        msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      {msg.text}
    </p>
  );
}

function putSetting(key: string, value: unknown) {
  return fetch("/api/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

/* ------------------------------ সাপোর্ট তথ্য ------------------------------ */

export function SupportPanel({ value }: { value: Record<string, string> }) {
  const { busy, msg, run } = useSave();
  const [form, setForm] = useState({
    phone: value.phone ?? "",
    whatsapp: value.whatsapp ?? "",
    email: value.email ?? "",
    hours: value.hours ?? "",
    address: value.address ?? "",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => putSetting("public.support", form));
      }}
      className="space-y-4"
    >
      <p className="text-sm text-slate-500">
        এই তথ্যগুলো অ্যাপের <strong>আরও → হেল্প লাইন</strong> পেজে ও ওয়েবসাইটের যোগাযোগ পেজে দেখা যাবে।
      </p>
      <Msg msg={msg} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>সাপোর্ট নম্বর</label>
          <input
            className={input}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+8801XXXXXXXXX"
          />
        </div>
        <div>
          <label className={label}>হোয়াটসঅ্যাপ</label>
          <input
            className={input}
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            placeholder="+8801XXXXXXXXX"
          />
        </div>
        <div>
          <label className={label}>ইমেইল</label>
          <input
            type="email"
            className={input}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className={label}>সাপোর্ট সময়</label>
          <input
            className={input}
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
            placeholder="সকাল ৯টা – রাত ৯টা"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>ঠিকানা</label>
          <input
            className={input}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
      </div>

      <button type="submit" disabled={busy} className={btn}>
        {busy && <Spinner />} সেভ করুন
      </button>
    </form>
  );
}

/* ---------------------------- পেমেন্ট নম্বর ---------------------------- */

export function PaymentNumbersPanel({ value }: { value: Record<string, string> }) {
  const { busy, msg, run } = useSave();
  const [form, setForm] = useState({
    bkash: value.bkash ?? "",
    nagad: value.nagad ?? "",
    rocket: value.rocket ?? "",
    bank: value.bank ?? "",
    note: value.note ?? "",
  });

  const fields = [
    { key: "bkash" as const, label: "বিকাশ (পার্সোনাল/মার্চেন্ট)" },
    { key: "nagad" as const, label: "নগদ" },
    { key: "rocket" as const, label: "রকেট" },
    { key: "bank" as const, label: "ব্যাংক অ্যাকাউন্ট" },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => putSetting("public.payment_numbers", form));
      }}
      className="space-y-4"
    >
      <p className="text-sm text-slate-500">
        কোম্পানি অ্যাপ থেকে সাবস্ক্রিপশন রিনিউ করার সময় এই নম্বরগুলো দেখবে।
      </p>
      <Msg msg={msg} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key}>
            <label className={label}>{f.label}</label>
            <input
              className={input}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          </div>
        ))}
        <div className="sm:col-span-2">
          <label className={label}>নির্দেশনা (ঐচ্ছিক)</label>
          <input
            className={input}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Send Money করে TrxID অ্যাপে দিন"
          />
        </div>
      </div>

      <button type="submit" disabled={busy} className={btn}>
        {busy && <Spinner />} সেভ করুন
      </button>
    </form>
  );
}

/* ------------------------------ অ্যাপ লিংক ------------------------------ */

export function AppLinksPanel({ value }: { value: Record<string, string> }) {
  const { busy, msg, run } = useSave();
  const [form, setForm] = useState({
    apk_url: value.apk_url ?? "",
    play_store: value.play_store ?? "",
    manual_url: value.manual_url ?? "",
    version: value.version ?? "",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => putSetting("public.app_links", form));
      }}
      className="space-y-4"
    >
      <p className="text-sm text-slate-500">
        ডাউনলোড পেজের APK লিংক, QR কোড ও ইউজার ম্যানুয়াল এখান থেকে নিয়ন্ত্রণ হয়।
      </p>
      <Msg msg={msg} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>APK ডাউনলোড লিংক</label>
          <input
            className={input}
            value={form.apk_url}
            onChange={(e) => setForm({ ...form, apk_url: e.target.value })}
            placeholder="https://cdn.nikash.app/nikash-latest.apk"
          />
        </div>
        <div>
          <label className={label}>প্লে স্টোর লিংক</label>
          <input
            className={input}
            value={form.play_store}
            onChange={(e) => setForm({ ...form, play_store: e.target.value })}
          />
        </div>
        <div>
          <label className={label}>ভার্সন</label>
          <input
            className={input}
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            placeholder="1.2.0"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>ইউজার ম্যানুয়াল (PDF) লিংক</label>
          <input
            className={input}
            value={form.manual_url}
            onChange={(e) => setForm({ ...form, manual_url: e.target.value })}
          />
        </div>
      </div>

      <button type="submit" disabled={busy} className={btn}>
        {busy && <Spinner />} সেভ করুন
      </button>
    </form>
  );
}

/* ------------------------------ বিলিং নিয়ম ------------------------------ */

export function BillingRulesPanel({ trialDays, graceDays }: { trialDays: number; graceDays: number }) {
  const { busy, msg, run } = useSave();
  const [trial, setTrial] = useState(String(trialDays));
  const [grace, setGrace] = useState(String(graceDays));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r1 = await putSetting("billing.trial_days", Number(trial));
          if (!r1.ok) return r1;
          return putSetting("billing.grace_days", Number(grace));
        });
      }}
      className="space-y-4"
    >
      <p className="text-sm text-slate-500">
        নতুন কোম্পানি কত দিন ফ্রি চালাতে পারবে, আর মেয়াদ শেষের পর কত দিন
        <strong> শুধু-দেখা</strong> অবস্থায় থাকবে তার নিয়ম।
      </p>
      <Msg msg={msg} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>ট্রায়াল দিন</label>
          <input
            type="number"
            min={0}
            max={365}
            className={input}
            value={trial}
            onChange={(e) => setTrial(e.target.value)}
          />
        </div>
        <div>
          <label className={label}>গ্রেস পিরিয়ড (দিন)</label>
          <input
            type="number"
            min={0}
            max={90}
            className={input}
            value={grace}
            onChange={(e) => setGrace(e.target.value)}
          />
        </div>
      </div>

      <button type="submit" disabled={busy} className={btn}>
        {busy && <Spinner />} সেভ করুন
      </button>
    </form>
  );
}

/* -------------------------------- প্রোফাইল -------------------------------- */

export function ProfilePanel({ name, email, role }: { name: string; email: string; role: string }) {
  const { busy, msg, run } = useSave();
  const [fullName, setFullName] = useState(name);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <p className="font-semibold text-slate-900">{email}</p>
        <p className="text-slate-500">{role === "super_admin" ? "সুপার অ্যাডমিন" : "সাপোর্ট অ্যাডমিন"}</p>
      </div>

      <Msg msg={msg} />
      {localError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{localError}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLocalError(null);
          run(() =>
            fetch("/api/admin/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: fullName }),
            })
          );
        }}
        className="space-y-3"
      >
        <div>
          <label className={label}>নাম</label>
          <input className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <button type="submit" disabled={busy} className={btn}>
          {busy && <Spinner />} নাম আপডেট
        </button>
      </form>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="mb-3 font-semibold text-slate-900">পাসওয়ার্ড বদলান</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLocalError(null);
            if (next !== confirm) {
              setLocalError("নতুন পাসওয়ার্ড দুটো মিলছে না");
              return;
            }
            run(async () => {
              const res = await fetch("/api/admin/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword: current, newPassword: next }),
              });
              if (res.ok) {
                setCurrent("");
                setNext("");
                setConfirm("");
              }
              return res;
            }, "পাসওয়ার্ড বদলে গেছে");
          }}
          className="space-y-3"
        >
          <div>
            <label className={label}>বর্তমান পাসওয়ার্ড</label>
            <input
              type="password"
              className={input}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>নতুন পাসওয়ার্ড</label>
              <input
                type="password"
                className={input}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={label}>আবার লিখুন</label>
              <input
                type="password"
                className={input}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">কমপক্ষে ৮ অক্ষর।</p>
          <button type="submit" disabled={busy || !current || !next} className={btn}>
            {busy && <Spinner />} পাসওয়ার্ড বদলান
          </button>
        </form>
      </div>
    </div>
  );
}
