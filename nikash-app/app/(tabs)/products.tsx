import { useCallback, useState, useMemo } from "react";
import { useFocusEffect, router } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { loadWithCache } from "@/lib/list-cache";
import { PrimaryButton } from "@/components/form";
import { SearchBar } from "@/components/search-bar";

type VariantRow = {
  id: string;
  name: string;
  base_unit: string;
  products: { name: string } | null;
  variant_units: { unit_name: string; sale_price: number | null; is_default_sale: boolean }[];
};

export default function ProductsScreen() {
  const { profile } = useAuth();
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data, stale: isStale } = await loadWithCache(`nikash:products-list:${profile.company_id}`, async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, name, base_unit, products(name), variant_units(unit_name, sale_price, is_default_sale)")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as unknown as VariantRow[]) ?? [];
    });
    setVariants(data);
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
    if (!q) return variants;
    return variants.filter((v) => (v.products?.name ?? "").toLowerCase().includes(q) || v.name.toLowerCase().includes(q));
  }, [variants, search]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.addBar}>
        <PrimaryButton title="+ নতুন প্রোডাক্ট" onPress={() => router.push("/products/new")} />
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="পণ্যের নাম..." />
      </View>
      {stale && <Text style={styles.offlineBanner}>অফলাইন — শেষবার লোড হওয়া তালিকা দেখাচ্ছে</Text>}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>কোনো প্রোডাক্ট নেই — প্রথমে প্রোডাক্ট যোগ করুন</Text>}
          renderItem={({ item }) => {
            const defaultUnit = item.variant_units.find((u) => u.is_default_sale) ?? item.variant_units[0];
            return (
              <Pressable style={styles.row} onPress={() => router.push(`/products/${item.id}`)}>
                <Text style={styles.productName}>{item.products?.name}</Text>
                <Text style={styles.variantName}>{item.name}</Text>
                {defaultUnit && (
                  <Text style={styles.price}>
                    ৳{defaultUnit.sale_price ?? "—"} / {defaultUnit.unit_name}
                  </Text>
                )}
              </Pressable>
            );
          }}
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
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  productName: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  variantName: { fontSize: 13, color: "#64748b", marginTop: 2 },
  price: { fontSize: 14, color: "#059669", fontWeight: "600", marginTop: 6 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
});
