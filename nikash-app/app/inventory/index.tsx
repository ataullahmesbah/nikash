import { useCallback, useState } from "react";
import { Stack, router, useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { biggestPack, formatPackQty, type PackUnit } from "@/lib/format";
import { PrimaryButton } from "@/components/form";

type StockRow = {
  variant_id: string;
  location_id: string | null;
  qty_base: number;
  avg_cost: number;
  stock_value: number;
};

type VariantMeta = {
  id: string;
  name: string;
  base_unit: string;
  min_stock_alert: number;
  product_name: string;
  /** সবচেয়ে বড় প্যাক (কেস/কার্টন/বস্তা), থাকলে */
  pack: PackUnit | null;
};

export default function InventoryScreen() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<StockRow[]>([]);
  const [meta, setMeta] = useState<Record<string, VariantMeta>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const [stockRes, variantsRes, locationsRes] = await Promise.all([
      supabase
        .from("v_current_stock")
        .select("variant_id, location_id, qty_base, avg_cost, stock_value")
        .eq("company_id", profile.company_id),
      supabase
        .from("product_variants")
        .select("id, name, base_unit, min_stock_alert, products(name), variant_units(unit_name, level, factor_to_base)")
        .eq("company_id", profile.company_id),
      supabase.from("locations").select("id, name").eq("company_id", profile.company_id),
    ]);

    const metaMap: Record<string, VariantMeta> = {};
    (variantsRes.data ?? []).forEach((v) => {
      const units = (v.variant_units ?? []) as unknown as {
        unit_name: string;
        level: number;
        factor_to_base: number;
      }[];

      metaMap[v.id] = {
        id: v.id,
        name: v.name,
        base_unit: v.base_unit,
        min_stock_alert: v.min_stock_alert,
        product_name: (v.products as unknown as { name: string } | null)?.name ?? "",
        pack: biggestPack(units),
      };
    });
    const locMap: Record<string, string> = {};
    (locationsRes.data ?? []).forEach((l) => (locMap[l.id] = l.name));

    setMeta(metaMap);
    setLocations(locMap);
    setRows((stockRes.data as StockRow[]) ?? []);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalValue = rows.reduce((sum, r) => sum + Number(r.stock_value), 0);
  const lowStock = rows.filter((r) => {
    const m = meta[r.variant_id];
    return m && m.min_stock_alert > 0 && Number(r.qty_base) <= m.min_stock_alert;
  });

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "বর্তমান স্টক", headerShown: true }} />

      <View style={styles.summary}>
        <Text style={styles.summaryText}>মোট স্টক মূল্য: ৳{totalValue.toLocaleString("en-BD")}</Text>
        <Text style={styles.summaryHint}>
          গুদামে এখন যত মাল আছে, তার ক্রয়মূল্যের মোট হিসাব
        </Text>
        {lowStock.length > 0 && (
          <Text style={styles.lowStockNote}>⚠️ {lowStock.length}টি প্রোডাক্টের স্টক কম</Text>
        )}
      </View>

      <View style={styles.actionsRow}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="স্টক সমন্বয়" onPress={() => router.push("/inventory/adjust")} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="স্থানান্তর" onPress={() => router.push("/inventory/transfers")} tone="success" />
        </View>
      </View>
      <View style={[styles.actionsRow, { marginTop: 0 }]}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="স্টক গণনা" onPress={() => router.push("/inventory/counts")} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title="মেয়াদ রেজিস্টার" onPress={() => router.push("/inventory/expiry")} tone="danger" />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={rows.filter((r) => Number(r.qty_base) !== 0)}
          keyExtractor={(item, idx) => `${item.variant_id}-${item.location_id}-${idx}`}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>এখনো কোনো স্টক নেই{"\n"}ক্রয় এন্ট্রি দিলে এখানে দেখা যাবে</Text>}
          renderItem={({ item }) => {
            const m = meta[item.variant_id];
            const isLow = m && m.min_stock_alert > 0 && Number(item.qty_base) <= m.min_stock_alert;
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{m?.product_name}</Text>
                  <Text style={styles.meta}>
                    {m?.name} · {item.location_id ? locations[item.location_id] : "—"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.qty, isLow && styles.qtyLow]}>
                    {m ? formatPackQty(Number(item.qty_base), m.base_unit, m.pack) : item.qty_base}
                  </Text>
                  {m?.pack && Math.abs(Number(item.qty_base)) >= m.pack.factor && (
                    <Text style={styles.qtyBase}>
                      মোট {Number(Number(item.qty_base).toFixed(3))} {m.base_unit}
                    </Text>
                  )}
                  <Text style={styles.value}>৳{Number(item.stock_value).toFixed(0)}</Text>
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
  summary: { padding: 16, paddingBottom: 8 },
  summaryText: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  lowStockNote: { fontSize: 13, color: "#d97706", marginTop: 4, fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  row: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  qty: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  qtyLow: { color: "#dc2626" },
  qtyBase: { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  summaryHint: { fontSize: 11.5, color: "#64748b", marginTop: 3 },
  value: { fontSize: 12, color: "#64748b", marginTop: 2 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
});
