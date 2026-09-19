import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatDateBn, presetRange, taka, type DateRange } from "@/lib/format";
import { PrimaryButton } from "@/components/form";
import { SearchBar } from "@/components/search-bar";
import { DateRangePicker } from "@/components/date-range-picker";
import { RowActions } from "@/components/row-actions";
import { Card, EmptyState, theme } from "@/components/ui";
import { SkeletonList } from "@/components/skeleton";

type Trip = {
  id: string;
  entry_date: string;
  start_km: number | null;
  end_km: number | null;
  fuel_cost: number;
  toll_cost: number;
  driver_allowance: number;
  other_cost: number;
  total_cost: number;
  vehicles: { reg_no: string } | null;
  routes: { name: string } | null;
};

export default function TripsScreen() {
  const { profile } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [range, setRange] = useState<DateRange>(presetRange("month"));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from("vehicle_trips")
      .select(
        "id, entry_date, start_km, end_km, fuel_cost, toll_cost, driver_allowance, other_cost, total_cost, vehicles(reg_no), routes(name)"
      )
      .eq("company_id", profile.company_id)
      .gte("entry_date", range.from)
      .lte("entry_date", range.to)
      .order("entry_date", { ascending: false })
      .limit(300);
    setTrips((data as unknown as Trip[]) ?? []);
    setLoading(false);
  }, [profile, range.from, range.to]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter(
      (t) =>
        (t.vehicles?.reg_no ?? "").toLowerCase().includes(q) ||
        (t.routes?.name ?? "").toLowerCase().includes(q)
    );
  }, [trips, search]);

  const summary = useMemo(() => {
    let cost = 0;
    let km = 0;
    for (const t of visible) {
      cost += Number(t.total_cost);
      if (t.start_km !== null && t.end_km !== null) km += Number(t.end_km) - Number(t.start_km);
    }
    return { cost, km, count: visible.length, perKm: km > 0 ? cost / km : 0 };
  }, [visible]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: "ট্রিপ", headerShown: true }} />

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 6 }}>
            <PrimaryButton title="+ নতুন ট্রিপ" onPress={() => router.push("/trips/new")} />

            <DateRangePicker value={range} onChange={setRange} />

            <SearchBar value={search} onChange={setSearch} placeholder="গাড়ির নম্বর বা রুট..." />

            <Card>
              <View style={styles.sumGrid}>
                <View style={styles.sumCell}>
                  <Text style={styles.sumLabel}>ট্রিপ</Text>
                  <Text style={styles.sumValue}>{summary.count}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.sumCell}>
                  <Text style={styles.sumLabel}>মোট খরচ</Text>
                  <Text style={[styles.sumValue, { color: theme.danger }]}>{taka(summary.cost)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.sumCell}>
                  <Text style={styles.sumLabel}>কিলোমিটার</Text>
                  <Text style={styles.sumValue}>{summary.km.toFixed(0)}</Text>
                </View>
              </View>
              {summary.perKm > 0 && (
                <Text style={styles.perKm}>প্রতি কিমিতে খরচ {taka(summary.perKm)}</Text>
              )}
              <Text style={styles.note}>
                ট্রিপের খরচ নিজে থেকেই খরচের খাতায় যায় — তাই ড্যাশবোর্ডের নিট লাভ থেকে কমে।
              </Text>
            </Card>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonList rows={4} />
          ) : (
            <EmptyState
              icon="🛣️"
              title={search ? "কিছু পাওয়া যায়নি" : "এই সময়ে কোনো ট্রিপ নেই"}
              message="উপরের তারিখ বদলে অন্য সময়ের ট্রিপ দেখুন।"
              action={{ label: "+ নতুন ট্রিপ", onPress: () => router.push("/trips/new") }}
            />
          )
        }
        renderItem={({ item }) => {
          const km =
            item.start_km !== null && item.end_km !== null
              ? Number(item.end_km) - Number(item.start_km)
              : null;
          return (
            <Card>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.vehicles?.reg_no ?? "গাড়ি নেই"}</Text>
                  <Text style={styles.meta}>
                    {item.routes?.name ?? "রুট নেই"} · {formatDateBn(item.entry_date, true)}
                  </Text>
                  {km !== null && (
                    <Text style={styles.sub}>
                      {item.start_km} → {item.end_km} কিমি ({km.toFixed(0)} কিমি চলেছে)
                    </Text>
                  )}
                  <Text style={styles.breakdown}>
                    {[
                      Number(item.fuel_cost) > 0 ? `তেল ${taka(item.fuel_cost)}` : null,
                      Number(item.toll_cost) > 0 ? `টোল ${taka(item.toll_cost)}` : null,
                      Number(item.driver_allowance) > 0 ? `চালক ${taka(item.driver_allowance)}` : null,
                      Number(item.other_cost) > 0 ? `অন্যান্য ${taka(item.other_cost)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "কোনো খরচ লেখা হয়নি"}
                  </Text>
                </View>
                <Text style={styles.cost}>{taka(item.total_cost)}</Text>
              </View>

              <RowActions
                table="vehicle_trips"
                id={item.id}
                editHref={`/trips/new?editId=${item.id}`}
                label="ট্রিপটি"
                deleteMessage="ট্রিপের সাথে যুক্ত খরচগুলোও সরে যাবে, আর ওই দিনের লাভ-ক্ষতি আবার মিলিয়ে নেওয়া হবে।"
                onDone={load}
              />
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32, gap: 10 },
  sumGrid: { flexDirection: "row", alignItems: "center" },
  sumCell: { flex: 1, alignItems: "center" },
  divider: { width: 1, height: 30, backgroundColor: theme.border },
  sumLabel: { fontSize: 11.5, color: theme.textMuted },
  sumValue: { fontSize: 16, fontWeight: "800", color: theme.text, marginTop: 3 },
  perKm: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 12.5,
    fontWeight: "700",
    color: theme.accent,
  },
  note: { fontSize: 11, color: theme.textFaint, marginTop: 10, lineHeight: 16, textAlign: "center" },
  name: { fontSize: 15, fontWeight: "700", color: theme.text },
  meta: { fontSize: 12, color: theme.textMuted, marginTop: 3 },
  sub: { fontSize: 11.5, color: theme.textFaint, marginTop: 3 },
  breakdown: { fontSize: 11.5, color: theme.textMuted, marginTop: 5, lineHeight: 16 },
  cost: { fontSize: 16, fontWeight: "800", color: theme.danger },
});
