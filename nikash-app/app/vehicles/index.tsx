import { useCallback, useState } from "react";
import { Stack, router, useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { PrimaryButton } from "@/components/form";
import { RowActions } from "@/components/row-actions";

type Vehicle = {
  id: string;
  reg_no: string;
  type: string | null;
  driver_name: string | null;
  driver_phone: string | null;
};

export default function VehiclesScreen() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from("vehicles")
      .select("id, reg_no, type, driver_name, driver_phone")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setVehicles(data ?? []);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "গাড়ি", headerShown: true }} />

      <View style={styles.addBar}>
        <PrimaryButton title="+ নতুন গাড়ি" onPress={() => router.push("/vehicles/new")} />
        <View style={{ height: 8 }} />
        <PrimaryButton title="ট্রিপের তালিকা" onPress={() => router.push("/trips")} tone="success" />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>কোনো গাড়ি নেই{"\n"}উপরে + চেপে যোগ করুন</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.name}>{item.reg_no}</Text>
              <Text style={styles.meta}>
                {item.type ?? "—"} · {item.driver_name ?? "চালক নেই"} {item.driver_phone ? `· ${item.driver_phone}` : ""}
              </Text>
              <RowActions
                table="vehicles"
                id={item.id}
                editHref={`/vehicles/new?editId=${item.id}`}
                label="গাড়িটি"
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
  meta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
});
