import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Stack, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { ErrorText, PrimaryButton, SegmentedControl } from "@/components/form";

type Location = { id: string; name: string };

export default function NewStockCountScreen() {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("locations")
      .select("id, name, is_default")
      .eq("company_id", profile.company_id)
      .then(({ data }) => {
        setLocations(data ?? []);
        const def = (data ?? []).find((l) => l.is_default);
        setLocationId(def?.id ?? data?.[0]?.id ?? null);
      });
  }, [profile]);

  async function handleStart() {
    if (!profile || !locationId) {
      setError("গুদাম বাছাই করুন");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Snapshot the system's current view of stock at this location the
      // moment counting starts — this is what "counted" gets compared
      // against later, per PRD 14.5.
      const [variantsRes, stockRes] = await Promise.all([
        supabase
          .from("product_variants")
          .select("id")
          .eq("company_id", profile.company_id)
          .eq("is_active", true),
        supabase
          .from("v_current_stock")
          .select("variant_id, qty_base")
          .eq("company_id", profile.company_id)
          .eq("location_id", locationId),
      ]);

      const stockMap: Record<string, number> = {};
      (stockRes.data ?? []).forEach((r) => (stockMap[r.variant_id] = Number(r.qty_base)));

      const variantIds = (variantsRes.data ?? []).map((v) => v.id);
      if (variantIds.length === 0) {
        setError("এই কোম্পানিতে কোনো সক্রিয় প্রোডাক্ট নেই");
        setLoading(false);
        return;
      }

      const { data: count, error: countErr } = await supabase
        .from("stock_counts")
        .insert({
          company_id: profile.company_id,
          location_id: locationId,
          started_by: profile.id,
          status: "counting",
        })
        .select("id")
        .single();
      if (countErr) throw countErr;

      const itemRows = variantIds.map((variantId) => ({
        company_id: profile.company_id,
        count_id: count.id,
        variant_id: variantId,
        system_qty: stockMap[variantId] ?? 0,
      }));
      const { error: itemsErr } = await supabase.from("stock_count_items").insert(itemRows);
      if (itemsErr) throw itemsErr;

      router.replace(`/inventory/counts/${count.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "শুরু করা যায়নি");
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: "নতুন স্টক গণনা", headerShown: true }} />

      <SegmentedControl
        value={locationId ?? ""}
        onChange={setLocationId}
        options={locations.map((l) => ({ label: l.name, value: l.id }))}
      />

      <View style={{ marginTop: 8 }}>
        <ErrorText>{error}</ErrorText>
        <PrimaryButton title="গণনা শুরু করুন" onPress={handleStart} loading={loading} tone="success" />
      </View>
    </ScrollView>
  );
}
