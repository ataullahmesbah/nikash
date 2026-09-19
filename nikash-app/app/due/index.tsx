import { useCallback, useMemo, useState } from "react";
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { taka, toBnDigits } from "@/lib/format";
import { SearchBar } from "@/components/search-bar";
import { SegmentedControl } from "@/components/form";
import { EmptyState, theme } from "@/components/ui";
import { SkeletonList } from "@/components/skeleton";

type DueParty = {
  party_id: string;
  party_name: string;
  party_phone: string | null;
  party_area: string | null;
  total_due: number;
  invoice_count: number;
  oldest_date: string;
  max_age_days: number;
};

// বয়স অনুযায়ী রঙ — ৬০+ দিন লাল (PRD ৯.২ #৭)
function ageTone(days: number) {
  if (days > 60) return { fg: theme.danger, bg: theme.dangerBg, label: "৬০+ দিন" };
  if (days > 30) return { fg: "#ea580c", bg: "#fff7ed", label: "৩১–৬০ দিন" };
  if (days > 15) return { fg: theme.warning, bg: theme.warningBg, label: "১৬–৩০ দিন" };
  return { fg: theme.success, bg: theme.successBg, label: "০–১৫ দিন" };
}

export default function DueScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { profile } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<"receivable" | "payable">(
    params.tab === "payable" ? "payable" : "receivable"
  );
  const [rows, setRows] = useState<DueParty[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"amount" | "age" | "name">("amount");
  const [loading, setLoading] = useState(true);
  // টেনে রিফ্রেশ করলে তবেই উপরের স্পিনার — পর্দায় ফিরলেই নয়
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    // পার্টি-ভিত্তিক সারসংক্ষেপ — চালান-ভিত্তিক নয়, কারণ ব্যবসায়ী
    // "কার কাছে কত" জানতে চায়, "কোন চালানে কত" নয়।
    const { data, error } = await supabase.rpc("party_due_summary", { p_type: tab });
    if (error) {
      toast.error("বাকির হিসাব আনা যায়নি");
      setRows([]);
    } else {
      setRows((data ?? []) as DueParty[]);
    }
    setLoading(false);
  }, [profile, tab, toast]);

  async function pullRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.party_name.toLowerCase().includes(q) ||
            (r.party_phone ?? "").includes(q) ||
            (r.party_area ?? "").toLowerCase().includes(q)
        )
      : rows;
    const sorted = [...filtered];
    if (sort === "amount") sorted.sort((a, b) => b.total_due - a.total_due);
    if (sort === "age") sorted.sort((a, b) => b.max_age_days - a.max_age_days);
    if (sort === "name") sorted.sort((a, b) => a.party_name.localeCompare(b.party_name));
    return sorted;
  }, [rows, search, sort]);

  const total = visible.reduce((s, r) => s + Number(r.total_due), 0);

  function call(phone: string | null) {
    if (!phone) {
      toast.warning("এই পার্টির ফোন নম্বর নেই");
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => toast.error("কল করা যায়নি"));
  }

  // WhatsApp রিমাইন্ডার — বাংলাদেশে এটাই সবচেয়ে কার্যকর আদায়ের উপায়
  function remind(row: DueParty) {
    if (!row.party_phone) {
      toast.warning("এই পার্টির ফোন নম্বর নেই");
      return;
    }
    const company = profile?.companies?.name ?? "";
    const msg =
      tab === "receivable"
        ? `প্রিয় ${row.party_name},\n\nআপনার কাছে আমাদের ${taka(row.total_due)} বাকি রয়েছে (${toBnDigits(row.invoice_count)}টি চালান, সবচেয়ে পুরনো ${toBnDigits(row.max_age_days)} দিন)।\n\nঅনুগ্রহ করে পরিশোধ করুন।\n\n— ${company}`
        : `প্রিয় ${row.party_name},\n\nআপনার ${taka(row.total_due)} পরিশোধের ব্যবস্থা করছি।\n\n— ${company}`;

    const phone = row.party_phone.replace(/[^0-9]/g, "").replace(/^0/, "880");
    Linking.openURL(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`).catch(() =>
      // WhatsApp না থাকলে SMS-এ পড়ে যাবে
      Linking.openURL(`sms:${row.party_phone}?body=${encodeURIComponent(msg)}`).catch(() =>
        toast.error("বার্তা পাঠানো যায়নি")
      )
    );
  }

  function collect(row: DueParty) {
    router.push({
      pathname: "/payments/new",
      params: {
        partyId: row.party_id,
        partyName: row.party_name,
        type: tab === "receivable" ? "customer_collection" : "supplier_payment",
        suggested: String(row.total_due),
      },
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: "বাকির হিসাব", headerShown: true }} />

      <View style={styles.top}>
        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v)}
          options={[
            { label: "পাওনা (ক্রেতা)", value: "receivable" },
            { label: "দেনা (সরবরাহকারী)", value: "payable" },
          ]}
        />

        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>
            {tab === "receivable" ? "মোট পাওনা" : "মোট দেনা"} · {toBnDigits(visible.length)} জন
          </Text>
          <Text style={[styles.totalValue, { color: tab === "receivable" ? theme.danger : theme.warning }]}>
            {taka(total)}
          </Text>
        </View>

        <SearchBar value={search} onChange={setSearch} placeholder="নাম, ফোন বা এলাকা দিয়ে খুঁজুন..." />

        <View style={styles.sortRow}>
          {([
            { key: "amount", label: "সবচেয়ে বেশি" },
            { key: "age", label: "সবচেয়ে পুরনো" },
            { key: "name", label: "নাম" },
          ] as const).map((s) => (
            <Pressable
              key={s.key}
              style={[styles.sortChip, sort === s.key && styles.sortChipActive]}
              onPress={() => setSort(s.key)}
            >
              <Text style={[styles.sortText, sort === s.key && styles.sortTextActive]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading && rows.length === 0 ? (
        <SkeletonList rows={5} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r) => r.party_id}
          contentContainerStyle={visible.length === 0 ? { flex: 1 } : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullRefresh} />}
          ListEmptyComponent={
            <EmptyState
              icon="✅"
              title={search ? "কিছু পাওয়া যায়নি" : "কোনো বাকি নেই"}
              message={search ? "অন্য নামে খুঁজে দেখুন।" : "সব হিসাব পরিষ্কার — দারুণ!"}
            />
          }
          renderItem={({ item }) => {
            const tone = ageTone(item.max_age_days);
            return (
              <View style={styles.card}>
                <Pressable
                  style={styles.cardHead}
                  onPress={() => router.push(`/parties/${item.party_id}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.party_name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {toBnDigits(item.invoice_count)}টি চালান
                      {item.party_area ? ` · ${item.party_area}` : ""}
                      {item.party_phone ? ` · ${item.party_phone}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.amount, { color: tone.fg }]}>{taka(item.total_due)}</Text>
                    <View style={[styles.ageBadge, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.ageText, { color: tone.fg }]}>{tone.label}</Text>
                    </View>
                  </View>
                </Pressable>

                <View style={styles.actions}>
                  <Pressable style={styles.action} onPress={() => call(item.party_phone)}>
                    <Text style={styles.actionText}>📞 কল</Text>
                  </Pressable>
                  <Pressable style={styles.action} onPress={() => remind(item)}>
                    <Text style={styles.actionText}>💬 রিমাইন্ডার</Text>
                  </Pressable>
                  <Pressable style={[styles.action, styles.actionPrimary]} onPress={() => collect(item)}>
                    <Text style={[styles.actionText, styles.actionTextPrimary]}>
                      {tab === "receivable" ? "💰 আদায়" : "💸 পরিশোধ"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { padding: 16, paddingBottom: 10, gap: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  totalBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  totalLabel: { fontSize: 13, color: theme.textMuted, fontWeight: "600" },
  totalValue: { fontSize: 20, fontWeight: "800" },
  sortRow: { flexDirection: "row", gap: 8 },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sortChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  sortText: { fontSize: 12, color: theme.textMuted, fontWeight: "600" },
  sortTextActive: { color: "#fff" },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: "hidden" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  name: { fontSize: 15.5, fontWeight: "700", color: theme.text },
  meta: { fontSize: 12, color: theme.textMuted, marginTop: 3 },
  amount: { fontSize: 18, fontWeight: "800" },
  ageBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginTop: 4 },
  ageText: { fontSize: 10.5, fontWeight: "700" },
  actions: { flexDirection: "row", borderTopWidth: 1, borderTopColor: theme.border },
  action: { flex: 1, paddingVertical: 11, alignItems: "center", borderRightWidth: 1, borderRightColor: theme.border },
  actionPrimary: { backgroundColor: theme.primary, borderRightWidth: 0 },
  actionText: { fontSize: 12.5, fontWeight: "700", color: theme.text },
  actionTextPrimary: { color: "#fff" },
});
