import { useCallback, useEffect, useState } from "react";
import { Stack, useFocusEffect } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LineChart, BarChart, PieChart } from "react-native-gifted-charts";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import {
  loadSalesTrend,
  loadMonthlyComparison,
  loadReceivablesAging,
  loadExpenseBreakdown,
  loadGoalProgress,
  setMonthlyGoal,
  loadSalesmen,
  loadSalesmanGoalProgress,
  setSalesmanGoal,
  loadRoutesForTargets,
  loadRouteGoalProgress,
  setRouteGoal,
  loadProfitTrend,
  loadTopProducts,
  loadTopCustomers,
  loadCashFlow,
  loadStockValueTrend,
  type TrendPoint,
  type MonthSummary,
  type AgingBucket,
  type ExpenseSlice,
  type GoalProgress,
  type SalesmanRow,
  type RouteRow,
  type TopProduct,
  type TopCustomer,
  type CashFlowWeek,
  type StockValuePoint,
} from "@/lib/analytics";
import { categorical, chrome, status, agingColor } from "@/lib/chart-colors";
import { ChartLegend } from "@/components/chart-legend";
import { FormField, PrimaryButton } from "@/components/form";
import { DateRangePicker } from "@/components/date-range-picker";
import { presetRange, type DateRange } from "@/lib/format";

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * গ্রাফের প্রস্থ।
 *
 * gifted-charts-কে স্পষ্ট প্রস্থ না দিলে সে নিজের মতো জায়গা নেয় — তখন
 * লাইন কার্ডের বাইরে বেরিয়ে যায় বা উপরে-নিচে সরে যায়। পর্দার প্রস্থ থেকে
 * স্ক্রিনের প্যাডিং (১৬×২), কার্ডের প্যাডিং (১৪×২) আর Y-অক্ষের লেবেলের
 * জায়গা বাদ দিয়ে যা থাকে সেটাই গ্রাফের আসল জায়গা।
 */
function useChartWidth() {
  const { width } = useWindowDimensions();
  return Math.max(220, Math.floor(width - 32 - 28 - 46));
}

function taka(n: number) {
  return `৳${Math.round(n).toLocaleString("en-BD")}`;
}

const monthNames = [
  "জানু", "ফেব", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্ট", "অক্টো", "নভে", "ডিসে",
];

export default function AnalyticsScreen() {
  const { profile } = useAuth();
  const chartW = useChartWidth();
  const toast = useToast();
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [months, setMonths] = useState<MonthSummary[]>([]);
  const [profitMonths, setProfitMonths] = useState<MonthSummary[]>([]);
  const [aging, setAging] = useState<AgingBucket[]>([]);
  const [expenses, setExpenses] = useState<ExpenseSlice[]>([]);
  const [goal, setGoal] = useState<GoalProgress | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowWeek[]>([]);
  const [stockTrend, setStockTrend] = useState<StockValuePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalInput, setGoalInput] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [salesmen, setSalesmen] = useState<SalesmanRow[]>([]);
  const [salesmanGoals, setSalesmanGoals] = useState<Record<string, GoalProgress | null>>({});
  const [salesmanInputs, setSalesmanInputs] = useState<Record<string, string>>({});
  const [savingSalesmanId, setSavingSalesmanId] = useState<string | null>(null);
  const [ownGoal, setOwnGoal] = useState<GoalProgress | null>(null);
  const [routesForTargets, setRoutesForTargets] = useState<RouteRow[]>([]);
  const [routeGoals, setRouteGoals] = useState<Record<string, GoalProgress | null>>({});
  const [routeInputs, setRouteInputs] = useState<Record<string, string>>({});
  const [savingRouteId, setSavingRouteId] = useState<string | null>(null);

  // খরচের দিন-ভিত্তিক বিশ্লেষণ — তারিখ পরিসর বদলে যেকোনো সময় দেখা যায়
  const [expRange, setExpRange] = useState<DateRange>(presetRange("month"));
  const [expDays, setExpDays] = useState<{ day: string; amount: number }[]>([]);
  const [expCats, setExpCats] = useState<{ name: string; amount: number; count: number }[]>([]);
  const [expTotal, setExpTotal] = useState(0);

  // আলাদা এফেক্ট — শুধু তারিখ বদলালেই আবার আনে, পুরো পাতা লোড হয় না
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("expense_breakdown", {
        p_from: expRange.from,
        p_to: expRange.to,
      });
      if (cancelled || !data) return;
      const d = data as {
        total?: number;
        by_day?: { day: string; amount: number }[];
        by_category?: { name: string; amount: number; count: number }[];
      };
      setExpTotal(Number(d.total ?? 0));
      setExpDays((d.by_day ?? []).map((x) => ({ day: x.day, amount: Number(x.amount) })));
      setExpCats(
        (d.by_category ?? []).map((x) => ({
          name: x.name,
          amount: Number(x.amount),
          count: x.count,
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, expRange.from, expRange.to]);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const [t, m, pm, a, e, g, tp, tc, cf, sv] = await Promise.all([
      loadSalesTrend(profile.company_id, 30),
      loadMonthlyComparison(profile.company_id, 2),
      loadProfitTrend(profile.company_id, 6),
      loadReceivablesAging(profile.company_id),
      loadExpenseBreakdown(profile.company_id),
      loadGoalProgress(profile.company_id),
      loadTopProducts(profile.company_id, 5, 30),
      loadTopCustomers(profile.company_id, 5, 30),
      loadCashFlow(profile.company_id, 8),
      loadStockValueTrend(profile.company_id, 30),
    ]);
    setTrend(t);
    setMonths(m);
    setProfitMonths(pm);
    setAging(a);
    setExpenses(e);
    setGoal(g);
    setTopProducts(tp);
    setTopCustomers(tc);
    setCashFlow(cf);
    setStockTrend(sv);

    if (profile.role === "owner") {
      const list = await loadSalesmen(profile.company_id);
      setSalesmen(list);
      const entries = await Promise.all(
        list.map(async (s) => [s.id, await loadSalesmanGoalProgress(profile.company_id, s.id)] as const)
      );
      setSalesmanGoals(Object.fromEntries(entries));

      if (profile.business_type === "warehouse") {
        const routeList = await loadRoutesForTargets(profile.company_id);
        setRoutesForTargets(routeList);
        const routeEntries = await Promise.all(
          routeList.map(async (r) => [r.id, await loadRouteGoalProgress(profile.company_id, r.id)] as const)
        );
        setRouteGoals(Object.fromEntries(routeEntries));
      }
    } else if (profile.role === "salesman") {
      setOwnGoal(await loadSalesmanGoalProgress(profile.company_id, profile.id));
    }

    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleSaveGoal() {
    const amount = Number(goalInput);
    if (!profile || !amount || amount <= 0) {
      toast.error("সঠিক পরিমাণ লিখুন");
      return;
    }
    setSavingGoal(true);
    const { error } = await setMonthlyGoal(profile.company_id, profile.id, amount);
    setSavingGoal(false);
    if (error) {
      toast.error("লক্ষ্য সংরক্ষণ করা যায়নি");
      return;
    }
    toast.success("এই মাসের লক্ষ্য নির্ধারণ হয়েছে");
    setGoalInput("");
    load();
  }

  async function handleSaveSalesmanGoal(salesmanId: string) {
    const amount = Number(salesmanInputs[salesmanId]);
    if (!profile || !amount || amount <= 0) {
      toast.error("সঠিক পরিমাণ লিখুন");
      return;
    }
    setSavingSalesmanId(salesmanId);
    const { error } = await setSalesmanGoal(profile.company_id, profile.id, salesmanId, amount);
    setSavingSalesmanId(null);
    if (error) {
      toast.error("লক্ষ্য সংরক্ষণ করা যায়নি");
      return;
    }
    toast.success("লক্ষ্য নির্ধারণ হয়েছে");
    setSalesmanInputs((prev) => ({ ...prev, [salesmanId]: "" }));
    load();
  }

  async function handleSaveRouteGoal(routeId: string) {
    const amount = Number(routeInputs[routeId]);
    if (!profile || !amount || amount <= 0) {
      toast.error("সঠিক পরিমাণ লিখুন");
      return;
    }
    setSavingRouteId(routeId);
    const { error } = await setRouteGoal(profile.company_id, profile.id, routeId, amount);
    setSavingRouteId(null);
    if (error) {
      toast.error("লক্ষ্য সংরক্ষণ করা যায়নি");
      return;
    }
    toast.success("লক্ষ্য নির্ধারণ হয়েছে");
    setRouteInputs((prev) => ({ ...prev, [routeId]: "" }));
    load();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // --- Line chart: last 30 days, sales vs collection ---
  const salesLine = trend.map((p) => ({ value: p.sales }));
  const collectionLine = trend.map((p) => ({ value: p.collection }));

  // --- Bar chart: this month vs last month, 4 metrics grouped ---
  const barMetrics: { key: keyof MonthSummary; label: string; color: string }[] = [
    { key: "sales_total", label: "বিক্রয়", color: categorical.blue },
    { key: "purchase_total", label: "ক্রয়", color: categorical.orange },
    { key: "expense_total", label: "খরচ", color: categorical.red },
    { key: "net_profit", label: "নিট লাভ", color: categorical.aqua },
  ];
  const barData = months.flatMap((m, monthIdx) =>
    barMetrics.map((metric, i) => ({
      value: Math.max(0, Number(m[metric.key])),
      frontColor: metric.color,
      spacing: i === barMetrics.length - 1 && monthIdx === 0 ? 18 : 2,
      label: i === 0 ? monthNames[new Date(m.month).getMonth()] : "",
    }))
  );

  // --- Donuts ---
  const agingTotal = aging.reduce((s, a) => s + a.total, 0);
  const agingData = aging
    .filter((a) => a.total > 0)
    .map((a) => ({ value: a.total, color: agingColor[a.bucket], text: a.bucket }));

  const expenseTotal = expenses.reduce((s, e) => s + e.total, 0);
  const expensePalette = Object.values(categorical);
  const expenseData = expenses.map((e, i) => ({
    value: e.total,
    color: expensePalette[i % expensePalette.length],
    text: e.name,
  }));

  // --- Goal progress ring ---
  const goalPct = goal ? Math.min(100, Math.round((goal.achieved / goal.targetAmount) * 100)) : 0;
  const pacePct = goal ? Math.round((goal.daysElapsed / goal.daysInMonth) * 100) : 0;
  const onTrack = goalPct >= pacePct;
  const goalData = goal
    ? [
        { value: Math.min(goal.achieved, goal.targetAmount), color: onTrack ? status.good : status.critical },
        { value: Math.max(0, goal.targetAmount - goal.achieved), color: chrome.gridline },
      ]
    : [];

  // --- Profit trend: gross vs net, filled area ---
  const grossLine = profitMonths.map((m) => ({ value: Number(m.gross_profit) }));
  const netLine = profitMonths.map((m) => ({ value: Number(m.net_profit) }));

  // --- Top 5 products / customers: horizontal bars ---
  const productBarData = topProducts.map((p) => ({
    value: p.total,
    label: p.name,
    frontColor: categorical.blue,
  }));
  const customerBarData = topCustomers.map((c) => ({
    value: c.total,
    label: c.name,
    frontColor: categorical.violet,
  }));

  // --- Cash flow: weekly in vs out, grouped bars ---
  const cashFlowData = cashFlow.flatMap((w, idx) => [
    { value: w.cashIn, frontColor: categorical.aqua, spacing: 2, label: w.label },
    { value: w.cashOut, frontColor: categorical.orange, spacing: idx === cashFlow.length - 1 ? 0 : 16, label: "" },
  ]);

  // --- Stock value trend ---
  const stockLine = stockTrend.map((p) => ({ value: p.value }));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }} contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: "Analytics", headerShown: true }} />

      <ChartCard title="বিক্রয়ের ধারা (৩০ দিন)">
        {trend.length > 1 ? (
          <>
            <LineChart
              width={chartW}
              data={salesLine}
              data2={collectionLine}
              color1={categorical.blue}
              color2={categorical.aqua}
              dataPointsColor1={categorical.blue}
              dataPointsColor2={categorical.aqua}
              thickness={2}
              curved
              hideDataPoints
              hideRules={false}
              rulesColor={chrome.gridline}
              yAxisColor={chrome.baseline}
              xAxisColor={chrome.baseline}
              yAxisTextStyle={{ color: chrome.muted, fontSize: 10 }}
              noOfSections={4}
              height={160}
              adjustToWidth
              initialSpacing={4}
              endSpacing={4}
            />
            <ChartLegend
              items={[
                { label: "বিক্রয়", color: categorical.blue },
                { label: "আদায়", color: categorical.aqua },
              ]}
            />
          </>
        ) : (
          <Text style={styles.empty}>যথেষ্ট ডেটা নেই — কয়েকদিন বিক্রয় পোস্ট করার পর দেখা যাবে</Text>
        )}
      </ChartCard>

      <ChartCard title="মাসিক তুলনা">
        {months.length > 0 ? (
          <>
            <BarChart
              width={chartW}
              data={barData}
              barWidth={16}
              noOfSections={4}
              rulesColor={chrome.gridline}
              yAxisColor={chrome.baseline}
              xAxisColor={chrome.baseline}
              yAxisTextStyle={{ color: chrome.muted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: chrome.textSecondary, fontSize: 11, fontWeight: "600" }}
              height={160}
            />
            <ChartLegend items={barMetrics.map((m) => ({ label: m.label, color: m.color }))} />
          </>
        ) : (
          <Text style={styles.empty}>এখনো কোনো মাসের হিসাব তৈরি হয়নি</Text>
        )}
      </ChartCard>

      <ChartCard title="এই মাসের লক্ষ্য পূরণ">
        {goal ? (
          <View style={styles.donutRow}>
            <PieChart
              data={goalData}
              donut
              radius={70}
              innerRadius={45}
              innerCircleColor="#fff"
              centerLabelComponent={() => (
                <View style={{ alignItems: "center" }}>
                  <Text style={styles.donutCenterValue}>{goalPct}%</Text>
                  <Text style={styles.donutCenterLabel}>{taka(goal.achieved)}</Text>
                </View>
              )}
            />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.legendText}>লক্ষ্য: {taka(goal.targetAmount)}</Text>
              <Text style={styles.legendText}>বাকি: {taka(Math.max(0, goal.targetAmount - goal.achieved))}</Text>
              <Text style={styles.legendText}>দিন বাকি: {goal.daysInMonth - goal.daysElapsed}</Text>
              <Text style={[styles.legendText, { color: onTrack ? status.good : status.critical, fontWeight: "700", marginTop: 4 }]}>
                {onTrack ? "লক্ষ্য অনুযায়ী এগিয়ে আছেন" : "লক্ষ্যের চেয়ে পিছিয়ে আছেন"}
              </Text>
            </View>
          </View>
        ) : profile?.role === "owner" ? (
          <View>
            <Text style={styles.empty}>এই মাসের কোনো লক্ষ্য নির্ধারণ করা হয়নি</Text>
            <FormField
              label="মাসিক বিক্রয় লক্ষ্য (৳)"
              keyboardType="numeric"
              value={goalInput}
              onChangeText={setGoalInput}
              placeholder="৫০০০০০"
            />
            <PrimaryButton title="লক্ষ্য নির্ধারণ করুন" onPress={handleSaveGoal} loading={savingGoal} />
          </View>
        ) : (
          <Text style={styles.empty}>এই মাসের কোনো লক্ষ্য নির্ধারণ করা হয়নি</Text>
        )}
      </ChartCard>

      {profile?.role === "owner" && (
        <ChartCard title="সেলসম্যান-ভিত্তিক লক্ষ্য">
          {salesmen.length === 0 ? (
            <Text style={styles.empty}>কোনো সেলসম্যান নেই</Text>
          ) : (
            salesmen.map((s) => {
              const g = salesmanGoals[s.id];
              const pct = g ? Math.min(100, Math.round((g.achieved / g.targetAmount) * 100)) : 0;
              return (
                <View key={s.id} style={styles.salesmanRow}>
                  <Text style={styles.salesmanName}>{s.name}</Text>
                  {g ? (
                    <Text style={styles.legendText}>
                      {taka(g.achieved)} / {taka(g.targetAmount)} ({pct}%)
                    </Text>
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <View style={{ flex: 1 }}>
                        <FormField
                          label=""
                          keyboardType="numeric"
                          value={salesmanInputs[s.id] ?? ""}
                          onChangeText={(v) => setSalesmanInputs((prev) => ({ ...prev, [s.id]: v }))}
                          placeholder="লক্ষ্য (৳)"
                        />
                      </View>
                      <PrimaryButton
                        title="সেট করুন"
                        onPress={() => handleSaveSalesmanGoal(s.id)}
                        loading={savingSalesmanId === s.id}
                      />
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ChartCard>
      )}

      {profile?.role === "owner" && profile.business_type === "warehouse" && (
        <ChartCard title="রুট-ভিত্তিক লক্ষ্য">
          {routesForTargets.length === 0 ? (
            <Text style={styles.empty}>কোনো রুট নেই — "আরও → রুট ব্যবস্থাপনা" থেকে রুট বানান</Text>
          ) : (
            routesForTargets.map((r) => {
              const g = routeGoals[r.id];
              const pct = g ? Math.min(100, Math.round((g.achieved / g.targetAmount) * 100)) : 0;
              return (
                <View key={r.id} style={styles.salesmanRow}>
                  <Text style={styles.salesmanName}>{r.name}</Text>
                  {g ? (
                    <Text style={styles.legendText}>
                      {taka(g.achieved)} / {taka(g.targetAmount)} ({pct}%)
                    </Text>
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <View style={{ flex: 1 }}>
                        <FormField
                          label=""
                          keyboardType="numeric"
                          value={routeInputs[r.id] ?? ""}
                          onChangeText={(v) => setRouteInputs((prev) => ({ ...prev, [r.id]: v }))}
                          placeholder="লক্ষ্য (৳)"
                        />
                      </View>
                      <PrimaryButton
                        title="সেট করুন"
                        onPress={() => handleSaveRouteGoal(r.id)}
                        loading={savingRouteId === r.id}
                      />
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ChartCard>
      )}

      {profile?.role === "salesman" && (
        <ChartCard title="আমার এই মাসের লক্ষ্য">
          {ownGoal ? (
            <Text style={styles.legendText}>
              {taka(ownGoal.achieved)} / {taka(ownGoal.targetAmount)} (
              {Math.min(100, Math.round((ownGoal.achieved / ownGoal.targetAmount) * 100))}%)
            </Text>
          ) : (
            <Text style={styles.empty}>এই মাসের কোনো লক্ষ্য নির্ধারণ করা হয়নি</Text>
          )}
        </ChartCard>
      )}

      <ChartCard title="লাভের ধারা (৬ মাস)">
        {profitMonths.length > 1 ? (
          <>
            <LineChart
              width={chartW}
              data={grossLine}
              data2={netLine}
              areaChart
              color1={categorical.aqua}
              color2={categorical.blue}
              startFillColor1={categorical.aqua}
              startFillColor2={categorical.blue}
              startOpacity={0.25}
              endOpacity={0.02}
              dataPointsColor1={categorical.aqua}
              dataPointsColor2={categorical.blue}
              thickness={2}
              curved
              hideRules={false}
              rulesColor={chrome.gridline}
              yAxisColor={chrome.baseline}
              xAxisColor={chrome.baseline}
              yAxisTextStyle={{ color: chrome.muted, fontSize: 10 }}
              noOfSections={4}
              height={160}
              adjustToWidth
              initialSpacing={4}
              endSpacing={4}
            />
            <ChartLegend
              items={[
                { label: "গ্রস লাভ", color: categorical.aqua },
                { label: "নিট লাভ", color: categorical.blue },
              ]}
            />
          </>
        ) : (
          <Text style={styles.empty}>যথেষ্ট মাসের ডেটা নেই</Text>
        )}
      </ChartCard>

      <ChartCard title="বাকির বয়স বিশ্লেষণ (পাওনা)">
        {agingTotal > 0 ? (
          <View style={styles.donutRow}>
            <PieChart
              data={agingData}
              donut
              radius={70}
              innerRadius={45}
              innerCircleColor="#fff"
              centerLabelComponent={() => (
                <View style={{ alignItems: "center" }}>
                  <Text style={styles.donutCenterValue}>{taka(agingTotal)}</Text>
                  <Text style={styles.donutCenterLabel}>মোট পাওনা</Text>
                </View>
              )}
            />
            <View style={{ flex: 1, marginLeft: 16 }}>
              {aging.map((a) => (
                <View key={a.bucket} style={styles.legendLine}>
                  <View style={[styles.dot, { backgroundColor: agingColor[a.bucket] }]} />
                  <Text style={styles.legendText}>
                    {a.bucket} দিন: {taka(a.total)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.empty}>কোনো বাকি নেই</Text>
        )}
      </ChartCard>

      <ChartCard title="খরচের বিশ্লেষণ (তারিখ অনুযায়ী)">
        <View style={{ marginBottom: 12 }}>
          <DateRangePicker value={expRange} onChange={setExpRange} />
        </View>

        <View style={styles.expTotalRow}>
          <Text style={styles.expTotalLabel}>{expRange.label ?? "নির্বাচিত সময়ের"} মোট খরচ</Text>
          <Text style={styles.expTotalValue}>{taka(expTotal)}</Text>
        </View>

        {expDays.length > 0 ? (
          <>
            <Text style={styles.subTitle}>দিনে দিনে</Text>
            <BarChart
              width={chartW}
              data={expDays.map((d) => ({
                value: d.amount,
                // অনেক দিন হলে সব তারিখ লিখলে পড়া যায় না — তাই শুধু
                // দিনের সংখ্যাটা, আর ১৫ দিনের বেশি হলে একটা করে বাদ
                label:
                  expDays.length > 15 && Number(d.day.slice(8, 10)) % 2 === 0
                    ? ""
                    : d.day.slice(8, 10),
                frontColor: categorical.orange,
              }))}
              barWidth={expDays.length > 15 ? 8 : 16}
              spacing={expDays.length > 15 ? 4 : 10}
              hideRules={false}
              rulesColor={chrome.gridline}
              yAxisColor={chrome.baseline}
              xAxisColor={chrome.baseline}
              yAxisTextStyle={{ color: chrome.muted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: chrome.muted, fontSize: 9 }}
              noOfSections={4}
              height={150}
              initialSpacing={6}
              endSpacing={6}
            />

            <Text style={styles.subTitle}>কোন খাতে কত</Text>
            {expCats.map((c) => {
              const pct = expTotal > 0 ? Math.round((c.amount / expTotal) * 100) : 0;
              return (
                <View key={c.name} style={styles.expCatRow}>
                  <View style={styles.expCatTop}>
                    <Text style={styles.expCatName} numberOfLines={1}>
                      {c.name} <Text style={styles.expCatCount}>({c.count})</Text>
                    </Text>
                    <Text style={styles.expCatAmt}>
                      {taka(c.amount)} <Text style={styles.expCatPct}>{pct}%</Text>
                    </Text>
                  </View>
                  <View style={styles.expBarTrack}>
                    <View style={[styles.expBarFill, { width: `${Math.max(pct, 2)}%` }]} />
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <Text style={styles.empty}>এই সময়ে কোনো খরচ নেই — উপরের তারিখ বদলে দেখুন</Text>
        )}
      </ChartCard>

      <ChartCard title="এই মাসের খরচের বিভাজন">
        {expenseTotal > 0 ? (
          <View style={styles.donutRow}>
            <PieChart
              data={expenseData}
              donut
              radius={70}
              innerRadius={45}
              innerCircleColor="#fff"
              centerLabelComponent={() => (
                <View style={{ alignItems: "center" }}>
                  <Text style={styles.donutCenterValue}>{taka(expenseTotal)}</Text>
                  <Text style={styles.donutCenterLabel}>মোট খরচ</Text>
                </View>
              )}
            />
            <View style={{ flex: 1, marginLeft: 16 }}>
              {expenses.slice(0, 6).map((e, i) => (
                <View key={e.name} style={styles.legendLine}>
                  <View style={[styles.dot, { backgroundColor: expensePalette[i % expensePalette.length] }]} />
                  <Text style={styles.legendText} numberOfLines={1}>
                    {e.name}: {taka(e.total)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.empty}>এই মাসে এখনো কোনো খরচ নেই</Text>
        )}
      </ChartCard>

      <ChartCard title="সেরা ৫ পণ্য (৩০ দিন)">
        {productBarData.length > 0 ? (
          <BarChart
              width={chartW}
            data={productBarData}
            horizontal
            barWidth={18}
            noOfSections={4}
            rulesColor={chrome.gridline}
            yAxisColor={chrome.baseline}
            xAxisColor={chrome.baseline}
            xAxisLabelTextStyle={{ color: chrome.textSecondary, fontSize: 10 }}
            height={5 * 34}
            labelWidth={110}
          />
        ) : (
          <Text style={styles.empty}>যথেষ্ট বিক্রয় ডেটা নেই</Text>
        )}
      </ChartCard>

      <ChartCard title="সেরা ৫ ক্রেতা (৩০ দিন)">
        {customerBarData.length > 0 ? (
          <>
            <BarChart
              width={chartW}
              data={customerBarData}
              horizontal
              barWidth={18}
              noOfSections={4}
              rulesColor={chrome.gridline}
              yAxisColor={chrome.baseline}
              xAxisColor={chrome.baseline}
                xAxisLabelTextStyle={{ color: chrome.textSecondary, fontSize: 10 }}
              height={5 * 34}
              labelWidth={110}
            />
            <View style={{ marginTop: 10 }}>
              {topCustomers.map((c) => (
                <Text key={c.id} style={styles.legendText}>
                  {c.name} — বাকি: {taka(c.due)}
                </Text>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.empty}>যথেষ্ট বিক্রয় ডেটা নেই</Text>
        )}
      </ChartCard>

      <ChartCard title="নগদ প্রবাহ (সাপ্তাহিক)">
        {cashFlow.length > 0 ? (
          <>
            <BarChart
              width={chartW}
              data={cashFlowData}
              barWidth={14}
              noOfSections={4}
              rulesColor={chrome.gridline}
              yAxisColor={chrome.baseline}
              xAxisColor={chrome.baseline}
              yAxisTextStyle={{ color: chrome.muted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: chrome.textSecondary, fontSize: 10 }}
              height={160}
            />
            <ChartLegend
              items={[
                { label: "ঢুকেছে", color: categorical.aqua },
                { label: "বের হয়েছে", color: categorical.orange },
              ]}
            />
          </>
        ) : (
          <Text style={styles.empty}>যথেষ্ট ডেটা নেই</Text>
        )}
      </ChartCard>

      <ChartCard title="স্টকের মূল্যের ধারা (৩০ দিন)">
        {stockTrend.length > 1 ? (
          <LineChart
              width={chartW}
            data={stockLine}
            color1={categorical.violet}
            dataPointsColor1={categorical.violet}
            thickness={2}
            curved
            hideDataPoints
            hideRules={false}
            rulesColor={chrome.gridline}
            yAxisColor={chrome.baseline}
            xAxisColor={chrome.baseline}
            yAxisTextStyle={{ color: chrome.muted, fontSize: 10 }}
            noOfSections={4}
            height={160}
            adjustToWidth
            initialSpacing={4}
            endSpacing={4}
          />
        ) : (
          <Text style={styles.empty}>যথেষ্ট দিনের ডেটা নেই</Text>
        )}
      </ChartCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 12 },
  subTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: chrome.muted,
    marginTop: 14,
    marginBottom: 8,
  },
  expTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  expTotalLabel: { fontSize: 12.5, color: chrome.muted, flex: 1 },
  expTotalValue: { fontSize: 18, fontWeight: "800", color: categorical.orange },
  expCatRow: { marginBottom: 11 },
  expCatTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5, gap: 10 },
  expCatName: { fontSize: 13, color: "#0f172a", fontWeight: "600", flex: 1 },
  expCatCount: { fontSize: 11, fontWeight: "500", color: "#94a3b8" },
  expCatAmt: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  expCatPct: { fontSize: 11, fontWeight: "500", color: "#94a3b8" },
  expBarTrack: { height: 6, backgroundColor: "#f1f5f9", borderRadius: 999, overflow: "hidden" },
  expBarFill: { height: 6, backgroundColor: categorical.orange, borderRadius: 999 },
  empty: { color: "#94a3b8", fontSize: 13, textAlign: "center", paddingVertical: 20 },
  donutRow: { flexDirection: "row", alignItems: "center" },
  donutCenterValue: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  donutCenterLabel: { fontSize: 10, color: "#94a3b8" },
  legendLine: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: "#334155", flexShrink: 1 },
  salesmanRow: { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  salesmanName: { fontSize: 13, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
});
