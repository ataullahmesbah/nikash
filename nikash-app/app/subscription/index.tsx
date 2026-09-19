import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { formatDateBn, taka, todayIso } from "@/lib/format";
import { ErrorText, FormField, PrimaryButton, SegmentedControl } from "@/components/form";
import { DateField } from "@/components/date-field";
import { Badge, Card, EmptyState, Section, theme } from "@/components/ui";
import { SkeletonDetail } from "@/components/skeleton";

type Company = {
  id: string;
  name: string;
  nikash_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  is_free: boolean;
  plans: { name_bn: string; price: number; duration_days: number } | null;
};

/** অফিস থেকে রেকর্ড করা (যাচাইকৃত) পেমেন্ট — ম্যানুয়াল এন্ট্রিও এখানে আসে */
type ReceiptRow = {
  id: string;
  amount: number;
  method: string;
  trx_id: string | null;
  created_at: string;
  platform_invoices: { invoice_no: string } | null;
};

type PaymentRow = {
  id: string;
  amount: number;
  method: string;
  trx_id: string;
  status: string;
  requested_at: string;
  reject_reason: string | null;
};

const METHOD_BN: Record<string, string> = {
  bkash: "বিকাশ",
  nagad: "নগদ",
  rocket: "রকেট",
  bank: "ব্যাংক",
  cash: "ক্যাশ",
  cheque: "চেক",
  card: "কার্ড",
};

const STATUS_LABEL: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" }> = {
  trial: { label: "ট্রায়াল", tone: "info" },
  active: { label: "সক্রিয়", tone: "success" },
  grace: { label: "গ্রেস পিরিয়ড", tone: "warning" },
  readonly: { label: "শুধু-দেখা", tone: "warning" },
  blocked: { label: "ব্লক করা", tone: "danger" },
};

export default function SubscriptionScreen() {
  const { profile } = useAuth();
  const toast = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"bkash" | "nagad" | "rocket" | "bank">("bkash");
  const [trxId, setTrxId] = useState("");
  const [payDate, setPayDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const [companyRes, payRes, receiptRes, setRes] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, nikash_id, status, start_date, end_date, is_free, plans(name_bn, price, duration_days)")
        .eq("id", profile.company_id)
        .maybeSingle(),
      supabase
        .from("payment_requests")
        .select("id, amount, method, trx_id, status, requested_at, reject_reason")
        .eq("company_id", profile.company_id)
        .order("requested_at", { ascending: false })
        .limit(30),
      // যাচাইকৃত পেমেন্ট — অ্যাপ থেকে পাঠানো ও অফিসে হাতে দেওয়া, দুটোই
      supabase
        .from("platform_payments")
        .select("id, amount, method, trx_id, created_at, platform_invoices(invoice_no)")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("platform_settings").select("value").eq("key", "public.payment_numbers").maybeSingle(),
    ]);
    setCompany(companyRes.data as unknown as Company);
    setPayments((payRes.data ?? []) as PaymentRow[]);
    setReceipts((receiptRes.data ?? []) as unknown as ReceiptRow[]);
    setNumbers((setRes.data?.value as Record<string, string>) ?? {});
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function submitPayment() {
    if (!profile) return;
    if (!amount || Number(amount) <= 0) {
      setError("সঠিক টাকার পরিমাণ দিন");
      return;
    }
    if (!trxId.trim()) {
      setError("ট্রানজেকশন আইডি (TrxID) দিন");
      return;
    }
    setError(null);
    setSaving(true);
    const { error: insErr } = await supabase.from("payment_requests").insert({
      company_id: profile.company_id,
      amount: Number(amount),
      method,
      trx_id: trxId.trim(),
      requested_by: profile.id,
      requested_at: new Date(payDate).toISOString(),
    });
    setSaving(false);
    if (insErr) {
      setError(insErr.message.includes("duplicate") ? "এই TrxID আগেই জমা দেওয়া হয়েছে" : "জমা দেওয়া যায়নি");
      return;
    }
    toast.success("পেমেন্ট জমা হয়েছে — যাচাইয়ের পর মেয়াদ বাড়বে");
    setShowForm(false);
    setAmount("");
    setTrxId("");
    load();
  }

  if (loading || !company) return <SkeletonDetail />;

  const daysLeft = company.end_date
    ? Math.ceil((new Date(company.end_date).getTime() - Date.now()) / 86400000)
    : null;
  const st = STATUS_LABEL[company.status] ?? { label: company.status, tone: "info" as const };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      data={payments}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <View>
          <Stack.Screen options={{ title: "আমার সাবস্ক্রিপশন", headerShown: true }} />

          <Card style={styles.planCard}>
            <View style={styles.planHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{company.plans?.name_bn ?? "ট্রায়াল"}</Text>
                <Text style={styles.planMeta}>
                  {company.name} · {company.nikash_id}
                </Text>
              </View>
              <Badge label={st.label} tone={st.tone} />
            </View>

            <View style={styles.planRows}>
              <PlanRow label="শুরু" value={formatDateBn(company.start_date)} />
              <PlanRow label="মেয়াদ শেষ" value={company.is_free ? "লাইফটাইম ফ্রি" : formatDateBn(company.end_date)} />
              {!company.is_free && daysLeft !== null && (
                <PlanRow
                  label="বাকি দিন"
                  value={daysLeft > 0 ? `${daysLeft} দিন` : "মেয়াদ শেষ"}
                  color={daysLeft <= 3 ? theme.danger : daysLeft <= 7 ? theme.warning : theme.success}
                />
              )}
              {company.plans && <PlanRow label="প্ল্যান মূল্য" value={taka(company.plans.price)} />}
            </View>
          </Card>

          {!company.is_free && (
            <>
              {!showForm ? (
                <PrimaryButton title="💳 নতুন পেমেন্ট জমা দিন" onPress={() => setShowForm(true)} tone="success" />
              ) : (
                <Card style={{ marginTop: 4 }}>
                  <Text style={styles.formTitle}>পেমেন্ট জমা দিন</Text>

                  {Object.keys(numbers).length > 0 && (
                    <View style={styles.numbersBox}>
                      <Text style={styles.numbersTitle}>যে নম্বরে টাকা পাঠাবেন:</Text>
                      {numbers.bkash ? <Text style={styles.numberLine}>বিকাশ: {numbers.bkash}</Text> : null}
                      {numbers.nagad ? <Text style={styles.numberLine}>নগদ: {numbers.nagad}</Text> : null}
                      {numbers.rocket ? <Text style={styles.numberLine}>রকেট: {numbers.rocket}</Text> : null}
                      {numbers.bank ? <Text style={styles.numberLine}>ব্যাংক: {numbers.bank}</Text> : null}
                    </View>
                  )}

                  <SegmentedControl
                    value={method}
                    onChange={setMethod}
                    options={[
                      { label: "বিকাশ", value: "bkash" },
                      { label: "নগদ", value: "nagad" },
                      { label: "রকেট", value: "rocket" },
                    ]}
                  />
                  <FormField label="কত টাকা পাঠিয়েছেন *" value={amount} onChangeText={setAmount} keyboardType="numeric" />
                  <FormField label="ট্রানজেকশন আইডি (TrxID) *" value={trxId} onChangeText={setTrxId} autoCapitalize="characters" />
                  <DateField label="পেমেন্টের তারিখ" value={payDate} onChange={setPayDate} maximumDate={new Date()} />

                  <ErrorText>{error}</ErrorText>
                  <View style={{ gap: 8 }}>
                    <PrimaryButton title="জমা দিন" onPress={submitPayment} loading={saving} tone="success" />
                    <PrimaryButton title="বাতিল" onPress={() => setShowForm(false)} />
                  </View>
                </Card>
              )}
            </>
          )}

          {receipts.length > 0 && (
            <>
              <Section title="যাচাইকৃত পেমেন্ট ও ইনভয়েস" style={{ marginTop: 18, marginBottom: 8 }} />
              <Card style={{ marginBottom: 6 }}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>এ পর্যন্ত মোট পরিশোধ</Text>
                  <Text style={styles.totalValue}>
                    {taka(receipts.reduce((sum, r) => sum + Number(r.amount), 0))}
                  </Text>
                </View>
              </Card>
              {receipts.map((r) => (
                <View key={r.id} style={styles.payRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payAmount}>{taka(r.amount)}</Text>
                    <Text style={styles.payMeta}>
                      {METHOD_BN[r.method] ?? r.method}
                      {r.trx_id ? ` · ${r.trx_id}` : ""}
                    </Text>
                    <Text style={styles.payDate}>{formatDateBn(r.created_at)}</Text>
                  </View>
                  {r.platform_invoices?.invoice_no ? (
                    <Badge label={r.platform_invoices.invoice_no} tone="info" />
                  ) : (
                    <Badge label="রসিদ" tone="success" />
                  )}
                </View>
              ))}
            </>
          )}

          <Section title="আমার জমা দেওয়া পেমেন্ট" style={{ marginTop: 18, marginBottom: 8 }} />
        </View>
      }
      ListEmptyComponent={<EmptyState icon="🧾" title="কোনো পেমেন্ট নেই" message="পেমেন্ট জমা দিলে এখানে দেখা যাবে।" />}
      renderItem={({ item }) => {
        const tone =
          item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "warning";
        const label =
          item.status === "approved" ? "অনুমোদিত" : item.status === "rejected" ? "বাতিল" : "অপেক্ষমাণ";
        return (
          <View style={styles.payRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.payAmount}>{taka(item.amount)}</Text>
              <Text style={styles.payMeta}>
                {METHOD_BN[item.method] ?? item.method} · {item.trx_id}
              </Text>
              <Text style={styles.payDate}>{formatDateBn(item.requested_at)}</Text>
              {item.reject_reason ? <Text style={styles.rejectNote}>❌ {item.reject_reason}</Text> : null}
            </View>
            <Badge label={label} tone={tone} />
          </View>
        );
      }}
    />
  );
}

function PlanRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.planRow}>
      <Text style={styles.planRowLabel}>{label}</Text>
      <Text style={[styles.planRowValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  planCard: { marginBottom: 16, gap: 14 },
  planHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  planName: { fontSize: 19, fontWeight: "800", color: theme.text },
  planMeta: { fontSize: 12.5, color: theme.textMuted, marginTop: 3 },
  planRows: { backgroundColor: theme.surfaceAlt, borderRadius: 12, padding: 4 },
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  planRowLabel: { fontSize: 13, color: theme.textMuted },
  planRowValue: { fontSize: 13.5, fontWeight: "700", color: theme.text },
  formTitle: { fontSize: 15, fontWeight: "700", color: theme.text, marginBottom: 12 },
  numbersBox: { backgroundColor: theme.infoBg, borderRadius: 12, padding: 12, marginBottom: 14 },
  numbersTitle: { fontSize: 12, fontWeight: "700", color: theme.info, marginBottom: 6 },
  numberLine: { fontSize: 13, color: theme.text, marginTop: 2, fontWeight: "600" },
  payRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 8,
  },
  payAmount: { fontSize: 16, fontWeight: "800", color: theme.text },
  payMeta: { fontSize: 12, color: theme.textMuted, marginTop: 3 },
  payDate: { fontSize: 11, color: theme.textFaint, marginTop: 3 },
  rejectNote: { fontSize: 11.5, color: theme.danger, marginTop: 5 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 13, color: theme.textMuted },
  totalValue: { fontSize: 17, fontWeight: "800", color: theme.success },
});
