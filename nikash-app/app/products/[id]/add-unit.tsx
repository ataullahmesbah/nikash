import { useEffect, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { ErrorText, FormField, PrimaryButton } from "@/components/form";

type ExistingUnit = { unit_name: string; level: number };

export default function AddUnitLevelScreen() {
  const { id: variantId } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [belowUnitName, setBelowUnitName] = useState("");
  const [nextLevel, setNextLevel] = useState(1);
  const [unitName, setUnitName] = useState("");
  const [qtyBelow, setQtyBelow] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [isDefaultSale, setIsDefaultSale] = useState(false);
  const [isDefaultPurchase, setIsDefaultPurchase] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("variant_units")
      .select("unit_name, level")
      .eq("variant_id", variantId)
      .order("level", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const top = data as ExistingUnit | null;
        setBelowUnitName(top?.unit_name ?? "");
        setNextLevel((top?.level ?? -1) + 1);
      });
  }, [variantId]);

  async function handleSave() {
    if (!profile) return;
    if (!unitName.trim() || !qtyBelow || Number(qtyBelow) <= 0 || !salePrice) {
      setError("ইউনিটের নাম, পরিমাণ ও বিক্রয়মূল্য দিন");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Note: this insert goes straight to Supabase (not the offline
      // queue) because factor_to_base is computed by a server-side
      // trigger (trg_variant_unit_factor) right after insert — the app
      // needs that trigger to have already run before this screen is
      // useful again, which an offline-queued write can't guarantee.
      const { error: insErr } = await supabase.from("variant_units").insert({
        company_id: profile.company_id,
        variant_id: variantId,
        unit_name: unitName.trim(),
        level: nextLevel,
        qty_below: Number(qtyBelow),
        purchase_price: purchasePrice ? Number(purchasePrice) : null,
        sale_price: Number(salePrice),
        is_default_sale: isDefaultSale,
        is_default_purchase: isDefaultPurchase,
      });
      if (insErr) throw insErr;
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: "নতুন ইউনিট স্তর", headerShown: true }} />

      <FormField
        label="ইউনিটের নাম *"
        value={unitName}
        onChangeText={setUnitName}
        placeholder="যেমন: কার্টন"
      />
      <FormField
        label={`১টাতে কয়টা ${belowUnitName || "নিচের ইউনিট"} হয়? *`}
        value={qtyBelow}
        onChangeText={setQtyBelow}
        keyboardType="numeric"
        placeholder="যেমন: ১২"
      />
      <FormField label="ক্রয়মূল্য (এই ইউনিটে)" value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="numeric" />
      <FormField label="বিক্রয়মূল্য (এই ইউনিটে) *" value={salePrice} onChangeText={setSalePrice} keyboardType="numeric" />

      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 }}>
        <Switch value={isDefaultSale} onValueChange={setIsDefaultSale} />
        <Text style={{ color: "#334155" }}>এই ইউনিট ডিফল্ট বিক্রয় একক হবে</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 10 }}>
        <Switch value={isDefaultPurchase} onValueChange={setIsDefaultPurchase} />
        <Text style={{ color: "#334155" }}>এই ইউনিট ডিফল্ট ক্রয় একক হবে</Text>
      </View>

      <Text style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16 }}>
        মনে রাখবেন: কার্টনের দাম কখনো (১২ × বোতলের দাম) না — এখানে যা লিখবেন সেটাই ব্যবহার হবে।
      </Text>

      <ErrorText>{error}</ErrorText>
      <PrimaryButton title="সংরক্ষণ করুন" onPress={handleSave} loading={loading} tone="success" />
    </ScrollView>
  );
}
