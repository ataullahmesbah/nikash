import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack, router } from "expo-router";
import * as Crypto from "expo-crypto";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { enqueueWriteAndSync } from "@/lib/offline/sync-queue";
import { loadCatalog, type PickableUnit } from "@/lib/catalog";
import { loadLocations, type Location } from "@/lib/locations";
import { ErrorText, FormField, PrimaryButton, SegmentedControl } from "@/components/form";
import { ItemPickerModal } from "@/components/item-picker-modal";
import { DateField } from "@/components/date-field";
import { todayIso } from "@/lib/format";

type Reason = "damage" | "expiry" | "theft" | "count_error" | "other";

export default function StockAdjustScreen() {
  const { profile } = useAuth();
  const toast = useToast();
  const [catalog, setCatalog] = useState<PickableUnit[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<PickableUnit | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  // কোন দিনের ক্ষতি/সমন্বয় — পরে তুললেও আসল তারিখ বসানো যায়
  const [entryDate, setEntryDate] = useState(todayIso());
  const [reason, setReason] = useState<Reason>("damage");
  const [note, setNote] = useState("");
  const [valueLoss, setValueLoss] = useState("0");
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    // Both reads have an offline fallback (last cached list) — this
    // screen's save action is itself offline-queued, so the pickers it
    // needs must also work without a connection. See lib/catalog.ts and
    // lib/locations.ts.
    loadCatalog(profile.company_id).then(setCatalog).catch(() => {});
    loadLocations(profile.company_id).then((data) => {
      setLocations(data);
      const def = data.find((l) => l.is_default);
      setLocationId(def?.id ?? data[0]?.id ?? null);
    });
  }, [profile]);

  async function handleSave() {
    if (!profile) return;
    if (!selected) {
      setError("প্রোডাক্ট বাছাই করুন");
      return;
    }
    if (!qty || Number(qty) === 0) {
      setError("পরিমাণ দিন (কমলে -, বাড়লে + )");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Small quantities auto-approve; larger ones need explicit review —
      // this starter treats every entry as immediately approved (matching
      // stock_adjustments' own default) so it posts to the ledger right
      // away via trg_stock_adj_post once synced. Add an approval queue UI
      // later if you want big adjustments held for Owner sign-off first.
      // Offline-first: single-table insert, no RPC dependency, so this is
      // safe to queue (unlike Purchase/Sale posting).
      await enqueueWriteAndSync("stock_adjustments", "insert", {
        id: Crypto.randomUUID(),
        company_id: profile.company_id,
        location_id: locationId,
        variant_id: selected.variant_id,
        qty_base: Number(qty),
        entry_date: entryDate,
        reason,
        note: note.trim() || null,
        value_loss: Number(valueLoss) || 0,
        created_by: profile.id,
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
        status: "approved",
      });

      toast.success("স্টক সমন্বয় সংরক্ষিত হয়েছে (sync হচ্ছে)");
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : "ব্যর্থ হয়েছে";
      setError(message);
      toast.error(message.length > 60 ? "সংরক্ষণ ব্যর্থ, আবার চেষ্টা করুন" : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: "স্টক সমন্বয়", headerShown: true }} />

      <View style={{ marginBottom: 16 }}>
        <PrimaryButton
          title={selected ? `${selected.product_name} · ${selected.variant_name}` : "প্রোডাক্ট বাছাই করুন"}
          onPress={() => setShowPicker(true)}
        />
      </View>

      {locations.length > 1 && (
        <SegmentedControl
          value={locationId ?? ""}
          onChange={setLocationId}
          options={locations.map((l) => ({ label: l.name, value: l.id }))}
        />
      )}

      <DateField label="তারিখ" value={entryDate} onChange={setEntryDate} maximumDate={new Date()} />

      <FormField
        label="পরিমাণ (base unit-এ, কমলে ঋণাত্মক লিখুন) *"
        value={qty}
        onChangeText={setQty}
        keyboardType="numbers-and-punctuation"
        placeholder="-5 অথবা 10"
      />

      <SegmentedControl
        value={reason}
        onChange={setReason}
        options={[
          { label: "ড্যামেজ", value: "damage" },
          { label: "মেয়াদ", value: "expiry" },
          { label: "চুরি", value: "theft" },
        ]}
      />
      <SegmentedControl
        value={reason}
        onChange={setReason}
        options={[
          { label: "গণনা ভুল", value: "count_error" },
          { label: "অন্যান্য", value: "other" },
        ]}
      />

      <FormField label="মন্তব্য" value={note} onChangeText={setNote} />
      <FormField
        label="ক্ষতির মূল্য (স্বয়ংক্রিয় খরচে যোগ হবে)"
        value={valueLoss}
        onChangeText={setValueLoss}
        keyboardType="numeric"
      />

      <ErrorText>{error}</ErrorText>
      <PrimaryButton title="সংরক্ষণ করুন" onPress={handleSave} loading={loading} tone="danger" />

      <ItemPickerModal
        visible={showPicker}
        items={catalog}
        priceField="sale_price"
        onSelect={(item) => {
          setSelected(item);
          setShowPicker(false);
        }}
        onClose={() => setShowPicker(false)}
      />
    </ScrollView>
  );
}
