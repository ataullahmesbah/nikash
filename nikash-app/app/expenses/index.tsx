import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { loadWithCache } from "@/lib/list-cache";
import { formatDateBn, presetRange, taka, type DateRange } from "@/lib/format";
import { PrimaryButton } from "@/components/form";
import { SearchBar } from "@/components/search-bar";
import { DateRangePicker } from "@/components/date-range-picker";
import { RowActions } from "@/components/row-actions";
import { Badge, Card, EmptyState, theme } from "@/components/ui";
import { SkeletonList } from "@/components/skeleton";

type ExpenseRow = {
  id: string;
  title: string;
  amount: number;
  entry_date: string;
  paid_from: string;
  status: string;
  expense_categories: { name_bn: string } | null;
};

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  approved: { label: "অনুমোদিত", tone: "success" },
  pending: { label: "অপেক্ষমাণ", tone: "warning" },
  rejected: { label: "বাতিল", tone: "danger" },
  void: { label: "বাতিল", tone: "danger" },
};

const METHOD_BN: Record<string, string> = {
  cash: "নগদ",
  bkash: "বিকাশ",
  nagad: "নগদ (Nagad)",
  rocket: "রকেট",
  bank: "ব্যাংক",
  cheque: "চেক",
};

export default function ExpensesScreen() {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [range, setRange] = useState<DateRange>(presetRange("month"));
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    // তারিখ পরিসর ক্যাশ-কি-তে রাখি, নইলে অফলাইনে আগের রেঞ্জ দেখাত
    const { data, stale: isStale } = await loadWithCache(
      `nikash:expenses-list:${profile.company_id}:${range.from}:${range.to}`,
      async () => {
        const { data, error } = await supabase
          .from("expenses")
          .select("id, title, amount, entry_date, paid_from, status, expense_categories(name_bn)")
          .eq("company_id", profile.company_id)
          .gte("entry_date", range.from)
          .lte("entry_date", range.to)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        return (data as unknown as ExpenseRow[]) ?? [];
      }
    );
    setExpenses(data);
    setStale(isStale);
    setLoading(false);
  }, [profile, range.from, range.to]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ক্যাটাগরির তালিকা — যেগুলোতে সত্যিই খরচ আছে শুধু সেগুলোই চিপে দেখাই
  const categories = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => set.add(e.expense_categories?.name_bn ?? "অন্যান্য"));
    return [...set].sort();
  }, [expenses]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      const cat = e.expense_categories?.name_bn ?? "অন্যান্য";
      if (category !== "all" && cat !== category) return false;
      if (!q) return true;
      return e.title.toLowerCase().includes(q) || cat.toLowerCase().includes(q);
    });
  }, [expenses, search, category]);

  // বাতিল খরচ যোগফলে ধরা যাবে না
  const live = useMemo(() => visible.filter((e) => e.status === "approved"), [visible]);
  const total = useMemo(() => live.reduce((s, e) => s + Number(e.amount), 0), [live]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of live) {
      const cat = e.expense_categories?.name_bn ?? "অন্যান্য";
      map.set(cat, (map.get(cat) ?? 0) + Number(e.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [live]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: "খরচ", headerShown: true }} />

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 6 }}>
            <PrimaryButton title="+ নতুন খরচ" onPress={() => router.push("/expenses/new")} />

            <DateRangePicker value={range} onChange={setRange} />

            <SearchBar value={search} onChange={setSearch} placeholder="খরচের শিরোনাম বা ক্যাটাগরি..." />

            {categories.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Pressable
                  style={[styles.chip, category === "all" && styles.chipOn]}
                  onPress={() => setCategory("all")}
                >
                  <Text style={[styles.chipText, category === "all" && styles.chipTextOn]}>সব</Text>
                </Pressable>
                {categories.map((c) => (
                  <Pressable
                    key={c}
                    style={[styles.chip, category === c && styles.chipOn]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Card>
              <View style={styles.totalRow}>
                <View>
                  <Text style={styles.totalLabel}>
                    {range.label ?? "নির্বাচিত সময়ের"} মোট খরচ
                  </Text>
                  <Text style={styles.totalCount}>{live.length} টি এন্ট্রি</Text>
                </View>
                <Text style={styles.totalValue}>{taka(total)}</Text>
              </View>
            </Card>

            {byCategory.length > 0 && (
              <Card>
                <Text style={styles.blockTitle}>কোন খাতে কত</Text>
                {byCategory.map(([name, amt]) => {
                  const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
                  return (
                    <View key={name} style={styles.catRow}>
                      <View style={styles.catTop}>
                        <Text style={styles.catName}>{name}</Text>
                        <Text style={styles.catAmt}>
                          {taka(amt)} <Text style={styles.catPct}>({pct}%)</Text>
                        </Text>
                      </View>
                      {/* সহজ বার — চোখেই বোঝা যায় কোন খাত বড় */}
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${Math.max(pct, 2)}%` }]} />
                      </View>
                    </View>
                  );
                })}
                <Pressable style={styles.analyticsLink} onPress={() => router.push("/analytics")}>
                  <Text style={styles.analyticsText}>📈 দিন-ভিত্তিক বিশ্লেষণ দেখুন</Text>
                </Pressable>
              </Card>
            )}

            {stale && <Text style={styles.offlineBanner}>অফলাইন — শেষবার লোড হওয়া তালিকা দেখাচ্ছে</Text>}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonList rows={5} />
          ) : (
            <EmptyState
              icon="💸"
              title={search || category !== "all" ? "কিছু পাওয়া যায়নি" : "এই সময়ে কোনো খরচ নেই"}
              message="উপরের তারিখ বদলে অন্য সময়ের খরচ দেখুন।"
              action={{ label: "+ নতুন খরচ", onPress: () => router.push("/expenses/new") }}
            />
          )
        }
        renderItem={({ item }) => {
          const st = STATUS[item.status] ?? { label: item.status, tone: "warning" as const };
          return (
            <Card>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.meta}>
                    {item.expense_categories?.name_bn ?? "অন্যান্য"} ·{" "}
                    {METHOD_BN[item.paid_from] ?? item.paid_from}
                  </Text>
                  <Text style={styles.date}>{formatDateBn(item.entry_date, true)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 5 }}>
                  <Text style={styles.amount}>{taka(item.amount)}</Text>
                  {item.status !== "approved" && <Badge label={st.label} tone={st.tone} />}
                </View>
              </View>

              {item.status !== "void" && (
                <RowActions
                  table="expenses"
                  id={item.id}
                  editHref={`/expenses/new?editId=${item.id}`}
                  label="খরচটি"
                  deleteMessage="খরচটি সরে যাবে এবং ওই দিনের লাভ-ক্ষতির হিসাব আবার মিলিয়ে নেওয়া হবে।"
                  onDone={load}
                />
              )}
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32, gap: 10 },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.textMuted },
  chipTextOn: { color: "#fff" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 13, color: theme.textMuted },
  totalCount: { fontSize: 11.5, color: theme.textFaint, marginTop: 3 },
  totalValue: { fontSize: 22, fontWeight: "800", color: theme.danger },
  blockTitle: { fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 10 },
  catRow: { marginBottom: 12 },
  catTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  catName: { fontSize: 13.5, color: theme.text, fontWeight: "600", flex: 1 },
  catAmt: { fontSize: 13.5, fontWeight: "700", color: theme.text },
  catPct: { fontSize: 11.5, fontWeight: "500", color: theme.textFaint },
  barTrack: { height: 6, backgroundColor: theme.surfaceAlt, borderRadius: 999, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: theme.danger, borderRadius: 999 },
  analyticsLink: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: theme.surfaceAlt,
    borderRadius: 10,
  },
  analyticsText: { fontSize: 13, fontWeight: "600", color: theme.accent },
  offlineBanner: {
    padding: 8,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: theme.warning,
    backgroundColor: theme.warningBg,
    borderRadius: 8,
  },
  title: { fontSize: 15, fontWeight: "600", color: theme.text },
  meta: { fontSize: 12, color: theme.textMuted, marginTop: 3 },
  date: { fontSize: 11.5, color: theme.textFaint, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: "800", color: theme.text },
});
