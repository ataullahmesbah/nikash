import { supabaseAdmin } from "@/lib/supabase/admin";
import { RevenueChart } from "./revenue-chart";

export const dynamic = "force-dynamic";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const AVG_DAYS_PER_MONTH = 30.4375;

type CompanyPlanRow = {
  id: string;
  business_type: string;
  is_free: boolean;
  status: string;
  plans: { name_bn: string; price: number; duration_days: number } | null;
};

export default async function RevenueAnalyticsPage() {
  const db = supabaseAdmin();

  const [{ data: companies }, { data: payments }] = await Promise.all([
    db
      .from("companies")
      .select("id, business_type, is_free, status, plans(name_bn, price, duration_days)")
      .in("status", ["trial", "active", "grace", "readonly"]),
    db
      .from("platform_payments")
      .select("amount, created_at")
      .eq("status", "approved")
      .gte("created_at", new Date(new Date().setMonth(new Date().getMonth() - 11, 1)).toISOString()),
  ]);

  const rows = (companies ?? []) as unknown as CompanyPlanRow[];

  // MRR: only companies currently paying (active/grace), not free/lifetime,
  // with their plan's price normalized to a monthly-equivalent amount —
  // an annual plan's ৳12,000/year counts as ৳1,000/month here, not ৳12,000.
  const payingRows = rows.filter((r) => (r.status === "active" || r.status === "grace") && !r.is_free && r.plans);

  const mrr = payingRows.reduce((sum, r) => {
    const plan = r.plans!;
    const monthlyEquivalent = (plan.price / plan.duration_days) * AVG_DAYS_PER_MONTH;
    return sum + monthlyEquivalent;
  }, 0);
  const arr = mrr * 12;

  const planBreakdown = new Map<string, { count: number; monthly: number }>();
  payingRows.forEach((r) => {
    const plan = r.plans!;
    const monthlyEquivalent = (plan.price / plan.duration_days) * AVG_DAYS_PER_MONTH;
    const entry = planBreakdown.get(plan.name_bn) ?? { count: 0, monthly: 0 };
    entry.count += 1;
    entry.monthly += monthlyEquivalent;
    planBreakdown.set(plan.name_bn, entry);
  });

  const trialCount = rows.filter((r) => r.status === "trial").length;
  const freeCount = rows.filter((r) => r.is_free).length;
  const payingCount = payingRows.length;

  // Cash-collected-per-month trend (last 12 months) — distinct from MRR
  // above, which is accrual/normalized. This is what actually hit the
  // account each month, lumps and all (e.g. annual plans paid up front).
  const monthNames = ["জানু", "ফেব", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];
  const monthlyTotals = new Map<string, number>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyTotals.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
  }
  (payments ?? []).forEach((p) => {
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (monthlyTotals.has(key)) {
      monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + Number(p.amount));
    }
  });
  const chartData = Array.from(monthlyTotals.entries()).map(([key, revenue]) => {
    const [, monthIdx] = key.split("-").map(Number);
    return { month: monthNames[monthIdx], revenue };
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">রাজস্ব বিশ্লেষণ (MRR / ARR)</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR (মাসিক পুনরাবৃত্ত আয়)" value={`৳${Math.round(mrr).toLocaleString("en-BD")}`} hint="পরিশোধকারী কোম্পানির প্ল্যান মাসিক হিসাবে" />
        <StatCard label="ARR (বার্ষিক)" value={`৳${Math.round(arr).toLocaleString("en-BD")}`} hint="MRR × ১২" />
        <StatCard label="পরিশোধকারী কোম্পানি" value={String(payingCount)} />
        <StatCard label="ট্রায়াল / লাইফটাইম ফ্রি" value={`${trialCount} / ${freeCount}`} />
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">গত ১২ মাসের আদায়কৃত রাজস্ব (নগদ-ভিত্তিক)</h2>
        <RevenueChart data={chartData} />
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">প্ল্যান অনুযায়ী বিভাজন</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="pb-2">প্ল্যান</th>
              <th className="pb-2">কোম্পানি সংখ্যা</th>
              <th className="pb-2">মাসিক আয় (normalized)</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(planBreakdown.entries())
              .sort((a, b) => b[1].monthly - a[1].monthly)
              .map(([name, v]) => (
                <tr key={name} className="border-b border-slate-100">
                  <td className="py-2 text-slate-800">{name}</td>
                  <td className="py-2 text-slate-800">{v.count}</td>
                  <td className="py-2 text-slate-800">৳{Math.round(v.monthly).toLocaleString("en-BD")}</td>
                </tr>
              ))}
            {planBreakdown.size === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-slate-400">
                  এখনো কোনো পরিশোধকারী কোম্পানি নেই
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
