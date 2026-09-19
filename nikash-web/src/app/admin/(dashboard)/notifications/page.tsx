import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import Link from "next/link";
import MarkAllButton from "./mark-all-button";

export const dynamic = "force-dynamic";

const ICON: Record<string, string> = {
  payment: "💳", signup: "🏢", subscription: "📅",
  notice: "📢", system: "⚙️", due: "📋",
};

const TONE: Record<string, "info" | "success" | "warning" | "danger"> = {
  info: "info", success: "success", warning: "warning", critical: "danger",
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "এইমাত্র";
  if (mins < 60) return `${mins} মিনিট আগে`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ঘণ্টা আগে`;
  return `${Math.floor(hrs / 24)} দিন আগে`;
}

export default async function NotificationsPage() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("notifications")
    .select("id, type, severity, title, body, link, read_at, created_at")
    .eq("audience", "platform")
    .order("created_at", { ascending: false })
    .limit(100);

  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div>
      <PageHeader
        title="নোটিফিকেশন"
        subtitle={unread > 0 ? `${unread}টি অপঠিত` : "সব পড়া হয়েছে"}
        action={unread > 0 ? <MarkAllButton /> : undefined}
      />

      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="কোনো নোটিফিকেশন নেই"
            message="নতুন কোম্পানি সাইনআপ, পেমেন্ট জমা বা সিস্টেম ইভেন্ট হলে এখানে দেখা যাবে।"
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((n) => {
              const row = (
                <div className={`flex gap-4 px-5 py-4 transition hover:bg-slate-50 ${n.read_at ? "" : "bg-blue-50/40"}`}>
                  <span className="text-xl">{ICON[n.type] ?? "🔔"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm ${n.read_at ? "text-slate-700" : "font-semibold text-slate-900"}`}>
                        {n.title}
                      </p>
                      <Badge label={n.type} tone={TONE[n.severity] ?? "info"} />
                    </div>
                    {n.body && <p className="mt-1 text-sm text-slate-500">{n.body}</p>}
                    <p className="mt-1.5 text-xs text-slate-400">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} className="block">
                  {row}
                </Link>
              ) : (
                <div key={n.id}>{row}</div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
