import { useCallback, useState } from "react";
import { Stack, useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { status as statusColors } from "@/lib/chart-colors";

type BatchRow = {
  id: string;
  batch_no: string;
  expiry_date: string | null;
  qty_base_remaining: number;
  product_variants: { name: string; base_unit: string; products: { name: string } | null } | null;
};

function urgency(expiryDate: string | null): { color: string; label: string } {
  if (!expiryDate) return { color: "#94a3b8", label: "মেয়াদ নেই" };
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return { color: statusColors.critical, label: "মেয়াদোত্তীর্ণ" };
  if (days <= 30) return { color: statusColors.critical, label: `${days} দিন বাকি` };
  if (days <= 90) return { color: statusColors.warning, label: `${days} দিন বাকি` };
  return { color: statusColors.good, label: `${days} দিন বাকি` };
}

export default function ExpiryRegisterScreen() {
  const { profile } = useAuth();
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from("batches")
      .select("id, batch_no, expiry_date, qty_base_remaining, product_variants(name, base_unit, products(name))")
      .eq("company_id", profile.company_id)
      .gt("qty_base_remaining", 0)
      .order("expiry_date", { ascending: true, nullsFirst: false });
    setBatches((data as unknown as BatchRow[]) ?? []);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "মেয়াদ রেজিস্টার", headerShown: true }} />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={batches}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>মেয়াদ-ট্র্যাক করা কোনো স্টক নেই</Text>
          }
          renderItem={({ item }) => {
            const u = urgency(item.expiry_date);
            return (
              <View style={[styles.row, { borderLeftColor: u.color, borderLeftWidth: 4 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.product_variants?.products?.name}</Text>
                  <Text style={styles.meta}>
                    {item.product_variants?.name} · ব্যাচ {item.batch_no} ·{" "}
                    {item.qty_base_remaining} {item.product_variants?.base_unit}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.date}>{item.expiry_date ?? "—"}</Text>
                  <Text style={[styles.badge, { color: u.color }]}>{u.label}</Text>
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
  list: { paddingHorizontal: 16, paddingVertical: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  date: { fontSize: 12, color: "#64748b" },
  badge: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
});
