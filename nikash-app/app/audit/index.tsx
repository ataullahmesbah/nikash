import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { daysAgoBn, formatDateBn } from "@/lib/format";
import { Badge, EmptyState, theme } from "@/components/ui";
import { SkeletonList } from "@/components/skeleton";

type AuditRow = {
  id: string;
  entity_type: string;
  action: string;
  reason: string | null;
  created_at: string;
  users: { name: string } | null;
};

const ENTITY_BN: Record<string, string> = {
  sale: "বিক্রয়", purchase: "ক্রয়", party: "পার্টি",
  product: "প্রোডাক্ট", expense: "খরচ", payment: "পেমেন্ট",
};
const ACTION: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" }> = {
  create: { label: "তৈরি", tone: "success" },
  update: { label: "সম্পাদনা", tone: "warning" },
  delete: { label: "মুছে ফেলা", tone: "danger" },
  void: { label: "বাতিল", tone: "danger" },
  unpost: { label: "আনপোস্ট", tone: "warning" },
  deactivate: { label: "নিষ্ক্রিয়", tone: "warning" },
  archive: { label: "আর্কাইভ", tone: "info" },
};

export default function AuditScreen() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from("entity_audit_log")
      .select("id, entity_type, action, reason, created_at, users:user_id(name)")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data ?? []) as unknown as AuditRow[]);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: "অডিট লগ", headerShown: true }} />
      {loading && rows.length === 0 ? (
        <SkeletonList rows={6} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={rows.length === 0 ? { flex: 1 } : styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          ListEmptyComponent={
            <EmptyState icon="🕓" title="কোনো পরিবর্তনের রেকর্ড নেই" message="কেউ কিছু সম্পাদনা বা মুছলে এখানে দেখা যাবে।" />
          }
          renderItem={({ item }) => {
            const act = ACTION[item.action] ?? { label: item.action, tone: "info" as const };
            return (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>
                    {ENTITY_BN[item.entity_type] ?? item.entity_type} — {act.label}
                  </Text>
                  {item.reason ? <Text style={styles.reason}>“{item.reason}”</Text> : null}
                  <Text style={styles.meta}>
                    {item.users?.name ?? "—"} · {daysAgoBn(item.created_at)} · {formatDateBn(item.created_at, true)}
                  </Text>
                </View>
                <Badge label={act.label} tone={act.tone} />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
  },
  title: { fontSize: 14, fontWeight: "700", color: theme.text },
  reason: { fontSize: 12.5, color: theme.textMuted, marginTop: 4, fontStyle: "italic" },
  meta: { fontSize: 11, color: theme.textFaint, marginTop: 5 },
});
