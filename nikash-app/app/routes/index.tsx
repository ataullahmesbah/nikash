import { useCallback, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { Stack } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PrimaryButton } from "@/components/form";
import { RowActions } from "@/components/row-actions";

type RouteRow = { id: string; name: string; area: string | null };

export default function RoutesScreen() {
  const { profile } = useAuth();
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from("routes")
      .select("id, name, area")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setRoutes(data ?? []);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "রুট ব্যবস্থাপনা", headerShown: true }} />

      <View style={styles.addBar}>
        <PrimaryButton title="+ নতুন রুট" onPress={() => router.push("/routes/new")} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>কোনো রুট নেই — পার্টি ও ট্রিপে রুট ট্যাগ করতে প্রথমে একটা রুট বানান</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              {item.area && <Text style={styles.meta}>{item.area}</Text>}
              <RowActions
                table="routes"
                id={item.id}
                editHref={`/routes/new?editId=${item.id}`}
                label="রুটটি"
                deleteMessage="এই রুটে ট্যাগ করা পার্টি ও ট্রিপ থেকে যাবে, শুধু নতুন এন্ট্রিতে রুটটি আর দেখা যাবে না।"
                onDone={load}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addBar: { padding: 16, paddingBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  meta: { fontSize: 13, color: "#64748b", marginTop: 2 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40, paddingHorizontal: 20 },
});
