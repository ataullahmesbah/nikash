import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { errorMessage, toastMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { enqueueWriteAndSync } from "@/lib/offline/sync-queue";
import { ErrorText, FormField, PrimaryButton } from "@/components/form";
import { SkeletonDetail } from "@/components/skeleton";
import { theme } from "@/components/ui";

// এক ফর্মেই নতুন প্রোডাক্ট ও সম্পাদনা — ?editId=<variant id> দিলে এডিট মোড।
// এডিটে ভ্যারিয়েন্ট, তার প্রোডাক্টের নাম ও বেস ইউনিটের দাম বদলানো যায়;
// বাড়তি ইউনিট স্তর (কার্টন/বস্তা) আলাদা স্ক্রিন থেকেই যোগ/সম্পাদনা হয়।
export default function ProductFormScreen() {
  // পিকার থেকে এলে যে নামটা খোঁজা হচ্ছিল সেটাই আগে বসে থাকে
  const { editId, name: presetName } = useLocalSearchParams<{ editId?: string; name?: string }>();
  const isEdit = !!editId;
  const { profile } = useAuth();
  const toast = useToast();

  const [categoryName, setCategoryName] = useState("");
  const [productName, setProductName] = useState(presetName ?? "");
  const [variantName, setVariantName] = useState("");
  const [baseUnit, setBaseUnit] = useState("পিস");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  // মুদি দোকানের আসল হিসাব: ছোট একক (পিস/কেজি/লিটার) + বড় প্যাক
  // (কার্টন/কেস/বস্তা/ডজন)। একবার বলে দিলে অ্যাপ নিজেই রূপান্তর করে নেয়।
  const [hasBigUnit, setHasBigUnit] = useState(false);
  const [bigUnitName, setBigUnitName] = useState("কার্টন");
  const [bigUnitQty, setBigUnitQty] = useState("");
  const [bigPurchasePrice, setBigPurchasePrice] = useState("");
  const [bigSalePrice, setBigSalePrice] = useState("");
  const [allowDecimal, setAllowDecimal] = useState(false);
  const [trackExpiry, setTrackExpiry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);

  // এডিট মোডে বিদ্যমান তথ্য ফর্মে বসাই
  const [productId, setProductId] = useState<string | null>(null);
  const [baseUnitRowId, setBaseUnitRowId] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      const { data, error: loadErr } = await supabase
        .from("product_variants")
        .select(
          "id, name, base_unit, allow_decimal, track_expiry, product_id, products(name, category_id, categories(name_bn)), variant_units(id, unit_name, level, purchase_price, sale_price)"
        )
        .eq("id", editId)
        .maybeSingle();

      if (cancelled) return;
      if (loadErr || !data) {
        setError("প্রোডাক্টটি পাওয়া যায়নি");
        setLoadingExisting(false);
        return;
      }

      const product = data.products as unknown as
        | { name: string; categories: { name_bn: string } | null }
        | null;
      const units = (data.variant_units ?? []) as { id: string; level: number; purchase_price: number | null; sale_price: number | null }[];
      const base = units.find((u) => u.level === 0) ?? units[0];

      setProductId(data.product_id);
      setProductName(product?.name ?? "");
      setCategoryName(product?.categories?.name_bn ?? "");
      setVariantName(data.name ?? "");
      setBaseUnit(data.base_unit ?? "পিস");
      setAllowDecimal(!!data.allow_decimal);
      setTrackExpiry(!!data.track_expiry);
      setBaseUnitRowId(base?.id ?? null);
      setPurchasePrice(base?.purchase_price != null ? String(base.purchase_price) : "");
      setSalePrice(base?.sale_price != null ? String(base.sale_price) : "");
      setLoadingExisting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  /** ক্যাটাগরির নাম থেকে id — না থাকলে তৈরি করে */
  async function resolveCategoryId(companyId: string): Promise<string | null> {
    const name = categoryName.trim();
    if (!name) return null;
    try {
      const { data: existing } = await supabase
        .from("categories")
        .select("id")
        .eq("company_id", companyId)
        .eq("name_bn", name)
        .maybeSingle();
      if (existing?.id) return existing.id;
    } catch {
      // অফলাইনে পড়া যাবে না — নিচে নতুন তৈরি হবে, ডুপ্লিকেট নাম ক্ষতিকর নয়
    }
    const id = Crypto.randomUUID();
    await enqueueWriteAndSync("categories", "insert", {
      id,
      company_id: companyId,
      name_bn: name,
    });
    return id;
  }

  async function handleSave() {
    if (!profile) return;
    if (!productName.trim() || !variantName.trim() || !salePrice) {
      setError("প্রোডাক্টের নাম, ভ্যারিয়েন্টের নাম ও বিক্রয়মূল্য আবশ্যক");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (isEdit) {
        const categoryId = await resolveCategoryId(profile.company_id);

        if (productId) {
          const productFields: Record<string, unknown> = { name: productName.trim() };
          // ক্যাটাগরি ফাঁকা করলে আগেরটাই থাক — ভুলে মুছে যাওয়া ঠেকাতে
          if (categoryId) productFields.category_id = categoryId;
          const { error: pErr } = await supabase.from("products").update(productFields).eq("id", productId);
          if (pErr) throw pErr;
        }

        const variantFields = {
          name: variantName.trim(),
          base_unit: baseUnit.trim() || "পিস",
          allow_decimal: allowDecimal,
          track_expiry: trackExpiry,
        };
        const { error: vErr } = await supabase.from("product_variants").update(variantFields).eq("id", editId);
        if (vErr) throw vErr;

        if (baseUnitRowId) {
          const { error: uErr } = await supabase
            .from("variant_units")
            .update({
              unit_name: baseUnit.trim() || "পিস",
              purchase_price: purchasePrice ? Number(purchasePrice) : null,
              sale_price: Number(salePrice),
            })
            .eq("id", baseUnitRowId);
          if (uErr) throw uErr;
        }

        await supabase.rpc("log_entity_change", {
          p_entity_type: "product",
          p_entity_id: productId ?? editId,
          p_action: "update",
          p_new: { ...variantFields, sale_price: Number(salePrice) },
        });

        toast.success("প্রোডাক্ট হালনাগাদ হয়েছে");
        router.back();
        return;
      }

      // Offline-first: নিচের ৪টি সারি (category → product → variant → unit)
      // লোকাল কিউতে ক্রম মেনে বসে, তাই নেট ছাড়াও পুরো চেইন তৈরি হয়।
      const categoryId = await resolveCategoryId(profile.company_id);

      const newProductId = Crypto.randomUUID();
      await enqueueWriteAndSync("products", "insert", {
        id: newProductId,
        company_id: profile.company_id,
        category_id: categoryId,
        name: productName.trim(),
      });

      const variantId = Crypto.randomUUID();
      await enqueueWriteAndSync("product_variants", "insert", {
        id: variantId,
        company_id: profile.company_id,
        product_id: newProductId,
        name: variantName.trim(),
        base_unit: baseUnit.trim() || "পিস",
        allow_decimal: allowDecimal,
        track_expiry: trackExpiry,
      });

      const bigQty = Number(bigUnitQty) || 0;
      const addBigUnit = hasBigUnit && bigUnitName.trim() !== "" && bigQty > 1;

      await enqueueWriteAndSync("variant_units", "insert", {
        id: Crypto.randomUUID(),
        company_id: profile.company_id,
        variant_id: variantId,
        unit_name: baseUnit.trim() || "পিস",
        level: 0,
        qty_below: 1,
        purchase_price: purchasePrice ? Number(purchasePrice) : null,
        sale_price: Number(salePrice),
        // বড় প্যাক থাকলে ক্রয় সাধারণত বড় প্যাকেই হয়, বিক্রি ছোট এককে
        is_default_purchase: !addBigUnit,
        is_default_sale: true,
      });

      if (addBigUnit) {
        // qty_below = এক বড় প্যাকে কয়টা ছোট একক। factor_to_base ডাটাবেসের
        // ট্রিগার নিজেই হিসাব করে নেয়, তাই এখানে পাঠাতে হয় না।
        await enqueueWriteAndSync("variant_units", "insert", {
          id: Crypto.randomUUID(),
          company_id: profile.company_id,
          variant_id: variantId,
          unit_name: bigUnitName.trim(),
          level: 1,
          qty_below: bigQty,
          purchase_price: bigPurchasePrice
            ? Number(bigPurchasePrice)
            : purchasePrice
              ? Number(purchasePrice) * bigQty
              : null,
          sale_price: bigSalePrice ? Number(bigSalePrice) : Number(salePrice) * bigQty,
          is_default_purchase: true,
          is_default_sale: false,
        });
      }

      toast.success("নতুন প্রোডাক্ট যোগ হয়েছে");
      router.back();
    } catch (e) {
      setError(errorMessage(e, "সংরক্ষণ ব্যর্থ হয়েছে"));
    } finally {
      setLoading(false);
    }
  }

  if (loadingExisting) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Stack.Screen options={{ title: "প্রোডাক্ট সম্পাদনা", headerShown: true }} />
        <SkeletonDetail />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen
        options={{ title: isEdit ? "প্রোডাক্ট সম্পাদনা" : "নতুন প্রোডাক্ট", headerShown: true }}
      />

      <FormField label="ক্যাটাগরি" value={categoryName} onChangeText={setCategoryName} placeholder="যেমন: তেল" />
      <FormField
        label="প্রোডাক্টের নাম *"
        value={productName}
        onChangeText={setProductName}
        placeholder="যেমন: সয়াবিন তেল"
      />
      <FormField
        label="ভ্যারিয়েন্ট *"
        value={variantName}
        onChangeText={setVariantName}
        placeholder="যেমন: ১ লিটার"
      />
      {/* দুইটা পথ — দোকানি যেটা তার ব্যবসার সাথে মেলে সেটাই নেবে */}
      {!isEdit && (
        <View style={s.modeRow}>
          <Pressable
            style={[s.modeCard, !hasBigUnit && s.modeCardOn]}
            onPress={() => setHasBigUnit(false)}
          >
            <Text style={s.modeIcon}>⚖️</Text>
            <Text style={[s.modeTitle, !hasBigUnit && s.modeTitleOn]}>সহজ একক</Text>
            <Text style={[s.modeHint, !hasBigUnit && s.modeHintOn]}>
              কেজি · লিটার · গ্রাম · পিস{"\n"}শুধু এক এককেই কেনাবেচা
            </Text>
          </Pressable>

          <Pressable
            style={[s.modeCard, hasBigUnit && s.modeCardOn]}
            onPress={() => setHasBigUnit(true)}
          >
            <Text style={s.modeIcon}>📦</Text>
            <Text style={[s.modeTitle, hasBigUnit && s.modeTitleOn]}>প্যাকের হিসাব</Text>
            <Text style={[s.modeHint, hasBigUnit && s.modeHintOn]}>
              কেস · কার্টন · বস্তা · ব্যাগ{"\n"}প্যাকে কিনে খুচরাও বিক্রি
            </Text>
          </Pressable>
        </View>
      )}

      <Text style={s.chipLabel}>{hasBigUnit ? "ছোট একক (যেভাবে খুচরা বিক্রি করেন)" : "একক"}</Text>
      <View style={s.chipRow}>
        {["পিস", "বোতল", "কেজি", "গ্রাম", "লিটার", "মিলি"].map((u) => (
          <Pressable
            key={u}
            style={[s.chip, baseUnit === u && s.chipOn]}
            onPress={() => setBaseUnit(u)}
          >
            <Text style={[s.chipText, baseUnit === u && s.chipTextOn]}>{u}</Text>
          </Pressable>
        ))}
      </View>
      <FormField
        label={hasBigUnit ? "ছোট এককের নাম (নিজে লিখতে চাইলে)" : "এককের নাম (নিজে লিখতে চাইলে)"}
        value={baseUnit}
        onChangeText={setBaseUnit}
        placeholder="পিস / কেজি / লিটার"
      />
      <FormField
        label={`১ ${baseUnit || "একক"} ক্রয়মূল্য`}
        value={purchasePrice}
        onChangeText={setPurchasePrice}
        keyboardType="numeric"
      />
      <FormField
        label={`১ ${baseUnit || "একক"} বিক্রয়মূল্য *`}
        value={salePrice}
        onChangeText={setSalePrice}
        keyboardType="numeric"
      />

      {!isEdit && hasBigUnit && (
        <View style={s.bigBox}>
          <Text style={s.bigTitle}>📦 প্যাকের হিসাব</Text>
          <Text style={s.bigHint}>
            ১ কেসে ২৪ বোতল · ১ কার্টনে ১২ পিস · ১ বস্তায় ৫০ কেজি — একবার বলে দিলে
            প্যাকে কিনে খুচরা বিক্রি করলেও স্টক নিজে থেকেই মিলবে।
          </Text>

          {(
            <View style={{ marginTop: 12 }}>
              <Text style={s.chipLabel}>বড় প্যাকের নাম</Text>
              <View style={s.chipRow}>
                {["কার্টন", "কেস", "বস্তা", "ব্যাগ", "ডজন", "প্যাকেট"].map((u) => (
                  <Pressable
                    key={u}
                    style={[s.chip, bigUnitName === u && s.chipOn]}
                    onPress={() => setBigUnitName(u)}
                  >
                    <Text style={[s.chipText, bigUnitName === u && s.chipTextOn]}>{u}</Text>
                  </Pressable>
                ))}
              </View>

              <FormField
                label="বড় প্যাকের নাম (নিজে লিখতে চাইলে)"
                value={bigUnitName}
                onChangeText={setBigUnitName}
              />
              <FormField
                label={`১ ${bigUnitName || "প্যাক"} = কত ${baseUnit || "পিস"}? *`}
                value={bigUnitQty}
                onChangeText={setBigUnitQty}
                keyboardType="numeric"
                placeholder="যেমন: 12"
              />
              <FormField
                label={`১ ${bigUnitName || "প্যাকের"} ক্রয়মূল্য (খালি রাখলে নিজে হিসাব হবে)`}
                value={bigPurchasePrice}
                onChangeText={setBigPurchasePrice}
                keyboardType="numeric"
              />
              <FormField
                label={`১ ${bigUnitName || "প্যাকের"} বিক্রয়মূল্য (খালি রাখলে নিজে হিসাব হবে)`}
                value={bigSalePrice}
                onChangeText={setBigSalePrice}
                keyboardType="numeric"
              />

              {Number(bigUnitQty) > 1 && (
                <View style={s.calcBox}>
                  <Text style={s.calcTitle}>এভাবে হিসাব হবে</Text>
                  <Text style={s.calcLine}>
                    ১ {bigUnitName || "প্যাক"} = {bigUnitQty} {baseUnit || "পিস"}
                  </Text>
                  <Text style={s.calcLine}>
                    ১০০ {bigUnitName || "প্যাক"} কিনলে স্টকে জমা হবে{" "}
                    {(100 * Number(bigUnitQty)).toLocaleString("en-BD")} {baseUnit || "পিস"}
                  </Text>
                  <Text style={s.calcLine}>
                    ৫ {bigUnitName || "প্যাক"} ৩ {baseUnit || "পিস"} বিক্রি হলে কমবে{" "}
                    {(5 * Number(bigUnitQty) + 3).toLocaleString("en-BD")} {baseUnit || "পিস"}
                  </Text>
                  {Number(salePrice) > 0 && (
                    <Text style={s.calcLine}>
                      ১ {bigUnitName || "প্যাকের"} বিক্রয়মূল্য ৳
                      {(bigSalePrice
                        ? Number(bigSalePrice)
                        : Number(salePrice) * Number(bigUnitQty)
                      ).toLocaleString("en-BD")}
                    </Text>
                  )}
                  <Text style={s.calcNote}>
                    স্টক সবসময় {baseUnit || "পিস"} হিসাবে জমা থাকে, দেখানোর সময়{" "}
                    {bigUnitName || "প্যাক"} + বাকি {baseUnit || "পিস"} করে দেখাবে — দশমিক আসবে না।
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 }}>
        <Switch value={allowDecimal} onValueChange={setAllowDecimal} />
        <Text style={{ color: "#334155", flex: 1 }}>দশমিক পরিমাণ চালু (ওজন/লিটারের পণ্যের জন্য)</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 10 }}>
        <Switch value={trackExpiry} onValueChange={setTrackExpiry} />
        <Text style={{ color: "#334155", flex: 1 }}>
          মেয়াদ/ব্যাচ ট্র্যাক করুন (ক্রয়ের সময় ব্যাচ নম্বর ও মেয়াদ চাইবে)
        </Text>
      </View>

      {isEdit ? (
        <Text style={{ color: "#64748b", fontSize: 12, marginBottom: 14, lineHeight: 18 }}>
          দাম বদলালে আগের বিক্রি/ক্রয়ের হিসাব বদলাবে না — শুধু নতুন এন্ট্রিতে নতুন দাম বসবে।
        </Text>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <PrimaryButton
        title={isEdit ? "পরিবর্তন সংরক্ষণ করুন" : "সংরক্ষণ করুন"}
        onPress={handleSave}
        loading={loading}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  bigBox: {
    backgroundColor: theme.infoBg,
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  bigTitle: { fontSize: 14.5, fontWeight: "700", color: theme.text, flex: 1 },
  bigHint: { fontSize: 12, color: theme.textMuted, marginTop: 8, lineHeight: 18 },
  chipLabel: { fontSize: 12, color: theme.textMuted, fontWeight: "600", marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.textMuted },
  chipTextOn: { color: "#fff" },
  calcBox: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 2,
    gap: 4,
  },
  calcTitle: { fontSize: 12, fontWeight: "800", color: theme.info, marginBottom: 2 },
  calcLine: { fontSize: 12.5, color: theme.text, fontWeight: "600" },
  calcNote: { fontSize: 11.5, color: theme.textMuted, marginTop: 6, lineHeight: 17 },
  modeRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  modeCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  modeCardOn: { borderColor: theme.accent, backgroundColor: theme.infoBg },
  modeIcon: { fontSize: 22, marginBottom: 4 },
  modeTitle: { fontSize: 14, fontWeight: "700", color: theme.textMuted },
  modeTitleOn: { color: theme.text },
  modeHint: { fontSize: 11, color: theme.textFaint, textAlign: "center", marginTop: 4, lineHeight: 15 },
  modeHintOn: { color: theme.textMuted },
});
