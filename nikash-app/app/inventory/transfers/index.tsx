import { useCallback, useState } from "react";
import { Stack, router, useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { PrimaryButton } from "@/components/form";

type TransferRow = {
  id: string;
  transfer_no: string;
  status: "draft" | "in_transit" | "received";
  entry_date: string;
  from: { name: string } | null;
  to: { name: string } | null;
};

const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: "#fef3c7", color: "#92400e", label: "ড্রাফট" },
  in_transit: { bg: "#dbeafe", color: "#1d4ed8", label: "পথে আছে" },
  received: { bg: "#dcfce7", color: "#15803d", label: "গৃহীত" },
};

export default function TransfersScreen() {
  const { profile } = useAuth();
  const toast = useToast();
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from("stock_transfers")
      .select("id, transfer_no, status, entry_date, from:from_location_id(name), to:to_location_id(name)")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(100);
    setTransfers((data as unknown as TransferRow[]) ?? []);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleReceive(id: string) {
    setBusyId(id);
    const { error } = await supabase.rpc("receive_stock_transfer", { p_transfer: id });
    setBusyId(null);
    if (error) {
      toast.error(error.message.length > 60 ? "গ্রহণ ব্যর্থ হয়েছে" : error.message);
      return;
    }
    toast.success("স্থানান্তর গ্রহণ করা হয়েছে");
    load();
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "স্থানান্তর", headerShown: true }} />

      <View style={styles.addBar}>
        <PrimaryButton title="+ নতুন স্থানান্তর" onPress={() => router.push("/inventory/transfers/new")} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={transfers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>কোনো স্থানান্তর নেই</Text>}
          renderItem={({ item }) => {
            const s = statusStyle[item.status];
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.from?.name} → {item.to?.name}
                  </Text>
                  <Text style={styles.meta}>
                    {item.transfer_no} · {item.entry_date}
                  </Text>
                  <Text style={[styles.badge, { backgroundColor: s.bg, color: s.color }]}>{s.label}</Text>
                </View>
                {item.status === "in_transit" && (
                  <PrimaryButton
                    title="গ্রহণ করুন"
                    onPress={() => handleReceive(item.id)}
                    loading={busyId === item.id}
                    tone="success"
                  />
                )}
              </View>
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
    gap: 10,
  },
  name: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  badge: { fontSize: 10, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 6, alignSelf: "flex-start", overflow: "hidden" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
});
