import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Badge, Card, COMPANY_STATUS, PageHeader, StatCard, Table } from "@/components/ui";
import { GrowthChart, RevenueChart, TypeDonut } from "./_components/dashboard-charts";

export const dynamic = "force-dynamic";

type Stats = {
  total_companies: number;
  active_companies: number;
  trial_companies: number;
  expired_companies: number;
  total_users: number;
  pending_payments: number;
  expiring_7d: number;
  month_revenue: number;
  by_type: Record<string, number> | null;
  growth: { month: string; count: number }[] | null;
  revenue_trend: { month: string; amount: number }[] | null;
};

const TYPE_BN: Record<string, string> = { shop: "দোকান", warehouse: "গুদাম", vendor: "পরিবেশক" };

function taka(n: number) {
  return `৳${Math.round(n).toLocaleString("en-BD")}`;
}

function daysLeft(end: string | null) {
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
}

export default async function AdminDashboardPage() {
  const db = supabaseAdmin();

  const [{ data: statsRaw }, { data: recent }, { data: expiring }, { data: pending }] = await Promise.all([
    db.rpc("admin_dashboard_stats"),
    db
      .from("companies")
      .select("id, name, nikash_id, business_type, status, end_date, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    db
      .from("companies")
      .select("id, name, nikash_id, end_date, status")
      .not("is_free", "eq", true)
      .gte("end_date", new Date().toISOString().slice(0, 10))
      .lte("end_date", new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))
      .order("end_date", { ascending: true })
      .limit(6),
    db
      .from("payment_requests")
      .select("id, amount, method, trx_id, requested_at, companies(name)")
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(5),
  ]);

  const s = (statsRaw ?? {}) as Partial<Stats>;
  const typeData = Object.entries(s.by_type ?? {}).map(([k, v]) => ({
    name: TYPE_BN[k] ?? k,
    value: Number(v),
  }));

  return (
    <div>
      <PageHeader
        title="ড্যাশবোর্ড"
        subtitle="পুরো প্ল্যাটফর্মের এক নজরে অবস্থা"
        action={
          <Link
            href="/admin/companies"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            সব কোম্পানি দেখুন
          </Link>
        }
      />

      {/* মূল KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="মোট কোম্পানি" value={s.total_companies ?? 0} icon="🏢" href="/admin/companies" />
        <StatCard label="সক্রিয় গ্রাহক" value={s.active_companies ?? 0} tone="success" icon="✅" />
        <StatCard label="ট্রায়ালে আছে" value={s.trial_companies ?? 0} tone="info" icon="🎁" />
        <StatCard label="মেয়াদোত্তীর্ণ" value={s.expired_companies ?? 0} tone="danger" icon="⛔" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="এ মাসের আদায়" value={taka(s.month_revenue ?? 0)} tone="success" icon="💰" href="/admin/finance" />
        <StatCard
          label="অপেক্ষমাণ পেমেন্ট"
          value={s.pending_payments ?? 0}
          tone={(s.pending_payments ?? 0) > 0 ? "warning" : "default"}
          hint={(s.pending_payments ?? 0) > 0 ? "যাচাই করুন" : undefined}
          icon="💳"
          href="/admin/payments"
        />
        <StatCard label="৭ দিনে মেয়াদ শেষ" value={s.expiring_7d ?? 0} tone="warning" icon="⏰" />
        <StatCard label="মোট ব্যবহারকারী" value={s.total_users ?? 0} icon="👥" />
      </div>

      {/* গ্রাফ */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">কোম্পানি বৃদ্ধির ধারা (১২ মাস)</h2>
          <GrowthChart data={s.growth ?? []} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">ব্যবসার ধরন</h2>
          <TypeDonut data={typeData} />
        </Card>
      </div>

      <div className="mt-4">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">মাসিক রাজস্ব (১২ মাস)</h2>
          <RevenueChart data={s.revenue_trend ?? []} />
        </Card>
      </div>

      {/* অ্যাকশন দরকার */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">⚠️ অপেক্ষমাণ পেমেন্ট</h2>
            <Link href="/admin/payments" className="text-xs font-medium text-blue-600 hover:underline">
              সব দেখুন
            </Link>
          </div>
          {(pending ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">কোনো অপেক্ষমাণ পেমেন্ট নেই</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(pending ?? []).map((p) => (
                <Link key={p.id} href="/admin/payments" className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {(p.companies as unknown as { name: string } | null)?.name ?? "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.method} · {p.trx_id}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{taka(Number(p.amount))}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">⏰ শীঘ্রই মেয়াদ শেষ</h2>
            <Link href="/admin/companies" className="text-xs font-medium text-blue-600 hover:underline">
              সব দেখুন
            </Link>
          </div>
          {(expiring ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">৭ দিনের মধ্যে কারো মেয়াদ শেষ হচ্ছে না</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(expiring ?? []).map((c) => {
                const d = daysLeft(c.end_date);
                return (
                  <Link key={c.id} href={`/admin/companies/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.nikash_id}</p>
                    </div>
                    <Badge label={d !== null && d <= 0 ? "আজ শেষ" : `${d} দিন`} tone={d !== null && d <= 3 ? "danger" : "warning"} />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* সাম্প্রতিক কোম্পানি */}
      <div className="mt-6">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">সাম্প্রতিক কোম্পানি</h2>
            <Link href="/admin/companies" className="text-xs font-medium text-blue-600 hover:underline">
              সব দেখুন
            </Link>
          </div>
          <Table head={["নাম", "ID", "ধরন", "স্ট্যাটাস", "মেয়াদ শেষ", ""]}>
            {(recent ?? []).map((c) => {
              const st = COMPANY_STATUS[c.status] ?? { label: c.status, tone: "default" as const };
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.nikash_id}</td>
                  <td className="px-4 py-3 text-slate-600">{TYPE_BN[c.business_type] ?? c.business_type}</td>
                  <td className="px-4 py-3">
                    <Badge label={st.label} tone={st.tone} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.end_date ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/companies/${c.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      বিস্তারিত
                    </Link>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>
    </div>
  );
}
