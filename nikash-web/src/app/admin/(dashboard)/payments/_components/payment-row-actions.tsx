"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PaymentRowActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function approve() {
    if (!confirm("এই পেমেন্ট Approve করবেন?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/payments/${requestId}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "ব্যর্থ হয়েছে");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    const reason = prompt("বাতিলের কারণ লিখুন");
    if (!reason) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/payments/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "ব্যর্থ হয়েছে");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        onClick={approve}
        disabled={busy}
        className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700"
      >
        Approve
      </button>
      <button
        onClick={reject}
        disabled={busy}
        className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700"
      >
        Reject
      </button>
    </div>
  );
}
