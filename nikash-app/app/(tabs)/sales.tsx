import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { loadWithCache } from "@/lib/list-cache";
import { formatDateBn, presetRange, taka, type DateRange } from "@/lib/format";
import { PrimaryButton } from "@/components/form";
import { SearchBar } from "@/components/search-bar";
import { DateRangePicker } from "@/components/date-range-picker";
import { Badge, Card, EmptyState, theme } from "@/components/ui";
import { SkeletonList } from "@/components/skeleton";

type SaleRow = {
  id: string;
  invoice_no: string;
  entry_date: string;
  total: number;
  due: number;
  status: "draft" | "posted" | "void";
  is_walk_in: boolean;
  walk_in_name: string | null;
  parties: { name: string } | null;
};

const STATUS: Record<string, { label: string; tone: "warning" | "success" | "danger" }> = {
  draft: { label: "ড্রাফট", tone: "warning" },
  posted: { label: "পোস্টেড", tone: "success" },
  void: { label: "বাতিল", tone: "danger" },
};

const FILTERS = [
  { key: "all", label: "সব" },
  { key: "posted", label: "পোস্টেড" },
  { key: "draft", label: "ড্রাফট" },
  { key: "due", label: "বাকি আছে" },
] as const;

export default function SalesScreen() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>(presetRange("month"));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    // তারিখ পরিসর ক্যাশ-কি-তে রাখি, নইলে অফলাইনে আগের রেঞ্জের তালিকা দেখাত
    const { data, stale: isStale } = await loadWithCache(
      `nikash:sales-list:${profile.company_id}:${range.from}:${range.to}`,
      async () => {
        const { data, error } = await supabase
          .from("sales")
          .select(
            "id, invoice_no, entry_date, total, due, status, is_walk_in, walk_in_name, parties:customer_id(name)"
          )
          .eq("company_id", profile.company_id)
          .gte("entry_date", range.from)
          .lte("entry_date", range.to)
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(300);
        if (error) throw error;
        return (data as unknown as SaleRow[]) ?? [];
      }
    );
    setSales(data);
    setStale(isStale);
    setLoading(false);
  }, [profile, range.from, range.to]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (filter === "posted" && s.status !== "posted") return false;
      if (filter === "draft" && s.status !== "draft") return false;
      if (filter === "due" && !(s.due > 0 && s.status === "posted")) return false;
      if (!q) return true;
      const party = (s.parties?.name ?? s.walk_in_name ?? "").toLowerCase();
      return party.includes(q) || s.invoice_no.toLowerCase().includes(q);
    });
  }, [sales, search, filter]);

  // হেডারের যোগফল বাতিল চালান বাদ দিয়ে — নইলে হিসাব ফুলে যায়
  const totals = useMemo(() => {
    const live = visible.filter((s) => s.status !== "void");
    return {
      count: live.length,
      amount: live.reduce((sum, s) => sum + Number(s.total), 0),
      due: live.reduce((sum, s) => sum + Number(s.due), 0),
    };
  }, [visible]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={styles.top}>
        <PrimaryButton title="+ নতুন বিক্রয়" onPress={() => router.push("/sales/new")} />

        <View style={{ marginTop: 12 }}>
          <DateRangePicker value={range} onChange={setRange} />
        </View>

        <View style={{ marginTop: 10 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="চালান নম্বর বা ক্রেতার নাম..." />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Card style={styles.summary}>
          <SummaryCell label="চালান" value={String(totals.count)} />
          <View style={styles.divider} />
          <SummaryCell label="মোট বিক্রয়" value={taka(totals.amount)} />
          <View style={styles.divider} />
          <SummaryCell label="বাকি" value={taka(totals.due)} color={totals.due > 0 ? theme.danger : undefined} />
        </Card>
      </View>

      {stale && <Text style={styles.offlineBanner}>অফলাইন — শেষবার লোড হওয়া তালিকা দেখাচ্ছে</Text>}

      {loading ? (
        <SkeletonList rows={6} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="🧾"
              title={search || filter !== "all" ? "কিছু পাওয়া যায়নি" : "এই সময়ে কোনো বিক্রয় নেই"}
              message={
                search || filter !== "all"
                  ? "খোঁজা বা ফিল্টার বদলে দেখুন"
                  : "উপরের তারিখ বদলে অন্য সময়ের হিসাব দেখুন।"
              }
              action={{ label: "+ নতুন বিক্রয়", onPress: () => router.push("/sales/new") }}
            />
          }
          renderItem={({ item }) => {
            const st = STATUS[item.status];
            return (
              <Card onPress={() => router.push(`/sales/${item.id}`)} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.parties?.name ?? item.walk_in_name ?? "নগদ ক্রেতা"}
                  </Text>
                  <Text style={styles.meta}>
                    {item.invoice_no} · {formatDateBn(item.entry_date, true)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.total}>{taka(item.total)}</Text>
                  {item.due > 0 && item.status !== "void" ? (
                    <Text style={styles.due}>বাকি {taka(item.due)}</Text>
                  ) : null}
                  <Badge label={st.label} tone={st.tone} />
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

function SummaryCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingTop: 14 },
  filterRow: { gap: 8, paddingVertical: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.textMuted },
  chipTextActive: { color: "#fff" },
  summary: { flexDirection: "row", alignItems: "center", paddingVertical: 12, marginBottom: 4 },
  divider: { width: 1, height: 28, backgroundColor: theme.border },
  summaryLabel: { fontSize: 11, color: theme.textMuted },
  summaryValue: { fontSize: 15, fontWeight: "800", color: theme.text, marginTop: 3 },
  offlineBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 8,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: theme.warning,
    backgroundColor: theme.warningBg,
    borderRadius: 8,
  },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 15, fontWeight: "600", color: theme.text },
  meta: { fontSize: 12, color: theme.textMuted, marginTop: 3 },
  total: { fontSize: 15, fontWeight: "700", color: theme.text },
  due: { fontSize: 12, color: theme.danger },
});
