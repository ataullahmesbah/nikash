import { supabase } from "./supabase";

export type TrendPoint = { date: string; sales: number; collection: number };

export async function loadSalesTrend(companyId: string, days = 30): Promise<TrendPoint[]> {
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromStr = from.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("daily_summaries")
    .select("summary_date, sales_total, collection_total")
    .eq("company_id", companyId)
    .gte("summary_date", fromStr)
    .order("summary_date", { ascending: true });

  return (data ?? []).map((r) => ({
    date: r.summary_date,
    sales: Number(r.sales_total),
    collection: Number(r.collection_total),
  }));
}

export type MonthSummary = {
  month: string;
  sales_total: number;
  purchase_total: number;
  expense_total: number;
  gross_profit: number;
  net_profit: number;
};

export async function loadMonthlyComparison(companyId: string, months = 2): Promise<MonthSummary[]> {
  const { data } = await supabase
    .from("v_monthly_summary")
    .select("month, sales_total, purchase_total, expense_total, gross_profit, net_profit")
    .eq("company_id", companyId)
    .order("month", { ascending: false })
    .limit(months);

  return ((data ?? []) as MonthSummary[]).reverse();
}

// PRD 9.2 #4 — profit trend area chart wants more months of history than
// the month-to-month comparison bar chart does.
export async function loadProfitTrend(companyId: string, months = 6): Promise<MonthSummary[]> {
  return loadMonthlyComparison(companyId, months);
}

export type AgingBucket = { bucket: "0-15" | "16-30" | "31-60" | "60+"; total: number };
const BUCKET_ORDER: AgingBucket["bucket"][] = ["0-15", "16-30", "31-60", "60+"];

export async function loadReceivablesAging(companyId: string): Promise<AgingBucket[]> {
  const { data } = await supabase
    .from("v_receivables")
    .select("due, age_bucket")
    .eq("company_id", companyId);

  const totals: Record<string, number> = { "0-15": 0, "16-30": 0, "31-60": 0, "60+": 0 };
  (data ?? []).forEach((r) => {
    totals[r.age_bucket] = (totals[r.age_bucket] ?? 0) + Number(r.due);
  });

  return BUCKET_ORDER.map((bucket) => ({ bucket, total: totals[bucket] ?? 0 }));
}

export type ExpenseSlice = { name: string; total: number };

export async function loadExpenseBreakdown(companyId: string): Promise<ExpenseSlice[]> {
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const fromStr = firstOfMonth.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("expenses")
    .select("amount, expense_categories(name_bn)")
    .eq("company_id", companyId)
    .eq("status", "approved")
    .gte("entry_date", fromStr);

  const totals: Record<string, number> = {};
  (data ?? []).forEach((r) => {
    const name = (r.expense_categories as unknown as { name_bn: string } | null)?.name_bn ?? "অন্যান্য";
    totals[name] = (totals[name] ?? 0) + Number(r.amount);
  });

  return Object.entries(totals)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

// PRD 9.2 #3 — this month's target vs achieved-so-far, pace vs days elapsed.
export type GoalProgress = {
  targetAmount: number;
  achieved: number;
  daysElapsed: number;
  daysInMonth: number;
};

export async function loadGoalProgress(companyId: string): Promise<GoalProgress | null> {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: targetRow } = await supabase
    .from("targets")
    .select("target_amount")
    .eq("company_id", companyId)
    .eq("scope", "company")
    .is("scope_id", null)
    .eq("month", monthStart)
    .maybeSingle();

  if (!targetRow) return null;

  const { data: summaryRows } = await supabase
    .from("daily_summaries")
    .select("sales_total")
    .eq("company_id", companyId)
    .gte("summary_date", monthStart);

  const achieved = (summaryRows ?? []).reduce((sum, r) => sum + Number(r.sales_total), 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return {
    targetAmount: Number(targetRow.target_amount),
    achieved,
    daysElapsed: now.getDate(),
    daysInMonth,
  };
}

function currentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

// Note: `targets.scope_id` is nullable, and Postgres treats NULL <> NULL
// even under a unique constraint — so `.upsert(..., {onConflict})` can't
// find an existing company-scope row (scope_id is null) to update and
// would silently insert a duplicate every time. Look the row up
// explicitly instead of trusting ON CONFLICT here.
async function upsertTarget(
  companyId: string,
  userId: string,
  targetAmount: number,
  scope: "company" | "salesman" | "route",
  scopeId: string | null
) {
  const monthStart = currentMonthStart();
  let query = supabase
    .from("targets")
    .select("id")
    .eq("company_id", companyId)
    .eq("scope", scope)
    .eq("month", monthStart);
  query = scopeId ? query.eq("scope_id", scopeId) : query.is("scope_id", null);
  const { data: existing } = await query.maybeSingle();

  if (existing) {
    return supabase.from("targets").update({ target_amount: targetAmount, created_by: userId }).eq("id", existing.id);
  }
  return supabase.from("targets").insert({
    company_id: companyId,
    scope,
    scope_id: scopeId,
    month: monthStart,
    target_amount: targetAmount,
    created_by: userId,
  });
}

export async function setMonthlyGoal(companyId: string, userId: string, targetAmount: number) {
  return upsertTarget(companyId, userId, targetAmount, "company", null);
}

// PRD 9.2 #3's "লক্ষ্য কোম্পানি, সেলসম্যান ও রুট — তিন স্তরে নির্ধারণ করা
// যাবে" — salesman-level only for now; route-level would need joining
// sales through parties.route_id and isn't wired up yet.
export type SalesmanRow = { id: string; name: string };

export async function loadSalesmen(companyId: string): Promise<SalesmanRow[]> {
  const { data } = await supabase
    .from("users")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("role", "salesman")
    .eq("is_active", true);
  return data ?? [];
}

export async function loadSalesmanGoalProgress(companyId: string, salesmanId: string): Promise<GoalProgress | null> {
  const now = new Date();
  const monthStart = currentMonthStart();

  const { data: targetRow } = await supabase
    .from("targets")
    .select("target_amount")
    .eq("company_id", companyId)
    .eq("scope", "salesman")
    .eq("scope_id", salesmanId)
    .eq("month", monthStart)
    .maybeSingle();

  if (!targetRow) return null;

  const { data: salesRows } = await supabase
    .from("sales")
    .select("total")
    .eq("company_id", companyId)
    .eq("salesman_id", salesmanId)
    .eq("status", "posted")
    .gte("entry_date", monthStart);

  const achieved = (salesRows ?? []).reduce((sum, r) => sum + Number(r.total), 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return { targetAmount: Number(targetRow.target_amount), achieved, daysElapsed: now.getDate(), daysInMonth };
}

export async function setSalesmanGoal(companyId: string, userId: string, salesmanId: string, targetAmount: number) {
  return upsertTarget(companyId, userId, targetAmount, "salesman", salesmanId);
}

// Route-level target — the third scope PRD 9.2 #3 asks for. Sales don't
// carry a route_id directly; a route is a property of the customer
// (parties.route_id), so achievement is computed by first finding which
// parties belong to the route, then summing their posted sales this month.
export type RouteRow = { id: string; name: string };

export async function loadRoutesForTargets(companyId: string): Promise<RouteRow[]> {
  const { data } = await supabase
    .from("routes")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("is_active", true);
  return data ?? [];
}

export async function loadRouteGoalProgress(companyId: string, routeId: string): Promise<GoalProgress | null> {
  const now = new Date();
  const monthStart = currentMonthStart();

  const { data: targetRow } = await supabase
    .from("targets")
    .select("target_amount")
    .eq("company_id", companyId)
    .eq("scope", "route")
    .eq("scope_id", routeId)
    .eq("month", monthStart)
    .maybeSingle();

  if (!targetRow) return null;

  const { data: partyRows } = await supabase.from("parties").select("id").eq("company_id", companyId).eq("route_id", routeId);
  const partyIds = (partyRows ?? []).map((p) => p.id);

  let achieved = 0;
  if (partyIds.length > 0) {
    const { data: salesRows } = await supabase
      .from("sales")
      .select("total")
      .eq("company_id", companyId)
      .eq("status", "posted")
      .gte("entry_date", monthStart)
      .in("customer_id", partyIds);
    achieved = (salesRows ?? []).reduce((sum, r) => sum + Number(r.total), 0);
  }

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { targetAmount: Number(targetRow.target_amount), achieved, daysElapsed: now.getDate(), daysInMonth };
}

export async function setRouteGoal(companyId: string, userId: string, routeId: string, targetAmount: number) {
  return upsertTarget(companyId, userId, targetAmount, "route", routeId);
}

// PRD 9.2 #5/#6 — top 5 products and top 5 customers, last N days.
export type TopProduct = { name: string; total: number; qty: number };

export async function loadTopProducts(companyId: string, limit = 5, days = 30): Promise<TopProduct[]> {
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromStr = from.toISOString().slice(0, 10);

  const { data: saleRows } = await supabase
    .from("sales")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "posted")
    .gte("entry_date", fromStr);

  const saleIds = (saleRows ?? []).map((r) => r.id);
  if (saleIds.length === 0) return [];

  const { data } = await supabase
    .from("sale_items")
    .select("total, qty_base, variant_id, product_variants(name, products(name))")
    .in("sale_id", saleIds);

  const totals: Record<string, TopProduct> = {};
  (data ?? []).forEach((r) => {
    const variant = r.product_variants as unknown as { name: string; products: { name: string } | null } | null;
    const name = variant ? `${variant.products?.name ?? ""} (${variant.name})` : "অজানা পণ্য";
    if (!totals[name]) totals[name] = { name, total: 0, qty: 0 };
    totals[name].total += Number(r.total);
    totals[name].qty += Number(r.qty_base);
  });

  return Object.values(totals)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export type TopCustomer = { id: string; name: string; total: number; due: number };

export async function loadTopCustomers(companyId: string, limit = 5, days = 30): Promise<TopCustomer[]> {
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromStr = from.toISOString().slice(0, 10);

  const [salesRes, dueRes] = await Promise.all([
    supabase
      .from("sales")
      .select("customer_id, total, parties(name)")
      .eq("company_id", companyId)
      .eq("status", "posted")
      .gte("entry_date", fromStr)
      .not("customer_id", "is", null),
    supabase.from("v_receivables").select("party_id, due").eq("company_id", companyId),
  ]);

  const dueByParty: Record<string, number> = {};
  (dueRes.data ?? []).forEach((r) => {
    dueByParty[r.party_id] = (dueByParty[r.party_id] ?? 0) + Number(r.due);
  });

  const totals: Record<string, TopCustomer> = {};
  (salesRes.data ?? []).forEach((r) => {
    const id = r.customer_id as string;
    const name = (r.parties as unknown as { name: string } | null)?.name ?? "—";
    if (!totals[id]) totals[id] = { id, name, total: 0, due: dueByParty[id] ?? 0 };
    totals[id].total += Number(r.total);
  });

  return Object.values(totals)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// PRD 9.2 #9 — weekly cash in vs out, last N weeks.
export type CashFlowWeek = { label: string; cashIn: number; cashOut: number };

export async function loadCashFlow(companyId: string, weeks = 8): Promise<CashFlowWeek[]> {
  const from = new Date();
  from.setDate(from.getDate() - weeks * 7);
  const fromStr = from.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("daily_summaries")
    .select("summary_date, collection_total, payment_total, expense_total")
    .eq("company_id", companyId)
    .gte("summary_date", fromStr)
    .order("summary_date", { ascending: true });

  const buckets: CashFlowWeek[] = [];
  (data ?? []).forEach((r) => {
    const date = new Date(r.summary_date);
    const weekIdx = Math.floor((date.getTime() - from.getTime()) / (7 * 86400000));
    if (!buckets[weekIdx]) {
      const weekStart = new Date(from.getTime() + weekIdx * 7 * 86400000);
      buckets[weekIdx] = {
        label: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
        cashIn: 0,
        cashOut: 0,
      };
    }
    buckets[weekIdx].cashIn += Number(r.collection_total);
    buckets[weekIdx].cashOut += Number(r.payment_total) + Number(r.expense_total);
  });

  return buckets.filter(Boolean);
}

// PRD 9.2 #10 — stock value locked up over time.
export type StockValuePoint = { date: string; value: number };

export async function loadStockValueTrend(companyId: string, days = 30): Promise<StockValuePoint[]> {
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromStr = from.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("daily_summaries")
    .select("summary_date, stock_value")
    .eq("company_id", companyId)
    .gte("summary_date", fromStr)
    .order("summary_date", { ascending: true });

  return (data ?? []).map((r) => ({ date: r.summary_date, value: Number(r.stock_value) }));
}
