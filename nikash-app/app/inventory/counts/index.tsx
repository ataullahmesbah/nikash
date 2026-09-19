import { useCallback, useState } from "react";
import { Stack, router, useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PrimaryButton } from "@/components/form";

type CountRow = {
  id: string;
  status: "draft" | "counting" | "review" | "approved";
  count_date: string;
  total_difference_value: number;
  locations: { name: string } | null;
};

const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: "#f1f5f9", color: "#64748b", label: "ড্রাফট" },
  counting: { bg: "#dbeafe", color: "#1d4ed8", label: "গণনা চলছে" },
  review: { bg: "#fef3c7", color: "#92400e", label: "পর্যালোচনা" },
  approved: { bg: "#dcfce7", color: "#15803d", label: "অনুমোদিত" },
};

export default function StockCountsScreen() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from("stock_counts")
      .select("id, status, count_date, total_difference_value, locations(name)")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(50);
    setCounts((data as unknown as CountRow[]) ?? []);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "স্টক গণনা", headerShown: true }} />

      <View style={styles.addBar}>
        <PrimaryButton title="+ নতুন গণনা শুরু করুন" onPress={() => router.push("/inventory/counts/new")} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={counts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>কোনো গণনা নেই</Text>}
          renderItem={({ item }) => {
            const s = statusStyle[item.status];
            return (
              <Pressable style={styles.row} onPress={() => router.push(`/inventory/counts/${item.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.locations?.name}</Text>
                  <Text style={styles.meta}>{item.count_date}</Text>
                </View>
                <Text style={[styles.badge, { backgroundColor: s.bg, color: s.color }]}>{s.label}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addBar: { padding: 16, paddingBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
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
  badge: { fontSize: 11, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: "hidden" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
});
