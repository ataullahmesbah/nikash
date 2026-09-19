import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import ContactStatus from "./_components/contact-status";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "info" | "warning" | "success" | "default" }> = {
  new: { label: "নতুন", tone: "info" },
  read: { label: "পড়া হয়েছে", tone: "warning" },
  replied: { label: "উত্তর দেওয়া", tone: "success" },
  closed: { label: "বন্ধ", tone: "default" },
};

const FILTERS = [
  { key: "all", label: "সব" },
  { key: "new", label: "নতুন" },
  { key: "read", label: "পড়া হয়েছে" },
  { key: "replied", label: "উত্তর দেওয়া" },
  { key: "closed", label: "বন্ধ" },
];

function when(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "এইমাত্র";
  if (mins < 60) return `${mins} মিনিট আগে`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ঘণ্টা আগে`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = FILTERS.some((f) => f.key === rawStatus) ? (rawStatus as string) : "all";

  const db = supabaseAdmin();
  let query = db.from("contact_submissions").select("*").order("created_at", { ascending: false }).limit(100);
  if (status !== "all") query = query.eq("status", status);

  const [{ data: rows }, { count: newCount }, { count: totalCount }] = await Promise.all([
    query,
    db.from("contact_submissions").select("id", { count: "exact", head: true }).eq("status", "new"),
    db.from("contact_submissions").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div>
      <PageHeader title="যোগাযোগ বার্তা" subtitle="ওয়েবসাইটের যোগাযোগ ফর্ম থেকে আসা বার্তা" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="নতুন বার্তা" value={newCount ?? 0} tone={(newCount ?? 0) > 0 ? "warning" : "default"} icon="📬" />
        <StatCard label="মোট বার্তা" value={totalCount ?? 0} icon="📨" />
        <StatCard label="এই তালিকায়" value={(rows ?? []).length} icon="📋" />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/contacts?status=${f.key}`}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
              status === f.key
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {(rows ?? []).length === 0 ? (
        <Card>
          <EmptyState icon="📭" title="কোনো বার্তা নেই" message="ওয়েবসাইটের যোগাযোগ ফর্ম থেকে বার্তা এলে এখানে দেখা যাবে।" />
        </Card>
      ) : (
        <div className="space-y-3">
          {(rows ?? []).map((r) => {
            const st = STATUS[r.status] ?? { label: r.status, tone: "default" as const };
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{r.name}</p>
                      <Badge label={st.label} tone={st.tone} />
                      {r.subject && <Badge label={r.subject} tone="default" />}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {r.phone && (
                        <a href={`tel:${r.phone}`} className="hover:text-slate-900">
                          ☎️ {r.phone}
                        </a>
                      )}
                      {r.email && (
                        <a href={`mailto:${r.email}`} className="hover:text-slate-900">
                          ✉️ {r.email}
                        </a>
                      )}
                      <span>{when(r.created_at)}</span>
                    </div>
                  </div>
                  <ContactStatus id={r.id} status={r.status} />
                </div>

                <p className="mt-3 whitespace-pre-line border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-700">
                  {r.message}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
