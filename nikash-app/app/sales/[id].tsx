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

type SaleDetail = {
  id: string;
  invoice_no: string;
  entry_date: string;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  due: number;
  status: "draft" | "posted" | "void";
  is_walk_in: boolean;
  walk_in_name: string | null;
  edit_count: number | null;
  customer_id: string | null;
  parties: { name: string; phone: string | null } | null;
  sale_items: {
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

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const toast = useToast();
  const [sale, setSale] = useState<SaleDetail | null>(null);
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
      .from("sales")
      .select(
        "id, invoice_no, entry_date, subtotal, discount, total, paid, due, status, is_walk_in, walk_in_name, edit_count, customer_id, parties:customer_id(name, phone), sale_items(id, qty, unit_price, total, product_variants(name, products(name)), variant_units:unit_id(unit_name))"
      )
      .eq("id", id)
      .maybeSingle();
    setSale(data as unknown as SaleDetail);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handlePost() {
    if (!sale) return;
    setBusy(true);
    const { error } = await supabase.rpc("post_sale", { p_sale: sale.id });
    setBusy(false);
    if (error) {
      toast.error(error.message.length > 60 ? "পোস্ট ব্যর্থ হয়েছে" : error.message);
      return;
    }
    toast.success("বিক্রয় পোস্ট হয়েছে");
    load();
  }

  // পোস্ট করা চালান সরাসরি বদলানো যায় না — আগে unpost করে স্টক ফেরত
  // নিতে হয়, তারপর ড্রাফট হিসেবে এডিট ফর্মে পাঠানো হয়।
  async function handleEditConfirmed(reason: string) {
    if (!sale) return;
    setShowEditPrompt(false);
    setBusy(true);
    const { error } = await supabase.rpc("unpost_sale", { p_sale: sale.id, p_reason: reason });
    setBusy(false);
    if (error) {
      toast.error(error.message.length > 70 ? "সম্পাদনার জন্য খোলা যায়নি" : error.message);
      return;
    }
    router.push(`/sales/new?editId=${sale.id}`);
  }

  function handleEdit() {
    if (!sale) return;
    if (sale.status === "draft") {
      router.push(`/sales/new?editId=${sale.id}`);
      return;
    }
    setShowEditPrompt(true);
  }

  async function handleDelete() {
    if (!sale) return;
    setShowDelete(false);
    setBusy(true);
    const { error } = await supabase.rpc("delete_draft_document", { p_table: "sale", p_id: sale.id });
    setBusy(false);
    if (error) {
      toast.error("মুছে ফেলা যায়নি");
      return;
    }
    toast.success("ড্রাফট মুছে ফেলা হয়েছে");
    router.back();
  }

  async function handleVoidConfirmed(reason: string) {
    if (!sale) return;
    setShowVoidPrompt(false);
    setBusy(true);
    const { error } = await supabase.rpc("void_document", {
      p_table: "sale",
      p_id: sale.id,
      p_reason: reason,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.length > 60 ? "বাতিল ব্যর্থ হয়েছে" : error.message);
      return;
    }
    toast.warning("বিক্রয় বাতিল করা হয়েছে");
    load();
  }

  async function handleShare() {
    if (!sale) return;
    setSharing(true);
    try {
      await shareInvoicePdf({
        documentLabel: "বিক্রয় চালান",
        companyName: profile?.companies?.name ?? "",
        invoiceNo: sale.invoice_no,
        date: sale.entry_date,
        partyLabel: "ক্রেতা",
        partyName: sale.parties?.name ?? sale.walk_in_name ?? "নগদ ক্রেতা",
        partyPhone: sale.parties?.phone,
        lines: sale.sale_items.map((it) => ({
          productName: it.product_variants?.products?.name ?? "",
          variantName: it.product_variants?.name ?? "",
          unitName: it.variant_units?.unit_name ?? "",
          qty: it.qty,
          unitPrice: it.unit_price,
          total: it.total,
        })),
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        paid: sale.paid,
        due: sale.due,
      });
    } catch (e) {
      toast.error(e instanceof Error && e.message.length < 60 ? e.message : "PDF তৈরি করা যায়নি");
    } finally {
      setSharing(false);
    }
  }

  if (loading || !sale) return <SkeletonDetail />;

  const st = STATUS[sale.status];

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: sale.invoice_no, headerShown: true }} />

      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.customer}>{sale.parties?.name ?? sale.walk_in_name ?? "নগদ ক্রেতা"}</Text>
          <Text style={styles.date}>
            {formatDateBn(sale.entry_date)} · {sale.invoice_no}
          </Text>
          {(sale.edit_count ?? 0) > 0 && (
            <Text style={styles.editedNote}>✏️ {sale.edit_count} বার সম্পাদিত</Text>
          )}
        </View>
        <Badge label={st.label} tone={st.tone} />
      </View>

      <View style={styles.card}>
        {sale.sale_items.map((it) => (
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
        <Row label="সাবটোটাল" value={taka(sale.subtotal)} />
        <Row label="ছাড়" value={taka(sale.discount)} />
        <Row label="মোট" value={taka(sale.total)} bold />
        <Row label="জমা" value={taka(sale.paid)} />
        <Row
          label="বাকি"
          value={taka(sale.due)}
          color={sale.due > 0 ? theme.danger : theme.success}
          bold
        />
      </View>

      {/* বাকি থাকলে সরাসরি আদায় করার পথ */}
      {sale.status === "posted" && sale.due > 0 && sale.customer_id && (
        <Pressable
          style={styles.collectBar}
          onPress={() =>
            router.push({
              pathname: "/payments/new",
              params: {
                partyId: sale.customer_id!,
                partyName: sale.parties?.name ?? "",
                type: "customer_collection",
                suggested: String(sale.due),
              },
            })
          }
        >
          <Text style={styles.collectText}>💰 এই চালানের বাকি {taka(sale.due)} আদায় করুন</Text>
        </Pressable>
      )}

      <View style={{ gap: 10, marginTop: 4 }}>
        <PrimaryButton title="📄 PDF শেয়ার করুন" onPress={handleShare} loading={sharing} />

        {sale.status !== "void" && canManage && (
          <PrimaryButton title="✏️ সম্পাদনা করুন" onPress={handleEdit} loading={busy} />
        )}

        {sale.status === "draft" && (
          <>
            <PrimaryButton title="Post করুন" onPress={handlePost} loading={busy} tone="success" />
            {canManage && (
              <PrimaryButton title="🗑️ ড্রাফট মুছুন" onPress={() => setShowDelete(true)} tone="danger" />
            )}
          </>
        )}

        {sale.status === "posted" && canManage && (
          <PrimaryButton
            title="বাতিল করুন (Void)"
            onPress={() => setShowVoidPrompt(true)}
            loading={busy}
            tone="danger"
          />
        )}

        {sale.status === "void" && <Text style={styles.voidNote}>এই বিক্রয়টি বাতিল করা হয়েছে</Text>}
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
        message="এই ড্রাফট চালানটি স্থায়ীভাবে মুছে যাবে। এটি ফেরানো যাবে না।"
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
  customer: { fontSize: 19, fontWeight: "800", color: theme.text },
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
  collectBar: {
    backgroundColor: theme.successBg,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  collectText: { color: theme.success, fontWeight: "700", textAlign: "center", fontSize: 13.5 },
  voidNote: { textAlign: "center", color: theme.danger, fontWeight: "600", marginTop: 6 },
});
