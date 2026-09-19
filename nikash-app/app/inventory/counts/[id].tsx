import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { PrimaryButton } from "@/components/form";

type CountItem = {
  id: string;
  variant_id: string;
  system_qty: number;
  counted_qty: number | null;
  product_variants: { name: string; base_unit: string; products: { name: string } | null } | null;
};

type CountHeader = {
  id: string;
  status: "draft" | "counting" | "review" | "approved";
  count_date: string;
  total_difference_value: number;
  locations: { name: string } | null;
};

export default function StockCountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const toast = useToast();
  const [header, setHeader] = useState<CountHeader | null>(null);
  const [items, setItems] = useState<CountItem[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [headerRes, itemsRes] = await Promise.all([
      supabase
        .from("stock_counts")
        .select("id, status, count_date, total_difference_value, locations(name)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("stock_count_items")
        .select("id, variant_id, system_qty, counted_qty, product_variants(name, base_unit, products(name))")
        .eq("count_id", id),
    ]);
    setHeader(headerRes.data as unknown as CountHeader);
    setItems((itemsRes.data as unknown as CountItem[]) ?? []);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const withNames = items.map((it) => ({
      ...it,
      productName: it.product_variants?.products?.name ?? "",
      variantName: it.product_variants?.name ?? "",
    }));
    if (!needle) return withNames;
    return withNames.filter(
      (it) => it.productName.toLowerCase().includes(needle) || it.variantName.toLowerCase().includes(needle)
    );
  }, [items, search]);

  const canEdit = header?.status === "counting" || header?.status === "review";
  const canApprove = canEdit && (profile?.role === "owner" || profile?.role === "manager");
  const countedItems = items.filter((it) => it.counted_qty !== null || edits[it.id] !== undefined).length;
  const diffItems = items.filter((it) => {
    const counted = edits[it.id] !== undefined ? Number(edits[it.id]) : it.counted_qty;
    return counted !== null && counted !== undefined && Number(counted) !== Number(it.system_qty);
  }).length;

  async function handleSave() {
    setBusy(true);
    try {
      const updates = Object.entries(edits);
      for (const [itemId, value] of updates) {
        await supabase
          .from("stock_count_items")
          .update({ counted_qty: value.trim() === "" ? null : Number(value) })
          .eq("id", itemId);
      }
      setEdits({});
      await load();
      toast.success(`${updates.length}টা লাইন সেভ হয়েছে`);
    } catch (e) {
      toast.error(e instanceof Error && e.message.length <= 60 ? e.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendToReview() {
    setBusy(true);
    const { error } = await supabase.from("stock_counts").update({ status: "review" }).eq("id", id);
    setBusy(false);
    if (error) {
      toast.error(error.message.length > 60 ? "ব্যর্থ হয়েছে" : error.message);
      return;
    }
    toast.info("পর্যালোচনার জন্য পাঠানো হয়েছে");
    load();
  }

  async function handleApprove() {
    setBusy(true);
    const { data, error } = await supabase.rpc("approve_stock_count", { p_count: id });
    setBusy(false);
    if (error) {
      toast.error(error.message.length > 60 ? "অনুমোদন ব্যর্থ হয়েছে" : error.message);
      return;
    }
    toast.success(`অনুমোদিত — ${data}টা প্রোডাক্টে সমন্বয় করা হয়েছে`);
    load();
  }

  if (loading || !header) {
    return (
      <View style={styles.center}>
        <Text>লোড হচ্ছে...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: header.locations?.name ?? "স্টক গণনা", headerShown: true }} />

      <View style={styles.summary}>
        <Text style={styles.summaryLine}>
          {countedItems}/{items.length} গণনা হয়েছে · {diffItems}টা গরমিল · অবস্থা: {header.status}
        </Text>
        <TextInput
          style={styles.search}
          placeholder="প্রোডাক্ট খুঁজুন..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const value = edits[item.id] ?? (item.counted_qty !== null ? String(item.counted_qty) : "");
          const counted = value.trim() === "" ? null : Number(value);
          const hasDiff = counted !== null && counted !== Number(item.system_qty);
          return (
            <View style={[styles.row, hasDiff && styles.rowDiff]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.productName}</Text>
                <Text style={styles.meta}>
                  {item.variantName} · সিস্টেমে: {item.system_qty} {item.product_variants?.base_unit}
                </Text>
              </View>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                editable={canEdit}
                value={value}
                onChangeText={(v) => setEdits((prev) => ({ ...prev, [item.id]: v }))}
                placeholder="আসল"
              />
            </View>
          );
        }}
      />

      {canEdit && (
        <View style={styles.actions}>
          <PrimaryButton title="সংরক্ষণ করুন" onPress={handleSave} loading={busy} />
          {header.status === "counting" && (
            <PrimaryButton title="পর্যালোচনার জন্য পাঠান" onPress={handleSendToReview} tone="success" />
          )}
          {canApprove && (
            <PrimaryButton title="অনুমোদন ও সমন্বয় করুন" onPress={handleApprove} loading={busy} tone="danger" />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  summary: { padding: 16, paddingBottom: 8, gap: 8 },
  summaryLine: { fontSize: 13, color: "#475569", fontWeight: "600" },
  search: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  rowDiff: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  name: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    width: 70,
    padding: 8,
    textAlign: "center",
  },
  actions: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#fff" },
});
