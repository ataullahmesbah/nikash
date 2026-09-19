import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { errorMessage, toastMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { loadCatalog, type PickableUnit } from "@/lib/catalog";
import { ErrorText, FormField, PrimaryButton } from "@/components/form";
import { ItemPickerModal } from "@/components/item-picker-modal";
import { PartyPickerModal, type PickableParty } from "@/components/party-picker-modal";
import { CartLineRow, type CartLine } from "@/components/cart-line";
import { DateField } from "@/components/date-field";
import { todayIso } from "@/lib/format";
import { BatchEntryModal } from "@/components/batch-entry-modal";

export default function NewPurchaseScreen() {
  // ?editId= থাকলে একই ফর্ম এডিট মোডে চলে (বিক্রয় ফর্মের মতোই)।
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!editId;
  const { profile } = useAuth();
  const toast = useToast();
  const [entryDate, setEntryDate] = useState(todayIso());
  const [loadingExisting, setLoadingExisting] = useState(!!editId);
  const [supplier, setSupplier] = useState<PickableParty | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [transportCost, setTransportCost] = useState("0");
  const [paid, setPaid] = useState("0");
  const [catalog, setCatalog] = useState<PickableUnit[]>([]);
  const [suppliers, setSuppliers] = useState<PickableParty[]>([]);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showPartyPicker, setShowPartyPicker] = useState(false);
  const [pendingBatchUnit, setPendingBatchUnit] = useState<PickableUnit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    loadCatalog(profile.company_id).then(setCatalog).catch(() => { });
    supabase
      .from("parties")
      .select("id, name, phone")
      .eq("company_id", profile.company_id)
      .eq("type", "supplier")
      .eq("status", "active")
      .then(({ data }) => setSuppliers(data ?? []));
  }, [profile]);

  useEffect(() => {
    if (!editId || !profile || catalog.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error: loadErr } = await supabase
        .from("purchases")
        .select(
          "id, entry_date, discount, transport_cost, paid, due, status, parties:supplier_id(id, name, phone), purchase_items(id, variant_id, unit_id, qty, unit_price)"
        )
        .eq("id", editId)
        .maybeSingle();
      if (cancelled) return;
      if (loadErr || !data) {
        // আগে এখানে চুপচাপ ফিরে যেত — ফলে ফাঁকা ফর্ম দেখে মনে হতো
        // "এডিট কাজ করছে না"। এখন আসল কারণটা দেখাই।
        toast.error(loadErr?.message ? `চালান খোলা যায়নি: ${loadErr.message}` : "চালানটি পাওয়া যায়নি");
        setLoadingExisting(false);
        router.back();
        return;
      }

      const pur = data as unknown as {
        entry_date: string; discount: number; transport_cost: number; paid: number; status: string;
        parties: { id: string; name: string; phone: string | null } | null;
        purchase_items: { id: string; variant_id: string; unit_id: string; qty: number; unit_price: number }[];
      };

      if (pur.status !== "draft") {
        toast.error("পোস্ট করা চালান সরাসরি এডিট করা যায় না");
        router.back();
        return;
      }

      setEntryDate(pur.entry_date);
      setDiscount(String(pur.discount ?? 0));
      setTransportCost(String(pur.transport_cost ?? 0));
      setPaid(String(pur.paid ?? 0));
      if (pur.parties) setSupplier({ id: pur.parties.id, name: pur.parties.name, phone: pur.parties.phone });

      setLines(
        pur.purchase_items.map((it) => {
          const unit = catalog.find((u) => u.id === it.unit_id);
          return {
            key: it.id,
            variantId: it.variant_id,
            variantUnitId: it.unit_id,
            factorToBase: unit?.factor_to_base ?? 1,
            productName: unit?.product_name ?? "",
            variantName: unit?.variant_name ?? "",
            unitName: unit?.unit_name ?? "",
            qty: String(it.qty),
            unitPrice: String(it.unit_price),
          };
        })
      );
      setLoadingExisting(false);
    })();
    return () => { cancelled = true; };
  }, [editId, profile, catalog, toast]);

  const subtotal = lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(transportCost) || 0));
  const due = Math.max(0, total - (Number(paid) || 0));

  function addItem(unit: PickableUnit) {
    setShowItemPicker(false);
    if (unit.trackExpiry) {
      // PRD 14.7: track_expiry variants ask for batch no. + expiry at
      // purchase time. The batches row itself is created in handleSave,
      // once we have a purchase_id to attach it to.
      setPendingBatchUnit(unit);
      return;
    }
    pushLine(unit);
  }

  function pushLine(unit: PickableUnit, batchNo?: string, expiryDate?: string) {
    setLines((prev) => [
      ...prev,
      {
        key: `${unit.id}-${Date.now()}`,
        variantId: unit.variant_id,
        variantUnitId: unit.id,
        factorToBase: unit.factor_to_base,
        productName: unit.product_name,
        variantName: unit.variant_name,
        unitName: unit.unit_name,
        qty: "1",
        unitPrice: String(unit.purchase_price ?? 0),
        batchNo,
        expiryDate,
      },
    ]);
  }

  async function handleSave(postImmediately: boolean) {
    if (!profile) return;
    if (lines.length === 0) {
      setError("অন্তত একটা প্রোডাক্ট যোগ করুন");
      return;
    }
    if (!supplier) {
      setError("সরবরাহকারী বাছাই করুন");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const purchaseId = editId ?? Crypto.randomUUID();

      // পোস্ট করার সময় জমা টাকাটা আলাদা payment সারি হয়ে allocate_payment দিয়ে
      // বসবে। তাই হেডারে তখন paid/due শূন্য রাখি, নইলে একই টাকা দুইবার গুনে
      // বাকি ০ হয়ে যায়। ড্রাফটে কোনো payment তৈরি হয় না, তাই সেখানে সরাসরি বসে।
      const paidNow = Number(paid) || 0;
      const willCreatePayment = postImmediately && paidNow > 0;

      const header = {
        supplier_id: supplier.id,
        entry_date: entryDate,
        subtotal,
        discount: Number(discount) || 0,
        transport_cost: Number(transportCost) || 0,
        total,
        paid: willCreatePayment ? 0 : paidNow,
        due: willCreatePayment ? total : due,
      };

      if (isEdit) {
        const { error: updErr } = await supabase
          .from("purchases")
          .update({ ...header, edited_at: new Date().toISOString() })
          .eq("id", purchaseId);
        if (updErr) throw updErr;

        // পুরনো লাইন ও ব্যাচ মুছে নতুন করে বসবে
        // ⚠️ সরাসরি `.delete()` চালানো যাবে না। RLS-এ কোনো DELETE নীতি
        // নেই (ইচ্ছাকৃত — কিছুই হার্ড ডিলিট হয় না), আর নীতি না থাকলে
        // Postgres এরর না দিয়ে চুপচাপ শূন্যটা সারি মোছে। ফলে পুরনো
        // লাইন ও ব্যাচ থেকে গিয়ে নতুনগুলোর সাথে দ্বিগুণ হয়ে যেত।
        // ফাংশনটা লাইন ও ব্যাচ — দুটোই একসাথে সামলায়।
        const { error: delErr } = await supabase.rpc("clear_document_lines", {
          p_type: "purchase",
          p_id: purchaseId,
        });
        if (delErr) throw delErr;

        await supabase.rpc("log_entity_change", {
          p_entity_type: "purchase",
          p_entity_id: purchaseId,
          p_action: "update",
          p_new: header,
        });
      } else {
        const { data: invoiceNo, error: docNoErr } = await supabase.rpc("next_doc_no", {
          p_company: profile.company_id,
          p_type: "purchase",
          p_prefix: "PUR",
        });
        if (docNoErr) throw docNoErr;

        const { error: purErr } = await supabase.from("purchases").insert({
          id: purchaseId,
          company_id: profile.company_id,
          invoice_no: invoiceNo,
          ...header,
          status: "draft",
          created_by: profile.id,
        });
        if (purErr) throw purErr;
      }

      // Lines with a batch number get a `batches` row first so
      // purchase_items can reference it — trg_moves_batch (05 SQL) then
      // keeps qty_base_remaining in sync automatically once posted.
      const batchIdByLineKey: Record<string, string> = {};
      for (const l of lines) {
        if (!l.batchNo) continue;
        const batchId = Crypto.randomUUID();
        const { error: batchErr } = await supabase.from("batches").insert({
          id: batchId,
          company_id: profile.company_id,
          variant_id: l.variantId,
          batch_no: l.batchNo,
          expiry_date: l.expiryDate || null,
          purchase_id: purchaseId,
        });
        if (batchErr) throw batchErr;
        batchIdByLineKey[l.key] = batchId;
      }

      const itemRows = lines.map((l) => ({
        company_id: profile.company_id,
        purchase_id: purchaseId,
        variant_id: l.variantId,
        unit_id: l.variantUnitId,
        qty: Number(l.qty),
        qty_base: Number(l.qty) * l.factorToBase,
        unit_price: Number(l.unitPrice),
        total: Number(l.qty) * Number(l.unitPrice),
        batch_id: batchIdByLineKey[l.key] ?? null,
      }));
      const { error: itemsErr } = await supabase.from("purchase_items").insert(itemRows);
      if (itemsErr) throw itemsErr;

      if (postImmediately) {
        const { error: postErr } = await supabase.rpc("post_purchase", { p_purchase: purchaseId });
        if (postErr) throw postErr;

        if (paidNow > 0) {
          const paymentId = Crypto.randomUUID();
          const { error: payErr } = await supabase.from("payments").insert({
            id: paymentId,
            company_id: profile.company_id,
            type: "supplier_payment",
            party_id: supplier.id,
            amount: paidNow,
            method: "cash",
            entry_date: entryDate, // চালানের তারিখেই পেমেন্ট বসবে, আজকের তারিখে নয়
            received_by: profile.id,
            status: "posted",
          });
          if (payErr) throw payErr;

          const { error: allocErr } = await supabase.rpc("allocate_payment", { p_payment: paymentId });
          if (allocErr) throw allocErr;
        }
      }

      toast.success(
        postImmediately
          ? isEdit ? "সম্পাদনা করে পোস্ট হয়েছে" : "ক্রয় পোস্ট হয়েছে"
          : isEdit ? "পরিবর্তন সংরক্ষিত হয়েছে" : "ড্রাফট সংরক্ষিত হয়েছে"
      );
      router.back();
    } catch (e) {
      const message = errorMessage(e, "সংরক্ষণ ব্যর্থ হয়েছে");
      setError(message);
      toast.error(toastMessage(e, "সংরক্ষণ ব্যর্থ হয়েছে"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: isEdit ? "ক্রয় সম্পাদনা" : "নতুন ক্রয়", headerShown: true }} />

      <DateField label="তারিখ" value={entryDate} onChange={setEntryDate} maximumDate={new Date()} />

      <View style={{ marginBottom: 16 }}>
        <PrimaryButton
          title={supplier ? `সরবরাহকারী: ${supplier.name}` : "সরবরাহকারী বাছাই করুন"}
          onPress={() => setShowPartyPicker(true)}
        />
      </View>

      <PrimaryButton title="+ প্রোডাক্ট যোগ করুন" onPress={() => setShowItemPicker(true)} tone="success" />
      <View style={{ marginTop: 10 }}>
        {lines.map((line) => (
          <CartLineRow
            key={line.key}
            line={line}
            onChange={(patch) =>
              setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, ...patch } : l)))
            }
            onRemove={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
          />
        ))}
      </View>

      <FormField label="ছাড় (Discount)" value={discount} onChangeText={setDiscount} keyboardType="numeric" />
      <FormField label="পরিবহন খরচ" value={transportCost} onChangeText={setTransportCost} keyboardType="numeric" />
      <FormField label="নগদ পরিশোধ (Paid now)" value={paid} onChangeText={setPaid} keyboardType="numeric" />

      <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <Text style={{ color: "#64748b" }}>সাবটোটাল: ৳{subtotal.toFixed(2)}</Text>
        <Text style={{ color: "#0f172a", fontWeight: "700", fontSize: 16, marginTop: 4 }}>
          মোট: ৳{total.toFixed(2)}
        </Text>
        <Text style={{ color: due > 0 ? "#dc2626" : "#059669", marginTop: 4 }}>বাকি: ৳{due.toFixed(2)}</Text>
      </View>

      <ErrorText>{error}</ErrorText>

      <PrimaryButton
        title={isEdit ? "পরিবর্তন সংরক্ষণ করুন" : "ড্রাফট হিসেবে সংরক্ষণ করুন"}
        onPress={() => handleSave(false)}
        loading={loading || loadingExisting}
      />
      <View style={{ height: 10 }} />
      <PrimaryButton
        title={isEdit ? "সংরক্ষণ ও আবার Post করুন" : "সংরক্ষণ ও Post করুন"}
        onPress={() => handleSave(true)}
        loading={loading || loadingExisting}
        tone="success"
      />

      <ItemPickerModal
        visible={showItemPicker}
        items={catalog}
        priceField="purchase_price"
        onSelect={addItem}
        onClose={() => setShowItemPicker(false)}
      />
      <PartyPickerModal
        partyType="supplier"
        title="সরবরাহকারী বাছাই করুন"
        visible={showPartyPicker}
        items={suppliers}
        onSelect={(p) => {
          setSupplier(p);
          setShowPartyPicker(false);
        }}
        onClose={() => setShowPartyPicker(false)}
      />

      {pendingBatchUnit && (
        <BatchEntryModal
          visible
          productName={pendingBatchUnit.product_name}
          onSubmit={(batchNo, expiryDate) => {
            pushLine(pendingBatchUnit, batchNo || undefined, expiryDate || undefined);
            setPendingBatchUnit(null);
          }}
          onSkip={() => {
            // ব্যাচ তথ্য ছাড়াই পণ্যটি কার্টে যাক — হিসাব আটকে থাকবে না
            pushLine(pendingBatchUnit);
            setPendingBatchUnit(null);
          }}
          onCancel={() => setPendingBatchUnit(null)}
        />
      )}
    </ScrollView>
  );
}
