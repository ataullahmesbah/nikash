import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Badge, Card, EmptyState, PageHeader, StatCard, Table } from "@/components/ui";
import { MethodDonut, RevenueChart } from "../_components/dashboard-charts";

export const dynamic = "force-dynamic";

const METHOD_BN: Record<string, string> = {
  bkash: "বিকাশ",
  nagad: "নগদ",
  rocket: "রকেট",
  bank: "ব্যাংক",
  cash: "ক্যাশ",
  cheque: "চেক",
};

function taka(n: number | null | undefined) {
  return `৳${Number(n ?? 0).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;
}

function shortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

type Summary = {
  monthly?: { month: string; amount: number; count: number }[];
  by_method?: { method: string; amount: number; count: number }[];
  totals?: { lifetime: number; this_month: number; last_month: number };
  unpaid_invoices?: { count: number; amount: number };
  pending_requests?: { count: number; amount: number };
};

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  const { months: rawMonths } = await searchParams;
  const months = [6, 12, 24].includes(Number(rawMonths)) ? Number(rawMonths) : 12;

  const db = supabaseAdmin();

  const [summaryRes, expiringRes, invoiceRes] = await Promise.all([
    db.rpc("finance_summary", { p_months: months }),
    db
      .from("companies")
      .select("id, name, nikash_id, end_date, status, plans(name_bn, price)")
      .not("end_date", "is", null)
      .lte("end_date", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
      .order("end_date")
      .limit(25),
    db
      .from("platform_invoices")
      .select("id, invoice_no, total, status, due_date, issued_at, company_id, companies(name, nikash_id)")
      .neq("status", "paid")
      .order("issued_at", { ascending: false })
      .limit(25),
  ]);

  const summary = (summaryRes.data ?? {}) as Summary;
  const monthly = summary.monthly ?? [];
  const byMethod = summary.by_method ?? [];
  const totals = summary.totals ?? { lifetime: 0, this_month: 0, last_month: 0 };
  const unpaid = summary.unpaid_invoices ?? { count: 0, amount: 0 };
  const pending = summary.pending_requests ?? { count: 0, amount: 0 };

  const avg = monthly.length ? Math.round(monthly.reduce((s, m) => s + Number(m.amount), 0) / monthly.length) : 0;
  const growth =
    totals.last_month > 0
      ? Math.round(((totals.this_month - totals.last_month) / totals.last_month) * 100)
      : null;

  // আগামী ৩০ দিনে যাদের মেয়াদ শেষ — এটাই সম্ভাব্য রিনিউ আয়
  const expiring = expiringRes.data ?? [];
  const pipeline = expiring.reduce((s, c) => {
    const plan = c.plans as unknown as { price?: number } | null;
    return s + Number(plan?.price ?? 0);
  }, 0);

  return (
    <div>
      <PageHeader
        title="ফিনান্স"
        subtitle="সাবস্ক্রিপশন আয়, পেমেন্ট মাধ্যম ও বকেয়ার পূর্ণ চিত্র"
        action={
          <div className="flex gap-2">
            {[6, 12, 24].map((m) => (
              <Link
                key={m}
                href={`/admin/finance?months=${m}`}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  months === m
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {m} মাস
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="এই মাসের আদায়"
          value={taka(totals.this_month)}
          hint={growth === null ? "তুলনা করার মতো ডেটা নেই" : `গত মাস ${taka(totals.last_month)} (${growth >= 0 ? "+" : ""}${growth}%)`}
          tone={growth !== null && growth < 0 ? "warning" : "success"}
          icon="💰"
        />
        <StatCard label="মাসিক গড় আয়" value={taka(avg)} hint={`গত ${months} মাসের গড়`} icon="📊" />
        <StatCard
          label="যাচাই বাকি পেমেন্ট"
          value={taka(pending.amount)}
          hint={`${pending.count} টি রিকোয়েস্ট`}
          tone={pending.count > 0 ? "warning" : "default"}
          href="/admin/payments?tab=requests"
          icon="⏳"
        />
        <StatCard
          label="সম্ভাব্য রিনিউ (৩০ দিন)"
          value={taka(pipeline)}
          hint={`${expiring.length} টি কোম্পানির মেয়াদ শেষ হবে`}
          tone="info"
          icon="🔁"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-bold text-slate-900">মাসভিত্তিক আদায়</h2>
          {monthly.length > 0 ? (
            <RevenueChart data={monthly.map((m) => ({ month: m.month, amount: Number(m.amount) }))} />
          ) : (
            <EmptyState icon="📉" title="এখনো আয়ের ডেটা নেই" />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-bold text-slate-900">মাধ্যম অনুযায়ী</h2>
          {byMethod.length > 0 ? (
            <>
              <MethodDonut
                data={byMethod.map((m) => ({
                  name: METHOD_BN[m.method] ?? m.method,
                  value: Number(m.amount),
                }))}
              />
              <div className="mt-3 space-y-1.5">
                {byMethod.map((m) => (
                  <div key={m.method} className="flex justify-between text-sm">
                    <span className="text-slate-600">{METHOD_BN[m.method] ?? m.method}</span>
                    <span className="font-semibold text-slate-900">
                      {taka(m.amount)} <span className="text-xs font-normal text-slate-400">({m.count})</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon="💳" title="কোনো পেমেন্ট নেই" />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-bold text-slate-900">মেয়াদ শেষ হচ্ছে (৩০ দিন)</h2>
            <Link href="/admin/companies?expiring=1" className="text-sm font-semibold text-sky-600">
              সব দেখুন
            </Link>
          </div>
          {expiring.length > 0 ? (
            <Table head={["কোম্পানি", "প্ল্যান", "মেয়াদ শেষ", "বাকি"]}>
              {expiring.map((c) => {
                const days = c.end_date
                  ? Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000)
                  : null;
                const plan = c.plans as unknown as { name_bn?: string } | null;
                return (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/companies/${c.id}`} className="font-medium text-slate-900 hover:underline">
                        {c.name}
                      </Link>
                      <p className="font-mono text-xs text-slate-400">{c.nikash_id}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{plan?.name_bn ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{shortDate(c.end_date)}</td>
                    <td className="px-4 py-3">
                      <Badge
                        label={days === null ? "—" : days < 0 ? `${Math.abs(days)} দিন পার` : `${days} দিন`}
                        tone={days === null ? "default" : days < 0 ? "danger" : days <= 7 ? "warning" : "info"}
                      />
                    </td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <EmptyState icon="🎉" title="আগামী ৩০ দিনে কারো মেয়াদ শেষ হচ্ছে না" />
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-bold text-slate-900">অপরিশোধিত ইনভয়েস</h2>
            <span className="text-sm font-semibold text-red-600">{taka(unpaid.amount)}</span>
          </div>
          {(invoiceRes.data ?? []).length > 0 ? (
            <Table head={["ইনভয়েস", "কোম্পানি", "টাকা", "ইস্যু"]}>
              {(invoiceRes.data ?? []).map((inv) => {
                const company = inv.companies as unknown as { name?: string; nikash_id?: string } | null;
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{inv.invoice_no}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/companies/${inv.company_id}`} className="text-slate-900 hover:underline">
                        {company?.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{taka(inv.total)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{shortDate(inv.issued_at)}</td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <EmptyState icon="✅" title="সব ইনভয়েস পরিশোধিত" />
          )}
        </Card>
      </div>
    </div>
  );
}
