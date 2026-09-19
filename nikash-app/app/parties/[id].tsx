import { useCallback, useState } from "react";
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { shareLedgerPdf, type LedgerEntry } from "@/lib/ledger-pdf";
import { formatDateBn, taka } from "@/lib/format";
import { PrimaryButton, SegmentedControl } from "@/components/form";
import { ConfirmModal } from "@/components/confirm-modal";
import { Badge, EmptyState, theme } from "@/components/ui";
import { SkeletonDetail } from "@/components/skeleton";

type PartyDetail = {
  id: string;
  name: string;
  phone: string | null;
  alt_phone: string | null;
  whatsapp: string | null;
  type: "customer" | "supplier";
  area: string | null;
  address: string | null;
  thana: string | null;
  district: string | null;
  opening_balance: number;
  credit_limit: number;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string;
};

type Tab = "ledger" | "invoices" | "info";
type InvoiceRow = { id: string; invoice_no: string; entry_date: string; total: number; due: number };

export default function PartyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const toast = useToast();
  const [party, setParty] = useState<PartyDetail | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [tab, setTab] = useState<Tab>("ledger");
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const canManage = profile?.role === "owner" || profile?.role === "manager";

  const load = useCallback(async () => {
    setLoading(true);
    const { data: partyData } = await supabase
      .from("parties")
      .select(
        "id, name, phone, alt_phone, whatsapp, type, area, address, thana, district, opening_balance, credit_limit, latitude, longitude, status, created_at"
      )
      .eq("id", id)
      .maybeSingle();
    if (!partyData) {
      setLoading(false);
      return;
    }
    setParty(partyData as PartyDetail);

    const isCustomer = partyData.type === "customer";
    const invoiceTable = isCustomer ? "sales" : "purchases";
    const invoiceFk = isCustomer ? "customer_id" : "supplier_id";
    const paymentType = isCustomer ? "customer_collection" : "supplier_payment";

    const [invoicesRes, paymentsRes] = await Promise.all([
      supabase
        .from(invoiceTable)
        .select("id, entry_date, invoice_no, total, due")
        .eq(invoiceFk, id)
        .eq("status", "posted")
        .order("entry_date", { ascending: false }),
      supabase
        .from("payments")
        .select("entry_date, amount, method")
        .eq("party_id", id)
        .eq("type", paymentType)
        .eq("status", "posted"),
    ]);

    const inv = (invoicesRes.data ?? []) as InvoiceRow[];
    setInvoices(inv);

    const invoiceEntries: LedgerEntry[] = inv.map((r) => ({
      date: r.entry_date,
      description: `চালান ${r.invoice_no}`,
      debit: Number(r.total),
      credit: 0,
    }));
    const paymentEntries: LedgerEntry[] = (paymentsRes.data ?? []).map((r) => ({
      date: r.entry_date,
      description: `পেমেন্ট (${r.method})`,
      debit: 0,
      credit: Number(r.amount),
    }));

    setEntries([...invoiceEntries, ...paymentEntries].sort((a, b) => a.date.localeCompare(b.date)));
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const balance =
    (party?.opening_balance ?? 0) + entries.reduce((sum, e) => sum + e.debit - e.credit, 0);

  async function handleShare() {
    if (!party) return;
    setSharing(true);
    try {
      await shareLedgerPdf({
        companyName: profile?.companies?.name ?? "",
        partyName: party.name,
        partyPhone: party.phone,
        openingBalance: party.opening_balance,
        entries,
        closingBalance: balance,
      });
    } catch {
      toast.error("PDF তৈরি করা যায়নি");
    } finally {
      setSharing(false);
    }
  }

  // কাজ বন্ধ / আবার চালু — মুছে ফেলা নয়, তাই পুরনো বিল ও বাকি ঠিকই থাকে
  async function toggleStatus() {
    if (!party) return;
    const next = party.status === "active" ? "closed" : "active";
    setStatusBusy(true);
    try {
      const { data, error } = await supabase.rpc("set_party_status", {
        p_party: party.id,
        p_status: next,
        p_reason: null,
      });
      if (error) throw error;

      if (typeof data === "string" && data.startsWith("closed_with_due:")) {
        const amount = Number(data.split(":")[1] ?? 0);
        toast.warning(`কাজ বন্ধ করা হলো — তবে ${taka(amount)} বাকি এখনো আদায় হয়নি`);
      } else {
        toast.success(next === "active" ? "আবার চালু করা হলো" : "কাজ বন্ধ করা হলো");
      }
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "বদলানো যায়নি";
      toast.error(msg.length > 70 ? "বদলানো যায়নি" : msg);
    } finally {
      setStatusBusy(false);
      setShowStatusConfirm(false);
    }
  }

  async function handleDelete() {
    if (!party) return;
    setShowDelete(false);
    const { data, error } = await supabase.rpc("delete_party", { p_party: party.id });
    if (error) {
      toast.error("মুছে ফেলা যায়নি");
      return;
    }
    if (data === "deactivated") {
      toast.warning("লেনদেন থাকায় মুছে ফেলা যায়নি — নিষ্ক্রিয় করা হয়েছে");
    } else {
      toast.success("পার্টি মুছে ফেলা হয়েছে");
    }
    router.back();
  }

  function contact(kind: "call" | "whatsapp") {
    const num = kind === "whatsapp" ? party?.whatsapp || party?.phone : party?.phone;
    if (!num) {
      toast.warning("নম্বর নেই");
      return;
    }
    const url =
      kind === "whatsapp"
        ? `whatsapp://send?phone=${num.replace(/[^0-9]/g, "").replace(/^0/, "880")}`
        : `tel:${num}`;
    Linking.openURL(url).catch(() => toast.error("খোলা যায়নি"));
  }

  if (loading || !party) return <SkeletonDetail />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: party.name, headerShown: true }} />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.name}>{party.name}</Text>
              {party.status !== "active" && <Badge label="কাজ বন্ধ" tone="danger" />}
            </View>
            <Text style={styles.meta}>
              {party.phone ?? "ফোন নেই"}
              {party.area ? ` · ${party.area}` : ""}
            </Text>
          </View>
          <Badge
            label={party.type === "customer" ? "ক্রেতা" : "সরবরাহকারী"}
            tone={party.type === "customer" ? "success" : "info"}
          />
        </View>

        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>{party.type === "customer" ? "পাওনা" : "দেনা"}</Text>
          <Text style={[styles.balanceValue, { color: balance > 0 ? theme.danger : theme.success }]}>
            {taka(balance)}
          </Text>
          {party.credit_limit > 0 && (
            <Text style={styles.creditNote}>
              ক্রেডিট লিমিট: {taka(party.credit_limit)}
              {balance > party.credit_limit ? " ⚠️ অতিক্রম করেছে" : ""}
            </Text>
          )}
        </View>

        <View style={styles.quickActions}>
          <Pressable style={styles.qa} onPress={() => contact("call")}>
            <Text style={styles.qaText}>📞 কল</Text>
          </Pressable>
          <Pressable style={styles.qa} onPress={() => contact("whatsapp")}>
            <Text style={styles.qaText}>💬 WhatsApp</Text>
          </Pressable>
          {party.latitude != null && party.longitude != null && (
            <Pressable
              style={styles.qa}
              onPress={() =>
                Linking.openURL(
                  `geo:${party.latitude},${party.longitude}?q=${party.latitude},${party.longitude}(${encodeURIComponent(party.name)})`
                )
              }
            >
              <Text style={styles.qaText}>🗺️ ম্যাপ</Text>
            </Pressable>
          )}
          {balance > 0 && (
            <Pressable
              style={[styles.qa, styles.qaPrimary]}
              onPress={() =>
                router.push({
                  pathname: "/payments/new",
                  params: {
                    partyId: party.id,
                    partyName: party.name,
                    type: party.type === "customer" ? "customer_collection" : "supplier_payment",
                    suggested: String(balance),
                  },
                })
              }
            >
              <Text style={[styles.qaText, { color: "#fff" }]}>
                {party.type === "customer" ? "💰 আদায়" : "💸 পরিশোধ"}
              </Text>
            </Pressable>
          )}
        </View>

        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v)}
          options={[
            { label: "লেজার", value: "ledger" },
            { label: "চালান", value: "invoices" },
            { label: "তথ্য", value: "info" },
          ]}
        />
      </View>

      {tab === "ledger" && (
        <FlatList
          data={entries}
          keyExtractor={(_, idx) => String(idx)}
          contentContainerStyle={entries.length === 0 ? { flex: 1 } : styles.list}
          ListHeaderComponent={
            <View style={{ marginBottom: 10 }}>
              <PrimaryButton title="📄 লেজার PDF শেয়ার করুন" onPress={handleShare} loading={sharing} />
            </View>
          }
          ListEmptyComponent={<EmptyState icon="📒" title="কোনো লেনদেন নেই" />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowDesc}>{item.description}</Text>
                <Text style={styles.rowDate}>{formatDateBn(item.date)}</Text>
              </View>
              {item.debit > 0 && <Text style={styles.debit}>+{taka(item.debit)}</Text>}
              {item.credit > 0 && <Text style={styles.credit}>−{taka(item.credit)}</Text>}
            </View>
          )}
        />
      )}

      {tab === "invoices" && (
        <FlatList
          data={invoices}
          keyExtractor={(i) => i.id}
          contentContainerStyle={invoices.length === 0 ? { flex: 1 } : styles.list}
          ListEmptyComponent={<EmptyState icon="🧾" title="কোনো চালান নেই" />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push(party.type === "customer" ? `/sales/${item.id}` : `/purchases/${item.id}`)
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowDesc}>{item.invoice_no}</Text>
                <Text style={styles.rowDate}>{formatDateBn(item.entry_date)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.rowDesc}>{taka(item.total)}</Text>
                {item.due > 0 && <Text style={styles.debit}>বাকি {taka(item.due)}</Text>}
              </View>
            </Pressable>
          )}
        />
      )}

      {tab === "info" && (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator
        >
          <View style={styles.infoCard}>
            <InfoRow label="নাম" value={party.name} />
            <InfoRow label="ফোন" value={party.phone ?? "—"} />
            <InfoRow label="বিকল্প ফোন" value={party.alt_phone ?? "—"} />
            <InfoRow label="WhatsApp" value={party.whatsapp ?? "—"} />
            <InfoRow label="এলাকা" value={party.area ?? "—"} />
            <InfoRow label="ঠিকানা" value={party.address ?? "—"} />
            <InfoRow label="থানা" value={party.thana ?? "—"} />
            <InfoRow label="জেলা" value={party.district ?? "—"} />
            <InfoRow label="শুরুর বাকি" value={taka(party.opening_balance)} />
            <InfoRow label="ক্রেডিট লিমিট" value={taka(party.credit_limit)} />
            <InfoRow label="যোগ হয়েছে" value={formatDateBn(party.created_at)} />
          </View>

          {canManage && (
            <View style={{ gap: 10, marginTop: 14 }}>
              <PrimaryButton
                title="✏️ তথ্য সম্পাদনা করুন"
                onPress={() => router.push(`/parties/new?editId=${party.id}`)}
              />
              <PrimaryButton
                title={party.status === "active" ? "🔴 কাজ বন্ধ করুন" : "🟢 আবার চালু করুন"}
                onPress={() => setShowStatusConfirm(true)}
                loading={statusBusy}
                tone={party.status === "active" ? "danger" : "success"}
              />
              <Text style={styles.statusHelp}>
                {party.status === "active"
                  ? "বন্ধ করলে নতুন বিক্রয়-ক্রয়ের তালিকায় আর আসবে না, কিন্তু পুরনো বিল, বাকি ও খাতা সব ঠিকই থাকবে। যেকোনো সময় আবার চালু করা যাবে।"
                  : "এখন কাজ বন্ধ আছে। চালু করলেই আবার বিক্রয়-ক্রয়ে বাছাই করা যাবে।"}
              </Text>
              <PrimaryButton title="🗑️ পার্টি মুছুন" onPress={() => setShowDelete(true)} tone="danger" />
            </View>
          )}
        </ScrollView>
      )}

      <ConfirmModal
        visible={showStatusConfirm}
        title={party.status === "active" ? "কাজ বন্ধ করবেন?" : "আবার চালু করবেন?"}
        message={
          party.status === "active"
            ? "নতুন বিক্রয়-ক্রয়ের তালিকা থেকে সরে যাবে। পুরনো হিসাব ও বাকি থেকে যাবে, পরে আবার চালু করা যাবে।"
            : "আবার বিক্রয়-ক্রয়ে বাছাই করা যাবে।"
        }
        confirmLabel={party.status === "active" ? "হ্যাঁ, বন্ধ করুন" : "হ্যাঁ, চালু করুন"}
        tone={party.status === "active" ? "danger" : "default"}
        onConfirm={toggleStatus}
        onCancel={() => setShowStatusConfirm(false)}
      />

      <ConfirmModal
        visible={showDelete}
        title="পার্টি মুছে ফেলবেন?"
        message="লেনদেন থাকলে মুছে যাবে না — শুধু নিষ্ক্রিয় হবে। লেনদেন না থাকলে স্থায়ীভাবে মুছে যাবে।"
        confirmLabel="মুছে ফেলুন"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 14,
  },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  name: { fontSize: 20, fontWeight: "800", color: theme.text },
  meta: { fontSize: 13, color: theme.textMuted, marginTop: 3 },
  balanceBox: { backgroundColor: theme.surfaceAlt, borderRadius: 14, padding: 14 },
  balanceLabel: { fontSize: 12, color: theme.textMuted, fontWeight: "600" },
  balanceValue: { fontSize: 26, fontWeight: "800", marginTop: 2 },
  creditNote: { fontSize: 11, color: theme.textFaint, marginTop: 4 },
  quickActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  qa: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  qaPrimary: { backgroundColor: theme.primary, borderColor: theme.primary },
  qaText: { fontSize: 12.5, fontWeight: "700", color: theme.text },
  list: { padding: 16, paddingBottom: 40, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: theme.border,
  },
  rowDesc: { fontSize: 14, fontWeight: "600", color: theme.text },
  rowDate: { fontSize: 12, color: theme.textFaint, marginTop: 2 },
  debit: { fontSize: 13, fontWeight: "700", color: theme.danger },
  credit: { fontSize: 13, fontWeight: "700", color: theme.success },
  infoCard: { backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 4 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  statusHelp: { fontSize: 11.5, color: theme.textMuted, lineHeight: 17, paddingHorizontal: 2 },
  infoLabel: { fontSize: 13, color: theme.textMuted },
  infoValue: { fontSize: 13.5, color: theme.text, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
});
