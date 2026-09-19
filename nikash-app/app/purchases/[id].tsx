import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { shareInvoicePdf } from "@/lib/invoice-pdf";
import { formatDateBn, taka } from "@/lib/format";
import { PrimaryButton } from "@/components/form";
import { PromptModal } from "@/components/prompt-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { Badge, theme } from "@/components/ui";
import { SkeletonDetail } from "@/components/skeleton";

type PurchaseDetail = {
  id: string;
  invoice_no: string;
  entry_date: string;
  subtotal: number;
  discount: number;
  transport_cost: number;
  total: number;
  paid: number;
  due: number;
  status: "draft" | "posted" | "void";
  edit_count: number | null;
  supplier_id: string | null;
  parties: { name: string; phone: string | null } | null;
  purchase_items: {
    id: string;
    qty: number;
    unit_price: number;
    total: number;
    product_variants: { name: string; products: { name: string } | null } | null;
    variant_units: { unit_name: string } | null;
  }[];
};

const STATUS = {
  draft: { label: "ড্রাফট", tone: "warning" as const },
  posted: { label: "পোস্টেড", tone: "success" as const },
  void: { label: "বাতিল", tone: "danger" as const },
};

export default function PurchaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const toast = useToast();
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showVoidPrompt, setShowVoidPrompt] = useState(false);
  const [showEditPrompt, setShowEditPrompt] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const canManage = profile?.role === "owner" || profile?.role === "manager";

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("purchases")
      .select(
        "id, invoice_no, entry_date, subtotal, discount, transport_cost, total, paid, due, status, edit_count, supplier_id, parties:supplier_id(name, phone), purchase_items(id, qty, unit_price, total, product_variants(name, products(name)), variant_units:unit_id(unit_name))"
      )
      .eq("id", id)
      .maybeSingle();
    setPurchase(data as unknown as PurchaseDetail);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handlePost() {
    if (!purchase) return;
    setBusy(true);
    const { error } = await supabase.rpc("post_purchase", { p_purchase: purchase.id });
    setBusy(false);
    if (error) {
      toast.error(error.message.length > 60 ? "পোস্ট ব্যর্থ হয়েছে" : error.message);
      return;
    }
    toast.success("ক্রয় পোস্ট হয়েছে");
    load();
  }

  function handleEdit() {
    if (!purchase) return;
    if (purchase.status === "draft") {
      router.push(`/purchases/new?editId=${purchase.id}`);
      return;
    }
    setShowEditPrompt(true);
  }

  async function handleEditConfirmed(reason: string) {
    if (!purchase) return;
    setShowEditPrompt(false);
    setBusy(true);
    const { error } = await supabase.rpc("unpost_purchase", { p_purchase: purchase.id, p_reason: reason });
    setBusy(false);
    if (error) {
      toast.error(error.message.length > 70 ? "সম্পাদনার জন্য খোলা যায়নি" : error.message);
      return;
    }
    router.push(`/purchases/new?editId=${purchase.id}`);
  }

  async function handleDelete() {
    if (!purchase) return;
    setShowDelete(false);
    setBusy(true);
    const { error } = await supabase.rpc("delete_draft_document", { p_table: "purchase", p_id: purchase.id });
    setBusy(false);
    if (error) {
      toast.error("মুছে ফেলা যায়নি");
      return;
    }
    toast.success("ড্রাফট মুছে ফেলা হয়েছে");
    router.back();
  }

  async function handleVoidConfirmed(reason: string) {
    if (!purchase) return;
    setShowVoidPrompt(false);
    setBusy(true);
    const { error } = await supabase.rpc("void_document", {
      p_table: "purchase",
      p_id: purchase.id,
      p_reason: reason,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.length > 60 ? "বাতিল ব্যর্থ হয়েছে" : error.message);
      return;
    }
    toast.warning("ক্রয় বাতিল করা হয়েছে");
    load();
  }

  async function handleShare() {
    if (!purchase) return;
    setSharing(true);
    try {
      await shareInvoicePdf({
        documentLabel: "ক্রয় চালান",
        companyName: profile?.companies?.name ?? "",
        invoiceNo: purchase.invoice_no,
        date: purchase.entry_date,
        partyLabel: "সরবরাহকারী",
        partyName: purchase.parties?.name ?? "—",
        partyPhone: purchase.parties?.phone,
        lines: purchase.purchase_items.map((it) => ({
          productName: it.product_variants?.products?.name ?? "",
          variantName: it.product_variants?.name ?? "",
          unitName: it.variant_units?.unit_name ?? "",
          qty: it.qty,
          unitPrice: it.unit_price,
          total: it.total,
        })),
        subtotal: purchase.subtotal,
        discount: purchase.discount,
        total: purchase.total,
        paid: purchase.paid,
        due: purchase.due,
      });
    } catch (e) {
      toast.error(e instanceof Error && e.message.length < 60 ? e.message : "PDF তৈরি করা যায়নি");
    } finally {
      setSharing(false);
    }
  }

  if (loading || !purchase) return <SkeletonDetail />;

  const st = STATUS[purchase.status];

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: purchase.invoice_no, headerShown: true }} />

      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.party}>{purchase.parties?.name ?? "—"}</Text>
          <Text style={styles.date}>
            {formatDateBn(purchase.entry_date)} · {purchase.invoice_no}
          </Text>
          {(purchase.edit_count ?? 0) > 0 && (
            <Text style={styles.editedNote}>✏️ {purchase.edit_count} বার সম্পাদিত</Text>
          )}
        </View>
        <Badge label={st.label} tone={st.tone} />
      </View>

      <View style={styles.card}>
        {purchase.purchase_items.map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.product_variants?.products?.name}</Text>
              <Text style={styles.itemMeta}>
                {it.product_variants?.name} · {it.qty} {it.variant_units?.unit_name} × {taka(it.unit_price)}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{taka(it.total)}</Text>
          </View>
        ))}

        <View style={styles.divider} />
        <Row label="সাবটোটাল" value={taka(purchase.subtotal)} />
        <Row label="ছাড়" value={taka(purchase.discount)} />
        <Row label="পরিবহন খরচ" value={taka(purchase.transport_cost)} />
        <Row label="মোট" value={taka(purchase.total)} bold />
        <Row label="পরিশোধিত" value={taka(purchase.paid)} />
        <Row
          label="বাকি"
          value={taka(purchase.due)}
          color={purchase.due > 0 ? theme.warning : theme.success}
          bold
        />
      </View>

      {purchase.status === "posted" && purchase.due > 0 && purchase.supplier_id && (
        <Pressable
          style={styles.payBar}
          onPress={() =>
            router.push({
              pathname: "/payments/new",
              params: {
                partyId: purchase.supplier_id!,
                partyName: purchase.parties?.name ?? "",
                type: "supplier_payment",
                suggested: String(purchase.due),
              },
            })
          }
        >
          <Text style={styles.payText}>💸 এই চালানের বাকি {taka(purchase.due)} পরিশোধ করুন</Text>
        </Pressable>
      )}

      <View style={{ gap: 10, marginTop: 4 }}>
        <PrimaryButton title="📄 PDF শেয়ার করুন" onPress={handleShare} loading={sharing} />

        {purchase.status !== "void" && canManage && (
          <PrimaryButton title="✏️ সম্পাদনা করুন" onPress={handleEdit} loading={busy} />
        )}

        {purchase.status === "draft" && (
          <>
            <PrimaryButton title="Post করুন" onPress={handlePost} loading={busy} tone="success" />
            {canManage && (
              <PrimaryButton title="🗑️ ড্রাফট মুছুন" onPress={() => setShowDelete(true)} tone="danger" />
            )}
          </>
        )}

        {purchase.status === "posted" && canManage && (
          <PrimaryButton
            title="বাতিল করুন (Void)"
            onPress={() => setShowVoidPrompt(true)}
            loading={busy}
            tone="danger"
          />
        )}

        {purchase.status === "void" && <Text style={styles.voidNote}>এই ক্রয়টি বাতিল করা হয়েছে</Text>}
      </View>

      <PromptModal
        visible={showVoidPrompt}
        title="বাতিলের কারণ লিখুন"
        onSubmit={handleVoidConfirmed}
        onCancel={() => setShowVoidPrompt(false)}
      />
      <PromptModal
        visible={showEditPrompt}
        title="সম্পাদনার কারণ লিখুন (স্টক ফেরত নেওয়া হবে)"
        onSubmit={handleEditConfirmed}
        onCancel={() => setShowEditPrompt(false)}
      />
      <ConfirmModal
        visible={showDelete}
        title="ড্রাফট মুছে ফেলবেন?"
        message="এই ড্রাফট চালানটি স্থায়ীভাবে মুছে যাবে।"
        confirmLabel="মুছে ফেলুন"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </ScrollView>
  );
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && { fontWeight: "700", color: theme.text }]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && { fontWeight: "800" }, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  party: { fontSize: 19, fontWeight: "800", color: theme.text },
  date: { fontSize: 13, color: theme.textMuted, marginTop: 3 },
  editedNote: { fontSize: 11, color: theme.warning, marginTop: 4, fontWeight: "600" },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 14,
  },
  itemRow: { flexDirection: "row", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  itemName: { fontSize: 14, fontWeight: "600", color: theme.text },
  itemMeta: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: "700", color: theme.text },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  summaryLabel: { fontSize: 13, color: theme.textMuted },
  summaryValue: { fontSize: 14, color: theme.text, fontWeight: "600" },
  payBar: {
    backgroundColor: theme.warningBg,
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  payText: { color: theme.warning, fontWeight: "700", textAlign: "center", fontSize: 13.5 },
  voidNote: { textAlign: "center", color: theme.danger, fontWeight: "600", marginTop: 6 },
});
