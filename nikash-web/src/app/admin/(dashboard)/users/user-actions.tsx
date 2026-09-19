"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

export default function UserActions({
  id, name, role, isActive,
}: {
  id: string; name: string; role: string; isActive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newRole, setNewRole] = useState(role);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function call(body: Record<string, unknown>, method: "PATCH" | "DELETE" = "PATCH") {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/admin/users/${id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "DELETE" ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "কাজটি করা যায়নি");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm font-medium text-blue-600 hover:underline">
        সম্পাদনা
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-left">
            <h2 className="text-lg font-bold text-slate-900">{name}</h2>
            <p className="mb-4 text-sm text-slate-500">অ্যাডমিন সম্পাদনা</p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">রোল</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="support_admin">সাপোর্ট অ্যাডমিন</option>
                  <option value="super_admin">সুপার অ্যাডমিন</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">নতুন পাসওয়ার্ড (ঐচ্ছিক)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="খালি রাখলে বদলাবে না"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="mt-5 flex flex-wrap justify-between gap-2">
              <button
                onClick={async () => {
                  if (await call({ is_active: !isActive })) setOpen(false);
                }}
                disabled={loading}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? "text-red-600 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                {isActive ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
              </button>

              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600">
                  বাতিল
                </button>
                <button
                  onClick={async () => {
                    const body: Record<string, unknown> = { role: newRole };
                    if (password) body.password = password;
                    if (await call(body)) {
                      setPassword("");
                      setOpen(false);
                    }
                  }}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {loading && <Spinner />}
                  সংরক্ষণ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
