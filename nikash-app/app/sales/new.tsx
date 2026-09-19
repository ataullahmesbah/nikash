import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { errorMessage, toastMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { loadCatalog, type PickableUnit } from "@/lib/catalog";
import { loadFefoBatches, allocateFefo } from "@/lib/batches";
import { ErrorText, FormField, PrimaryButton, SegmentedControl } from "@/components/form";
import { ItemPickerModal } from "@/components/item-picker-modal";
import { PartyPickerModal, type PickableParty } from "@/components/party-picker-modal";
import { CartLineRow, type CartLine } from "@/components/cart-line";
import { DateField } from "@/components/date-field";
import { todayIso } from "@/lib/format";

export default function NewSaleScreen() {
  // ?editId= থাকলে এটাই এডিট স্ক্রিন হিসেবে কাজ করে — আলাদা স্ক্রিন বানালে
  // পুরো কার্ট UI দুইবার লিখতে হতো, তাই একই ফর্ম দুই কাজেই ব্যবহার হয়।
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!editId;
  const { profile } = useAuth();
  const toast = useToast();
  const [entryDate, setEntryDate] = useState(todayIso());
  const [loadingExisting, setLoadingExisting] = useState(!!editId);
  const [mode, setMode] = useState<"walkin" | "customer">("walkin");
  const [customer, setCustomer] = useState<PickableParty | null>(null);
  const [walkInName, setWalkInName] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [paid, setPaid] = useState("0");
  const [catalog, setCatalog] = useState<PickableUnit[]>([]);
  const [customers, setCustomers] = useState<PickableParty[]>([]);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showPartyPicker, setShowPartyPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    loadCatalog(profile.company_id).then(setCatalog).catch(() => { });
    supabase
      .from("parties")
      .select("id, name, phone")
      .eq("company_id", profile.company_id)
      .eq("type", "customer")
      .eq("status", "active")
      .then(({ data }) => setCustomers(data ?? []));
  }, [profile]);

  // এডিট মোডে বিদ্যমান চালান লোড করে ফর্মে বসানো
  useEffect(() => {
    if (!editId || !profile || catalog.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error: loadErr } = await supabase
        .from("sales")
        .select(
          "id, entry_date, discount, paid, due, customer_id, is_walk_in, walk_in_name, status, parties:customer_id(id, name, phone), sale_items(id, variant_id, unit_id, qty, unit_price)"
        )
        .eq("id", editId)
        .maybeSingle();
      if (cancelled) return;
      if (loadErr || !data) {
        // চুপচাপ ফাঁকা ফর্ম না দেখিয়ে আসল কারণটা বলি
        toast.error(loadErr?.message ? `চালান খোলা যায়নি: ${loadErr.message}` : "চালানটি পাওয়া যায়নি");
        setLoadingExisting(false);
        router.back();
        return;
      }

      const sale = data as unknown as {
        entry_date: string; discount: number; paid: number; is_walk_in: boolean;
        walk_in_name: string | null; status: string;
        parties: { id: string; name: string; phone: string | null } | null;
        sale_items: { id: string; variant_id: string; unit_id: string; qty: number; unit_price: number }[];
      };

      if (sale.status !== "draft") {
        toast.error("পোস্ট করা চালান সরাসরি এডিট করা যায় না");
        router.back();
        return;
      }

      setEntryDate(sale.entry_date);
      setDiscount(String(sale.discount ?? 0));
      setPaid(String(sale.paid ?? 0));
      setMode(sale.is_walk_in ? "walkin" : "customer");
      setWalkInName(sale.walk_in_name ?? "");
      if (sale.parties) setCustomer({ id: sale.parties.id, name: sale.parties.name, phone: sale.parties.phone });

      // একই ভ্যারিয়েন্ট একাধিক ব্যাচে ভাগ হয়ে থাকতে পারে (FEFO) — এডিটে
      // সেগুলো একটা লাইনে জোড়া লাগিয়ে দেখাই, সেভ করলে আবার ভাগ হবে।
      const merged = new Map<string, CartLine>();
      sale.sale_items.forEach((it) => {
        const unit = catalog.find((u) => u.id === it.unit_id);
        const key = `${it.variant_id}-${it.unit_id}-${it.unit_price}`;
        const existing = merged.get(key);
        if (existing) {
          existing.qty = String(Number(existing.qty) + Number(it.qty));
          return;
        }
        merged.set(key, {
          key: `${it.id}`,
          variantId: it.variant_id,
          variantUnitId: it.unit_id,
          factorToBase: unit?.factor_to_base ?? 1,
          productName: unit?.product_name ?? "",
          variantName: unit?.variant_name ?? "",
          unitName: unit?.unit_name ?? "",
          qty: String(it.qty),
          unitPrice: String(it.unit_price),
        });
      });
      setLines(Array.from(merged.values()));
      setLoadingExisting(false);
    })();
    return () => { cancelled = true; };
  }, [editId, profile, catalog, toast]);

  const subtotal = lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const due = Math.max(0, total - (Number(paid) || 0));

  function addItem(unit: PickableUnit) {
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
        unitPrice: String(unit.sale_price ?? 0),
      },
    ]);
    setShowItemPicker(false);
  }

  async function handleSave(postImmediately: boolean) {
    if (!profile) return;
    if (lines.length === 0) {
      setError("অন্তত একটা প্রোডাক্ট যোগ করুন");
      return;
    }
    if (mode === "customer" && !customer) {
      setError("ক্রেতা বাছাই করুন, অথবা নগদ ক্রেতা বাছুন");
      return;
    }
    if (mode === "walkin" && Number(due) > 0 === false && !walkInName.trim()) {
      // walk-in name optional, no-op check kept simple
    }

    setError(null);
    setLoading(true);
    try {
      const saleId = editId ?? Crypto.randomUUID();

      // পোস্ট করার সময় জমা টাকাটা আলাদা payment সারি হয়ে allocate_payment দিয়ে
      // বসবে। তাই হেডারে তখন paid/due শূন্য রাখি, নইলে একই টাকা দুইবার গুনে
      // বাকি ০ হয়ে যায় (৫০০ টাকার বিলে ৩০০ জমা দিলেও বাকি ০ দেখাত)।
      // নগদ ক্রেতার পার্টি নেই, তাই সেখানে payment হয় না — মান সরাসরি বসে।
      const paidNow = Number(paid) || 0;
      const willCreatePayment = postImmediately && paidNow > 0 && mode === "customer";

      const header = {
        customer_id: mode === "customer" ? customer!.id : null,
        is_walk_in: mode === "walkin",
        walk_in_name: mode === "walkin" ? walkInName.trim() || "নগদ ক্রেতা" : null,
        entry_date: entryDate,
        subtotal,
        discount: Number(discount) || 0,
        total,
        paid: willCreatePayment ? 0 : paidNow,
        due: willCreatePayment ? total : due,
      };

      if (isEdit) {
        // এডিট: পুরনো লাইন মুছে নতুন লাইন বসে, চালান নম্বর অপরিবর্তিত থাকে।
        const { error: updErr } = await supabase
          .from("sales")
          .update({ ...header, edited_at: new Date().toISOString() })
          .eq("id", saleId);
        if (updErr) throw updErr;

        // ⚠️ সরাসরি `.delete()` চালানো যাবে না। RLS-এ কোনো DELETE নীতি
        // নেই (ইচ্ছাকৃত — কিছুই হার্ড ডিলিট হয় না), আর নীতি না থাকলে
        // Postgres এরর না দিয়ে চুপচাপ শূন্যটা সারি মোছে। ফলে পুরনো
        // লাইন থেকে গিয়ে নতুন লাইনের সাথে দ্বিগুণ হয়ে যেত।
        const { error: delErr } = await supabase.rpc("clear_document_lines", {
          p_type: "sale",
          p_id: saleId,
        });
        if (delErr) throw delErr;

        await supabase.rpc("log_entity_change", {
          p_entity_type: "sale",
          p_entity_id: saleId,
          p_action: "update",
          p_new: header,
        });
      } else {
        const { data: invoiceNo, error: docNoErr } = await supabase.rpc("next_doc_no", {
          p_company: profile.company_id,
          p_type: "sale",
          p_prefix: "INV",
        });
        if (docNoErr) throw docNoErr;

        const { error: saleErr } = await supabase.from("sales").insert({
          id: saleId,
          company_id: profile.company_id,
          invoice_no: invoiceNo,
          ...header,
          status: "draft",
          created_by: profile.id,
          salesman_id: profile.id,
        });
        if (saleErr) throw saleErr;
      }

      // PRD FEFO rule: variants under expiry tracking must deduct from the
      // earliest-expiring batch first. A line can span multiple batches
      // (e.g. selling 15 units when the soonest-expiring batch only has 10
      // left), so one cart line may become several sale_items rows here —
      // each pinned to a batch_id so post_sale's stock_movements correctly
      // decrement that specific batch's qty_base_remaining.
      const itemRows: {
        company_id: string;
        sale_id: string;
        variant_id: string;
        unit_id: string;
        qty: number;
        qty_base: number;
        unit_price: number;
        total: number;
        batch_id: string | null;
      }[] = [];

      for (const l of lines) {
        const unit = catalog.find((u) => u.id === l.variantUnitId);
        const lineQtyBase = Number(l.qty) * l.factorToBase;
        const unitPrice = Number(l.unitPrice);

        if (!unit?.trackExpiry) {
          itemRows.push({
            company_id: profile.company_id,
            sale_id: saleId,
            variant_id: l.variantId,
            unit_id: l.variantUnitId,
            qty: Number(l.qty),
            qty_base: lineQtyBase,
            unit_price: unitPrice,
            total: Number(l.qty) * unitPrice,
            batch_id: null,
          });
          continue;
        }

        const batches = await loadFefoBatches(profile.company_id, l.variantId);
        const { chunks, shortfallQtyBase } = allocateFefo(batches, lineQtyBase);

        chunks.forEach((chunk) => {
          const chunkQty = chunk.qtyBase / l.factorToBase;
          itemRows.push({
            company_id: profile.company_id,
            sale_id: saleId,
            variant_id: l.variantId,
            unit_id: l.variantUnitId,
            qty: chunkQty,
            qty_base: chunk.qtyBase,
            unit_price: unitPrice,
            total: chunkQty * unitPrice,
            batch_id: chunk.batchId,
          });
        });

        if (shortfallQtyBase > 0) {
          const shortfallQty = shortfallQtyBase / l.factorToBase;
          itemRows.push({
            company_id: profile.company_id,
            sale_id: saleId,
            variant_id: l.variantId,
            unit_id: l.variantUnitId,
            qty: shortfallQty,
            qty_base: shortfallQtyBase,
            unit_price: unitPrice,
            total: shortfallQty * unitPrice,
            batch_id: null,
          });
        }
      }

      const { error: itemsErr } = await supabase.from("sale_items").insert(itemRows);
      if (itemsErr) throw itemsErr;

      if (postImmediately) {
        const { error: postErr } = await supabase.rpc("post_sale", { p_sale: saleId });
        if (postErr) throw postErr;

        if (willCreatePayment) {
          const paymentId = Crypto.randomUUID();
          const { error: payErr } = await supabase.from("payments").insert({
            id: paymentId,
            company_id: profile.company_id,
            type: "customer_collection",
            party_id: customer!.id,
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
          ? isEdit ? "সম্পাদনা করে পোস্ট হয়েছে" : "বিক্রয় পোস্ট হয়েছে"
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
      <Stack.Screen options={{ title: isEdit ? "বিক্রয় সম্পাদনা" : "নতুন বিক্রয়", headerShown: true }} />

      <DateField label="তারিখ" value={entryDate} onChange={setEntryDate} maximumDate={new Date()} />

      <SegmentedControl
        value={mode}
        onChange={(v) => setMode(v)}
        options={[
          { label: "নগদ ক্রেতা", value: "walkin" },
          { label: "ক্রেতা বাছুন", value: "customer" },
        ]}
      />

      {mode === "walkin" ? (
        <FormField
          label="ক্রেতার নাম (ঐচ্ছিক)"
          value={walkInName}
          onChangeText={setWalkInName}
          placeholder="নগদ ক্রেতা"
        />
      ) : (
        <PrimaryButton
          title={customer ? `ক্রেতা: ${customer.name}` : "ক্রেতা বাছাই করুন"}
          onPress={() => setShowPartyPicker(true)}
        />
      )}

      <View style={{ marginTop: 20, marginBottom: 10 }}>
        <PrimaryButton title="+ প্রোডাক্ট যোগ করুন" onPress={() => setShowItemPicker(true)} tone="success" />
      </View>

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

      <FormField label="ছাড় (Discount)" value={discount} onChangeText={setDiscount} keyboardType="numeric" />
      <FormField label="নগদ আদায় (Paid now)" value={paid} onChangeText={setPaid} keyboardType="numeric" />

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
        priceField="sale_price"
        onSelect={addItem}
        onClose={() => setShowItemPicker(false)}
      />
      <PartyPickerModal
        partyType="customer"
        title="ক্রেতা / দোকান বাছাই করুন"
        visible={showPartyPicker}
        items={customers}
        onSelect={(p) => {
          setCustomer(p);
          setShowPartyPicker(false);
        }}
        onClose={() => setShowPartyPicker(false)}
      />
    </ScrollView>
  );
}
