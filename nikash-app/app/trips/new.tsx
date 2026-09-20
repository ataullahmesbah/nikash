import { useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { errorMessage, toastMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { SkeletonDetail } from "@/components/skeleton";
import { ErrorText, FormField, PrimaryButton } from "@/components/form";

type Vehicle = { id: string; reg_no: string };
type RouteRow = { id: string; name: string };

const COST_TO_CATEGORY: Record<string, string> = {
  fuel_cost: "জ্বালানি",
  toll_cost: "টোল",
  driver_allowance: "ড্রাইভার ভাতা",
};

export default function TripFormScreen() {
  // ?editId= থাকলে একই ফর্ম এডিট মোডে চলে
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!editId;
  const [loadingExisting, setLoadingExisting] = useState(!!editId);
  const { profile } = useAuth();
  const toast = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [startKm, setStartKm] = useState("");
  const [endKm, setEndKm] = useState("");
  const [fuelCost, setFuelCost] = useState("0");
  const [tollCost, setTollCost] = useState("0");
  const [driverAllowance, setDriverAllowance] = useState("0");
  const [otherCost, setOtherCost] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("vehicles")
      .select("id, reg_no")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .then(({ data }) => setVehicles(data ?? []));
    supabase
      .from("routes")
      .select("id, name")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .then(({ data }) => setRoutes(data ?? []));
  }, [profile]);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      const { data, error: loadErr } = await supabase
        .from("vehicle_trips")
        .select("vehicle_id, route_id, entry_date, start_km, end_km, fuel_cost, toll_cost, driver_allowance, other_cost")
        .eq("id", editId)
        .maybeSingle();
      if (cancelled) return;
      if (loadErr || !data) {
        toast.error("ট্রিপটি পাওয়া যায়নি");
        router.back();
        return;
      }
      setVehicleId(data.vehicle_id);
      setRouteId(data.route_id);
      setEntryDate(data.entry_date);
      setStartKm(data.start_km != null ? String(data.start_km) : "");
      setEndKm(data.end_km != null ? String(data.end_km) : "");
      setFuelCost(String(data.fuel_cost ?? 0));
      setTollCost(String(data.toll_cost ?? 0));
      setDriverAllowance(String(data.driver_allowance ?? 0));
      setOtherCost(String(data.other_cost ?? 0));
      setLoadingExisting(false);
    })();
    return () => { cancelled = true; };
  }, [editId, toast]);

  async function handleSave() {
    if (!profile) return;
    if (!vehicleId) {
      setError("গাড়ি বাছাই করুন");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const tripId = editId ?? Crypto.randomUUID();
      const fields = {
        vehicle_id: vehicleId,
        route_id: routeId,
        entry_date: entryDate,
        start_km: startKm ? Number(startKm) : null,
        end_km: endKm ? Number(endKm) : null,
        fuel_cost: Number(fuelCost) || 0,
        toll_cost: Number(tollCost) || 0,
        driver_allowance: Number(driverAllowance) || 0,
        other_cost: Number(otherCost) || 0,
      };

      if (isEdit) {
        const { error: updErr } = await supabase
          .from("vehicle_trips")
          .update(fields)
          .eq("id", tripId);
        if (updErr) throw updErr;

        // পুরনো খরচগুলো সরিয়ে দিই — নিচে নতুন অঙ্ক দিয়ে আবার বসবে,
        // নইলে একই ট্রিপের খরচ দুইবার গোনা হতো।
        await supabase
          .from("expenses")
          .update({ deleted_at: new Date().toISOString() })
          .eq("trip_id", tripId)
          .is("deleted_at", null);
      } else {
        const { error: tripErr } = await supabase.from("vehicle_trips").insert({
          id: tripId,
          company_id: profile.company_id,
          ...fields,
        });
        if (tripErr) throw tripErr;
      }

      // Trip cost breakdown also lands in `expenses` (linked via
      // vehicle_id/trip_id) so it counts toward daily_summaries.expense_total
      // and the P&L — vehicle_trips itself is only for route-profitability
      // reporting, not the source of truth for the expense ledger.
      const costs: [string, number][] = [
        ["fuel_cost", Number(fuelCost) || 0],
        ["toll_cost", Number(tollCost) || 0],
        ["driver_allowance", Number(driverAllowance) || 0],
        ["other_cost", Number(otherCost) || 0],
      ];

      const { data: categories } = await supabase
        .from("expense_categories")
        .select("id, name_bn")
        .eq("company_id", profile.company_id);

      for (const [key, amount] of costs) {
        if (amount <= 0) continue;
        const categoryName = COST_TO_CATEGORY[key];
        const category = categories?.find((c) => c.name_bn === categoryName);
        await supabase.from("expenses").insert({
          id: Crypto.randomUUID(),
          company_id: profile.company_id,
          category_id: category?.id ?? null,
          title: `${categoryName ?? "ট্রিপ খরচ"} — ${vehicles.find((v) => v.id === vehicleId)?.reg_no ?? ""}`,
          amount,
          entry_date: entryDate,
          vehicle_id: vehicleId,
          trip_id: tripId,
          status: "approved",
          created_by: profile.id,
        });
      }

      toast.success(isEdit ? "ট্রিপ হালনাগাদ হয়েছে" : "ট্রিপ ও খরচ সংরক্ষিত হয়েছে");
      router.back();
    } catch (e) {
      const message = errorMessage(e, "সংরক্ষণ ব্যর্থ হয়েছে");
      setError(message);
      toast.error(toastMessage(e, "সংরক্ষণ ব্যর্থ হয়েছে"));
    } finally {
      setLoading(false);
    }
  }

  if (loadingExisting) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Stack.Screen options={{ title: "ট্রিপ সম্পাদনা", headerShown: true }} />
        <SkeletonDetail />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: isEdit ? "ট্রিপ সম্পাদনা" : "নতুন ট্রিপ", headerShown: true }} />

      <Text style={{ fontSize: 13, color: "#475569", marginBottom: 6, fontWeight: "600" }}>গাড়ি *</Text>
      <FlatList
        horizontal
        data={vehicles}
        keyExtractor={(v) => v.id}
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 16 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setVehicleId(item.id)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: vehicleId === item.id ? "#0f172a" : "#f1f5f9",
              marginRight: 8,
            }}
          >
            <Text style={{ color: vehicleId === item.id ? "#fff" : "#334155", fontSize: 13 }}>{item.reg_no}</Text>
          </Pressable>
        )}
      />

      {routes.length > 0 && (
        <>
          <Text style={{ fontSize: 13, color: "#475569", marginBottom: 6, fontWeight: "600" }}>রুট (ঐচ্ছিক)</Text>
          <FlatList
            horizontal
            data={routes}
            keyExtractor={(r) => r.id}
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 16 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setRouteId(routeId === item.id ? null : item.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: routeId === item.id ? "#0f172a" : "#f1f5f9",
                  marginRight: 8,
                }}
              >
                <Text style={{ color: routeId === item.id ? "#fff" : "#334155", fontSize: 13 }}>{item.name}</Text>
              </Pressable>
            )}
          />
        </>
      )}

      <FormField label="তারিখ (YYYY-MM-DD)" value={entryDate} onChangeText={setEntryDate} />
      <FormField label="শুরুর কিমি" value={startKm} onChangeText={setStartKm} keyboardType="numeric" />
      <FormField label="শেষের কিমি" value={endKm} onChangeText={setEndKm} keyboardType="numeric" />
      <FormField label="জ্বালানি খরচ" value={fuelCost} onChangeText={setFuelCost} keyboardType="numeric" />
      <FormField label="টোল" value={tollCost} onChangeText={setTollCost} keyboardType="numeric" />
      <FormField label="ড্রাইভার ভাতা" value={driverAllowance} onChangeText={setDriverAllowance} keyboardType="numeric" />
      <FormField label="অন্যান্য খরচ" value={otherCost} onChangeText={setOtherCost} keyboardType="numeric" />

      <ErrorText>{error}</ErrorText>
      <PrimaryButton title={isEdit ? "পরিবর্তন সংরক্ষণ করুন" : "সংরক্ষণ করুন"} onPress={handleSave} loading={loading} tone="success" />
    </ScrollView>
  );
}
