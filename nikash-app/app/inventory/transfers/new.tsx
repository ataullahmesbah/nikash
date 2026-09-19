import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, router } from "expo-router";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { loadCatalog, type PickableUnit } from "@/lib/catalog";
import { ErrorText, PrimaryButton, SegmentedControl } from "@/components/form";
import { ItemPickerModal } from "@/components/item-picker-modal";

type Location = { id: string; name: string };
type TransferLine = { key: string; variantId: string; productName: string; variantName: string; qty: string };

export default function NewTransferScreen() {
  const { profile } = useAuth();
  const toast = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<PickableUnit[]>([]);
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("locations")
      .select("id, name")
      .eq("company_id", profile.company_id)
      .then(({ data }) => setLocations(data ?? []));
    loadCatalog(profile.company_id).then(setCatalog).catch(() => {});
  }, [profile]);

  function addItem(unit: PickableUnit) {
    if (lines.some((l) => l.variantId === unit.variant_id)) {
      setShowPicker(false);
      return;
    }
    setLines((prev) => [
      ...prev,
      { key: unit.id, variantId: unit.variant_id, productName: unit.product_name, variantName: unit.variant_name, qty: "1" },
    ]);
    setShowPicker(false);
  }

  async function handleSave() {
    if (!profile) return;
    if (!fromId || !toId || fromId === toId) {
      setError("দুটো ভিন্ন গুদাম বাছাই করুন");
      return;
    }
    if (lines.length === 0) {
      setError("অন্তত একটা প্রোডাক্ট যোগ করুন");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const transferId = Crypto.randomUUID();
      const { error: trErr } = await supabase.from("stock_transfers").insert({
        id: transferId,
        company_id: profile.company_id,
        transfer_no: `TRF-${Date.now()}`,
        from_location_id: fromId,
        to_location_id: toId,
        sent_by: profile.id,
        status: "draft",
      });
      if (trErr) throw trErr;

      const itemRows = lines.map((l) => ({
        company_id: profile.company_id,
        transfer_id: transferId,
        variant_id: l.variantId,
        qty_base: Number(l.qty) || 0,
      }));
      const { error: itemsErr } = await supabase.from("stock_transfer_items").insert(itemRows);
      if (itemsErr) throw itemsErr;

      const { error: postErr } = await supabase.rpc("post_stock_transfer", { p_transfer: transferId });
      if (postErr) throw postErr;

      toast.success("স্থানান্তর পাঠানো হয়েছে");
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : "ব্যর্থ হয়েছে";
      setError(message);
      toast.error(message.length > 60 ? "সংরক্ষণ ব্যর্থ, আবার চেষ্টা করুন" : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: "নতুন স্থানান্তর", headerShown: true }} />

      <Text style={styles.label}>কোথা থেকে</Text>
      <SegmentedControl
        value={fromId ?? ""}
        onChange={setFromId}
        options={locations.map((l) => ({ label: l.name, value: l.id }))}
      />
      <Text style={styles.label}>কোথায়</Text>
      <SegmentedControl
        value={toId ?? ""}
        onChange={setToId}
        options={locations.map((l) => ({ label: l.name, value: l.id }))}
      />

      <PrimaryButton title="+ প্রোডাক্ট যোগ করুন" onPress={() => setShowPicker(true)} tone="success" />

      <View style={{ marginTop: 10 }}>
        {lines.map((line) => (
          <View key={line.key} style={styles.lineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineName}>{line.productName}</Text>
              <Text style={styles.lineMeta}>{line.variantName}</Text>
            </View>
            <TextInput
              style={styles.qtyInput}
              keyboardType="numeric"
              value={line.qty}
              onChangeText={(v) =>
                setLines((prev) => prev.map((l) => (l.key === line.key ? { ...l, qty: v } : l)))
              }
            />
            <Pressable onPress={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}>
              <Text style={styles.remove}>সরান</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <ErrorText>{error}</ErrorText>
      <PrimaryButton title="স্থানান্তর পাঠান" onPress={handleSave} loading={loading} />

      <ItemPickerModal
        visible={showPicker}
        items={catalog}
        priceField="purchase_price"
        onSelect={addItem}
        onClose={() => setShowPicker(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: "#475569", marginBottom: 6, fontWeight: "600" },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
    gap: 10,
  },
  lineName: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  lineMeta: { fontSize: 12, color: "#64748b" },
  qtyInput: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, width: 60, padding: 8, textAlign: "center" },
  remove: { color: "#dc2626", fontSize: 12, fontWeight: "600" },
});
