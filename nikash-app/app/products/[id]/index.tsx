import { useCallback, useState } from "react";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { PrimaryButton } from "@/components/form";
import { ConfirmModal } from "@/components/confirm-modal";
import { SkeletonDetail } from "@/components/skeleton";
import { Badge, Card, theme } from "@/components/ui";

type UnitRow = {
  id: string;
  unit_name: string;
  level: number;
  qty_below: number;
  factor_to_base: number;
  purchase_price: number | null;
  sale_price: number | null;
  is_default_sale: boolean;
  is_default_purchase: boolean;
};

type VariantDetail = {
  id: string;
  name: string;
  base_unit: string;
  track_expiry: boolean;
  allow_decimal: boolean;
  product_id: string;
  products: { name: string; is_archived: boolean | null } | null;
  variant_units: UnitRow[];
};

export default function ProductVariantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const toast = useToast();
  const [variant, setVariant] = useState<VariantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // মালিক ও ম্যানেজারই কেবল পণ্য বদলাতে/মুছতে পারবে
  const canManage = profile?.role === "owner" || profile?.role === "manager";

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("product_variants")
      .select(
        "id, name, base_unit, track_expiry, allow_decimal, product_id, products(name, is_archived), variant_units(id, unit_name, level, qty_below, factor_to_base, purchase_price, sale_price, is_default_sale, is_default_purchase)"
      )
      .eq("id", id)
      .maybeSingle();
    setVariant(data as unknown as VariantDetail);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleDelete() {
    if (!variant) return;
    setConfirmDelete(false);
    setDeleting(true);
    try {
      // লেনদেন থাকলে সার্ভার নিজেই আর্কাইভ করবে — পুরনো হিসাব যেন না ভাঙে
      const { data, error } = await supabase.rpc("delete_product", {
        p_product: variant.product_id,
      });
      if (error) throw error;

      if (data === "archived") {
        toast.success("এই পণ্যে লেনদেন আছে, তাই মুছে না ফেলে আর্কাইভ করা হয়েছে");
      } else {
        toast.success("পণ্যটি মুছে ফেলা হয়েছে");
      }
      router.back();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "মুছে ফেলা যায়নি");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: theme.bg }}>
        <Stack.Screen options={{ title: "প্রোডাক্ট", headerShown: true }} />
        <SkeletonDetail />
      </View>
    );
  }

  if (!variant) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "প্রোডাক্ট", headerShown: true }} />
        <Text style={{ color: theme.textMuted }}>প্রোডাক্টটি পাওয়া যায়নি</Text>
      </View>
    );
  }

  const units = [...variant.variant_units].sort((a, b) => a.level - b.level);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: variant.name, headerShown: true }} />

      <FlatList
        data={units}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 12 }}>
            <Card>
              <Text style={styles.productName}>{variant.products?.name}</Text>
              <Text style={styles.variantMeta}>
                {variant.name} · বেস ইউনিট: {variant.base_unit}
              </Text>
              <View style={styles.badgeRow}>
                {variant.track_expiry ? <Badge label="মেয়াদ ট্র্যাক" tone="info" /> : null}
                {variant.allow_decimal ? <Badge label="দশমিক পরিমাণ" tone="default" /> : null}
                {variant.products?.is_archived ? <Badge label="আর্কাইভড" tone="warning" /> : null}
              </View>

              {canManage ? (
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.action, { backgroundColor: theme.infoBg }]}
                    onPress={() => router.push(`/products/new?editId=${variant.id}`)}
                  >
                    <Text style={[styles.actionText, { color: theme.info }]}>✏️ সম্পাদনা</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.action, { backgroundColor: theme.dangerBg }]}
                    onPress={() => setConfirmDelete(true)}
                    disabled={deleting}
                  >
                    <Text style={[styles.actionText, { color: theme.danger }]}>
                      {deleting ? "মুছছে…" : "🗑️ মুছে ফেলুন"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Card>

            <PrimaryButton
              title="+ নতুন ইউনিট স্তর যোগ করুন (যেমন: কার্টন)"
              onPress={() => router.push(`/products/${variant.id}/add-unit`)}
              tone="success"
            />

            <Text style={styles.sectionTitle}>ইউনিট ও দাম</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.unitName}>
                  {item.unit_name} {item.level === 0 ? "(বেস)" : ""}
                </Text>
                <Text style={styles.unitMeta}>
                  ১ {item.unit_name} = {item.factor_to_base} {variant.base_unit}
                  {item.is_default_sale ? " · ডিফল্ট বিক্রয়" : ""}
                  {item.is_default_purchase ? " · ডিফল্ট ক্রয়" : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.price}>বিক্রয়: ৳{item.sale_price ?? "—"}</Text>
                <Text style={styles.priceSecondary}>ক্রয়: ৳{item.purchase_price ?? "—"}</Text>
              </View>
            </View>
          </Card>
        )}
      />

      <ConfirmModal
        visible={confirmDelete}
        title="পণ্যটি মুছে ফেলবেন?"
        message="এই পণ্যে আগের কোনো কেনাবেচা থাকলে মুছে যাবে না — আর্কাইভ হয়ে তালিকা থেকে সরে যাবে, পুরনো হিসাব ঠিক থাকবে।"
        confirmLabel="হ্যাঁ, মুছুন"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
  list: { padding: 16, paddingBottom: 32, gap: 10 },
  productName: { fontSize: 18, fontWeight: "700", color: theme.text },
  variantMeta: { fontSize: 13, color: theme.textMuted, marginTop: 3 },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  action: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  actionText: { fontSize: 13, fontWeight: "700" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: theme.text, marginTop: 4 },
  unitName: { fontSize: 15, fontWeight: "600", color: theme.text },
  unitMeta: { fontSize: 12, color: theme.textMuted, marginTop: 3 },
  price: { fontSize: 14, fontWeight: "700", color: theme.success },
  priceSecondary: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
});
