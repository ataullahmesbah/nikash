import { useCallback, useState, useMemo } from "react";
import { useFocusEffect, router } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { loadWithCache } from "@/lib/list-cache";
import { PrimaryButton } from "@/components/form";
import { SearchBar } from "@/components/search-bar";

type PartyRow = {
  id: string;
  name: string;
  type: "supplier" | "customer";
  phone: string | null;
  area: string | null;
  status: string;
};

const FILTERS = [
  { key: "active", label: "🟢 চালু" },
  { key: "closed", label: "🔴 বন্ধ" },
  { key: "all", label: "সব" },
] as const;

export default function PartiesScreen() {
  const { profile } = useAuth();
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("active");
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    // বন্ধ পার্টিও আনি, যাতে ফিল্টার বদলালে নেট ছাড়াও দেখা যায়
    const { data, stale: isStale } = await loadWithCache(`nikash:parties-list:${profile.company_id}`, async () => {
      const { data, error } = await supabase
        .from("parties")
        .select("id, name, type, phone, area, status")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    });
    setParties(data);
    setStale(isStale);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parties.filter((p) => {
      if (filter === "active" && p.status !== "active") return false;
      if (filter === "closed" && p.status === "active") return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.phone ?? "").includes(q) ||
        (p.area ?? "").toLowerCase().includes(q)
      );
    });
  }, [parties, search, filter]);

  const closedCount = useMemo(() => parties.filter((p) => p.status !== "active").length, [parties]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.addBar}>
        <PrimaryButton title="+ নতুন পার্টি" onPress={() => router.push("/parties/new")} />
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="নাম, ফোন বা এলাকা..." />
      </View>
      <View style={styles.chipRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipOn]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextOn]}>
              {f.label}
              {f.key === "closed" && closedCount > 0 ? ` (${closedCount})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      {stale && <Text style={styles.offlineBanner}>অফলাইন — শেষবার লোড হওয়া তালিকা দেখাচ্ছে</Text>}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{filter === "closed" ? "বন্ধ করা কোনো পার্টি নেই" : "কোনো পার্টি নেই"}</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/parties/${item.id}`)}>
              <View
                style={[styles.dot, item.status === "active" ? styles.dotOn : styles.dotOff]}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, item.status !== "active" && styles.nameOff]}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.phone ?? "—"} {item.area ? `· ${item.area}` : ""}
                  {item.status !== "active" ? " · কাজ বন্ধ" : ""}
                </Text>
              </View>
              <Text style={[styles.badge, item.type === "customer" ? styles.badgeCustomer : styles.badgeSupplier]}>
                {item.type === "customer" ? "ক্রেতা" : "সরবরাহকারী"}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  addBar: { padding: 16, paddingBottom: 8 },
  offlineBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 8,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#92400e",
    backgroundColor: "#fef3c7",
    borderRadius: 8,
  },
  chipRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipOn: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  chipTextOn: { color: "#fff" },
  dot: { width: 9, height: 9, borderRadius: 999, marginRight: 10 },
  dotOn: { backgroundColor: "#059669" },
  dotOff: { backgroundColor: "#dc2626" },
  nameOff: { color: "#94a3b8" },
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
  meta: { fontSize: 13, color: "#64748b", marginTop: 2 },
  badge: { fontSize: 11, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeCustomer: { backgroundColor: "#dcfce7", color: "#15803d" },
  badgeSupplier: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
});
