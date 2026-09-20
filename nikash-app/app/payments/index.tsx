import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { errorMessage, toastMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { formatDateBn, presetRange, taka, type DateRange } from "@/lib/format";
import { PrimaryButton } from "@/components/form";
import { SearchBar } from "@/components/search-bar";
import { DateRangePicker } from "@/components/date-range-picker";
import { ConfirmModal } from "@/components/confirm-modal";
import { Badge, Card, EmptyState, theme } from "@/components/ui";
import { SkeletonList } from "@/components/skeleton";

// লেনদেন খাতা — নগদ, বিকাশ, নগদ, রকেট, ব্যাংক, চেক — সব পেমেন্ট এক
// জায়গায়। আগে শুধু "নতুন পেমেন্ট" ফর্ম ছিল, তোলা টাকা কোথাও তালিকা
// আকারে দেখা যেত না।

type PaymentRow = {
  id: string;
  type: "customer_collection" | "supplier_payment";
  amount: number;
  method: string;
  entry_date: string;
  slip_no: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  purpose: string | null;
  purpose_note: string | null;
  parties: { name: string } | null;
};

const METHOD_BN: Record<string, string> = {
  cash: "নগদ",
  bkash: "বিকাশ",
  nagad: "নগদ (Nagad)",
  rocket: "রকেট",
  bank: "ব্যাংক",
  cheque: "চেক",
  card: "কার্ড",
};

const PURPOSE_BN: Record<string, string> = {
  due: "বাকি পরিশোধ",
  advance: "অগ্রিম",
  other: "অন্যান্য",
};

const METHOD_FILTERS = [
  { key: "all", label: "সব" },
  { key: "cash", label: "নগদ" },
  { key: "bkash", label: "বিকাশ" },
  { key: "nagad", label: "Nagad" },
  { key: "rocket", label: "রকেট" },
  { key: "bank", label: "ব্যাংক" },
  { key: "cheque", label: "চেক" },
] as const;

const TYPE_FILTERS = [
  { key: "all", label: "সব" },
  { key: "customer_collection", label: "↓ আদায়" },
  { key: "supplier_payment", label: "↑ পরিশোধ" },
] as const;

export default function PaymentLedgerScreen() {
  const { profile } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [range, setRange] = useState<DateRange>(presetRange("month"));
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<PaymentRow | null>(null);
  const [busy, setBusy] = useState(false);

  const canManage = profile?.role === "owner" || profile?.role === "manager";

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, type, amount, method, entry_date, slip_no, bank_name, bank_branch, purpose, purpose_note, parties:party_id(name)"
      )
      .eq("company_id", profile.company_id)
      .eq("status", "posted")
      .gte("entry_date", range.from)
      .lte("entry_date", range.to)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) toast.error("তালিকা আনা যায়নি");
    setRows((data as unknown as PaymentRow[]) ?? []);
    setLoading(false);
  }, [profile, range.from, range.to, toast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (method !== "all" && r.method !== method) return false;
      if (type !== "all" && r.type !== type) return false;
      if (!q) return true;
      return (
        (r.parties?.name ?? "").toLowerCase().includes(q) ||
        (r.slip_no ?? "").toLowerCase().includes(q) ||
        (r.bank_name ?? "").toLowerCase().includes(q) ||
        (r.purpose_note ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, method, type]);

  const totals = useMemo(() => {
    let received = 0;
    let paid = 0;
    for (const r of visible) {
      if (r.type === "customer_collection") received += Number(r.amount);
      else paid += Number(r.amount);
    }
    return { received, paid, net: received - paid, count: visible.length };
  }, [visible]);

  // মাধ্যম অনুযায়ী ভাগ — কোন মাধ্যমে কত এলো-গেলো
  const byMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of visible) {
      const sign = r.type === "customer_collection" ? 1 : -1;
      map.set(r.method, (map.get(r.method) ?? 0) + sign * Number(r.amount));
    }
    return [...map.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  }, [visible]);

  async function handleDelete() {
    if (!toDelete) return;
    const row = toDelete;
    setToDelete(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("void_payment", {
        p_payment: row.id,
        p_reason: "লেনদেন খাতা থেকে মুছে ফেলা হয়েছে",
      });
      if (error) throw error;
      toast.success(
        data === "already_void" ? "আগেই বাতিল করা ছিল" : "পেমেন্ট বাতিল হয়েছে, বাকি ফিরে গেছে"
      );
      load();
    } catch (e) {
      const msg = errorMessage(e, "বাতিল করা যায়নি");
      toast.error(msg.length > 70 ? "বাতিল করা যায়নি" : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: "লেনদেন খাতা", headerShown: true }} />

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 6 }}>
            <PrimaryButton
              title="+ নতুন পেমেন্ট"
              onPress={() => router.push("/payments/new")}
              tone="success"
            />

            <DateRangePicker value={range} onChange={setRange} />

            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="পার্টি, ব্যাংক বা স্লিপ নম্বর..."
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {TYPE_FILTERS.map((f) => (
                <Pressable
                  key={f.key}
                  style={[styles.chip, type === f.key && styles.chipOn]}
                  onPress={() => setType(f.key)}
                >
                  <Text style={[styles.chipText, type === f.key && styles.chipTextOn]}>{f.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {METHOD_FILTERS.map((f) => (
                <Pressable
                  key={f.key}
                  style={[styles.chip, method === f.key && styles.chipOn]}
                  onPress={() => setMethod(f.key)}
                >
                  <Text style={[styles.chipText, method === f.key && styles.chipTextOn]}>{f.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Card style={styles.summary}>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>↓ মোট আদায়</Text>
                <Text style={[styles.sumValue, { color: theme.success }]}>{taka(totals.received)}</Text>
              </View>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>↑ মোট পরিশোধ</Text>
                <Text style={[styles.sumValue, { color: theme.warning }]}>{taka(totals.paid)}</Text>
              </View>
              <View style={[styles.sumRow, styles.sumNet]}>
                <Text style={styles.sumNetLabel}>নিট নগদ প্রবাহ</Text>
                <Text
                  style={[styles.sumValue, { color: totals.net >= 0 ? theme.success : theme.danger }]}
                >
                  {taka(totals.net)}
                </Text>
              </View>
              <Text style={styles.sumNote}>
                {totals.count} টি লেনদেন · এটি লাভ নয়, হাতে আসা-যাওয়া টাকার হিসাব
              </Text>
            </Card>

            {byMethod.length > 0 && (
              <Card>
                <Text style={styles.blockTitle}>মাধ্যম অনুযায়ী</Text>
                {byMethod.map(([m, amt]) => (
                  <View key={m} style={styles.methodRow}>
                    <Text style={styles.methodName}>{METHOD_BN[m] ?? m}</Text>
                    <Text style={[styles.methodAmt, { color: amt >= 0 ? theme.success : theme.warning }]}>
                      {amt >= 0 ? "+" : "−"} {taka(Math.abs(amt))}
                    </Text>
                  </View>
                ))}
              </Card>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonList rows={5} />
          ) : (
            <EmptyState
              icon="💵"
              title={
                search || method !== "all" || type !== "all"
                  ? "কিছু পাওয়া যায়নি"
                  : "এই সময়ে কোনো লেনদেন নেই"
              }
              message="উপরের তারিখ বা ফিল্টার বদলে দেখুন।"
              action={{ label: "+ নতুন পেমেন্ট", onPress: () => router.push("/payments/new") }}
            />
          )
        }
        renderItem={({ item }) => {
          const isIn = item.type === "customer_collection";
          return (
            <Card>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.party} numberOfLines={1}>
                    {item.parties?.name ?? "—"}
                  </Text>
                  <Text style={styles.meta}>
                    {formatDateBn(item.entry_date, true)} · {METHOD_BN[item.method] ?? item.method}
                  </Text>
                  {item.bank_name ? (
                    <Text style={styles.sub}>
                      🏦 {item.bank_name}
                      {item.bank_branch ? ` · ${item.bank_branch}` : ""}
                    </Text>
                  ) : null}
                  {item.slip_no ? <Text style={styles.sub}>স্লিপ: {item.slip_no}</Text> : null}
                  {item.purpose_note ? <Text style={styles.sub}>{item.purpose_note}</Text> : null}
                </View>

                <View style={{ alignItems: "flex-end", gap: 5 }}>
                  <Text style={[styles.amount, { color: isIn ? theme.success : theme.warning }]}>
                    {isIn ? "+" : "−"} {taka(item.amount)}
                  </Text>
                  <Badge label={isIn ? "আদায়" : "পরিশোধ"} tone={isIn ? "success" : "warning"} />
                  {item.purpose ? (
                    <Text style={styles.purpose}>{PURPOSE_BN[item.purpose] ?? item.purpose}</Text>
                  ) : null}
                </View>
              </View>

              {canManage && (
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.action, { backgroundColor: theme.infoBg }]}
                    onPress={() => router.push(`/payments/new?editId=${item.id}`)}
                  >
                    <Text style={[styles.actionText, { color: theme.info }]}>✏️ সম্পাদনা</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.action, { backgroundColor: theme.dangerBg }]}
                    onPress={() => setToDelete(item)}
                    disabled={busy}
                  >
                    <Text style={[styles.actionText, { color: theme.danger }]}>🗑️ বাতিল</Text>
                  </Pressable>
                </View>
              )}
            </Card>
          );
        }}
      />

      <ConfirmModal
        visible={!!toDelete}
        title="পেমেন্ট বাতিল করবেন?"
        message={
          toDelete
            ? `${taka(toDelete.amount)} বাতিল হবে এবং এই টাকা আবার বাকিতে ফিরে যাবে। পুরনো রেকর্ড অডিট লগে থেকে যাবে।`
            : undefined
        }
        confirmLabel="হ্যাঁ, বাতিল করুন"
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
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
  summary: { gap: 2 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  sumLabel: { fontSize: 13.5, color: theme.textMuted },
  sumValue: { fontSize: 15.5, fontWeight: "800" },
  sumNet: { borderTopWidth: 1, borderTopColor: theme.border, marginTop: 6, paddingTop: 10 },
  sumNetLabel: { fontSize: 14, fontWeight: "700", color: theme.text },
  sumNote: { fontSize: 11, color: theme.textFaint, marginTop: 8, lineHeight: 16 },
  blockTitle: { fontSize: 14, fontWeight: "700", color: theme.text, marginBottom: 8 },
  methodRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  methodName: { fontSize: 13.5, color: theme.textMuted },
  methodAmt: { fontSize: 14, fontWeight: "700" },
  party: { fontSize: 15, fontWeight: "700", color: theme.text },
  meta: { fontSize: 12, color: theme.textMuted, marginTop: 3 },
  sub: { fontSize: 11.5, color: theme.textFaint, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: "800" },
  purpose: { fontSize: 10.5, color: theme.textFaint },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  action: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  actionText: { fontSize: 12.5, fontWeight: "700" },
});
