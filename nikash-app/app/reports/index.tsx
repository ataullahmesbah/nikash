import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { monthToDateRange, DateRangePicker } from "@/components/date-range-picker";
import { formatDateBn, taka, type DateRange } from "@/lib/format";
import { Card, Section, StatCard, theme } from "@/components/ui";
import { SkeletonList } from "@/components/skeleton";

type Report = {
  sales: number;
  cogs: number;
  grossProfit: number;
  expense: number;
  netProfit: number;
  purchase: number;
  collection: number;
  payment: number;
  topProducts: { name: string; qty: number; total: number }[];
  topCustomers: { name: string; total: number }[];
  expenseByCat: { name: string; total: number }[];
};

const EMPTY: Report = {
  sales: 0, cogs: 0, grossProfit: 0, expense: 0, netProfit: 0,
  purchase: 0, collection: 0, payment: 0,
  topProducts: [], topCustomers: [], expenseByCat: [],
};

export default function ReportsScreen() {
  const { profile } = useAuth();
  const [range, setRange] = useState<DateRange>(monthToDateRange());
  const [r, setR] = useState<Report>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const cid = profile.company_id;

    const [summaryRes, salesRes, expenseRes] = await Promise.all([
      supabase
        .from("daily_summaries")
        .select("sales_total, purchase_total, collection_total, payment_total, expense_total, cogs_total, gross_profit, net_profit")
        .eq("company_id", cid)
        .gte("summary_date", range.from)
        .lte("summary_date", range.to),
      supabase
        .from("sales")
        .select("id, total, customer_id, parties:customer_id(name)")
        .eq("company_id", cid)
        .eq("status", "posted")
        .gte("entry_date", range.from)
        .lte("entry_date", range.to),
      supabase
        .from("expenses")
        .select("amount, expense_categories(name_bn)")
        .eq("company_id", cid)
        .eq("status", "approved")
        .gte("entry_date", range.from)
        .lte("entry_date", range.to),
    ]);

    const rows = summaryRes.data ?? [];
    const sum = (k: string) => rows.reduce((s, x) => s + Number((x as Record<string, unknown>)[k] ?? 0), 0);

    // সেরা ক্রেতা
    const custMap = new Map<string, { name: string; total: number }>();
    (salesRes.data ?? []).forEach((s) => {
      const name = (s.parties as unknown as { name: string } | null)?.name ?? "নগদ ক্রেতা";
      const e = custMap.get(name) ?? { name, total: 0 };
      e.total += Number(s.total);
      custMap.set(name, e);
    });

    // সেরা পণ্য
    const saleIds = (salesRes.data ?? []).map((s) => s.id);
    const prodMap = new Map<string, { name: string; qty: number; total: number }>();
    if (saleIds.length > 0) {
      const { data: items } = await supabase
        .from("sale_items")
        .select("qty_base, total, product_variants(name, products(name))")
        .in("sale_id", saleIds.slice(0, 500));
      (items ?? []).forEach((it) => {
        const v = it.product_variants as unknown as { name: string; products: { name: string } | null } | null;
        const name = v ? `${v.products?.name ?? ""} (${v.name})` : "—";
        const e = prodMap.get(name) ?? { name, qty: 0, total: 0 };
        e.qty += Number(it.qty_base);
        e.total += Number(it.total);
        prodMap.set(name, e);
      });
    }

    // খরচের ক্যাটাগরি
    const expMap = new Map<string, number>();
    (expenseRes.data ?? []).forEach((e) => {
      const name = (e.expense_categories as unknown as { name_bn: string } | null)?.name_bn ?? "অন্যান্য";
      expMap.set(name, (expMap.get(name) ?? 0) + Number(e.amount));
    });

    setR({
      sales: sum("sales_total"),
      cogs: sum("cogs_total"),
      grossProfit: sum("gross_profit"),
      expense: sum("expense_total"),
      netProfit: sum("net_profit"),
      purchase: sum("purchase_total"),
      collection: sum("collection_total"),
      payment: sum("payment_total"),
      topProducts: Array.from(prodMap.values()).sort((a, b) => b.total - a.total).slice(0, 5),
      topCustomers: Array.from(custMap.values()).sort((a, b) => b.total - a.total).slice(0, 5),
      expenseByCat: Array.from(expMap.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    });
    setLoading(false);
  }, [profile, range]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: "রিপোর্ট", headerShown: true }} />

      <Card style={{ marginBottom: 18, paddingVertical: 12 }}>
        <DateRangePicker value={range} onChange={setRange} />
        <Text style={styles.rangeNote}>
          {formatDateBn(range.from)} থেকে {formatDateBn(range.to)}
        </Text>
      </Card>

      {loading ? (
        <SkeletonList rows={5} />
      ) : (
        <>
          <Section title="লাভ-ক্ষতি (P&L)">
            <Card>
              <PLRow label="মোট বিক্রয়" value={taka(r.sales)} />
              <PLRow label="− বিক্রীত পণ্যের ক্রয়মূল্য (COGS)" value={taka(r.cogs)} />
              <PLRow label="= গ্রস লাভ" value={taka(r.grossProfit)} bold color={theme.success} />
              <PLRow label="− পরিচালন খরচ" value={taka(r.expense)} />
              <PLRow
                label="= নিট লাভ"
                value={taka(r.netProfit)}
                bold
                color={r.netProfit >= 0 ? theme.success : theme.danger}
              />
            </Card>
          </Section>

          <Section title="নগদ প্রবাহ">
            <View style={styles.grid}>
              <StatCard label="আদায়" value={taka(r.collection)} tone="success" />
              <StatCard label="পরিশোধ" value={taka(r.payment)} tone="warning" />
              <StatCard label="ক্রয়" value={taka(r.purchase)} />
              <StatCard label="খরচ" value={taka(r.expense)} tone="danger" />
            </View>
          </Section>

          <Section title="সেরা ৫ পণ্য">
            <Card>
              {r.topProducts.length === 0 ? (
                <Text style={styles.empty}>এই সময়ে কোনো বিক্রয় নেই</Text>
              ) : (
                r.topProducts.map((p, i) => (
                  <PLRow key={p.name} label={`${i + 1}. ${p.name}`} value={taka(p.total)} />
                ))
              )}
            </Card>
          </Section>

          <Section title="সেরা ৫ ক্রেতা">
            <Card>
              {r.topCustomers.length === 0 ? (
                <Text style={styles.empty}>এই সময়ে কোনো বিক্রয় নেই</Text>
              ) : (
                r.topCustomers.map((c, i) => (
                  <PLRow key={c.name} label={`${i + 1}. ${c.name}`} value={taka(c.total)} />
                ))
              )}
            </Card>
          </Section>

          <Section title="খরচের বিভাজন">
            <Card>
              {r.expenseByCat.length === 0 ? (
                <Text style={styles.empty}>এই সময়ে কোনো খরচ নেই</Text>
              ) : (
                r.expenseByCat.map((e) => <PLRow key={e.name} label={e.name} value={taka(e.total)} />)
              )}
            </Card>
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function PLRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={styles.plRow}>
      <Text style={[styles.plLabel, bold && { fontWeight: "700", color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.plValue, bold && { fontWeight: "800" }, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rangeNote: { fontSize: 11.5, color: theme.textFaint, marginTop: 8, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  plRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  plLabel: { flex: 1, fontSize: 13, color: theme.textMuted },
  plValue: { fontSize: 14, color: theme.text, fontWeight: "600" },
  empty: { fontSize: 13, color: theme.textFaint, textAlign: "center", paddingVertical: 14 },
});
