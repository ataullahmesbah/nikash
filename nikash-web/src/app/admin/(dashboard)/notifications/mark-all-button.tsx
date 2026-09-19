"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

export default function MarkAllButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markAll() {
    setLoading(true);
    await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={markAll}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
    >
      {loading && <Spinner />}
      সব পড়া হিসেবে চিহ্নিত করুন
    </button>
  );
}
