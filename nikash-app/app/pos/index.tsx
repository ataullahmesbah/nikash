import { useCallback, useState } from "react";
import { Stack, router, useFocusEffect } from "expo-router";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import OpenShiftForm from "./_components/open-shift-form";
import PosScreen from "./_components/pos-screen";

export type ActiveShift = { id: string; opening_cash: number; opened_at: string };

export default function PosEntryScreen() {
  const { profile } = useAuth();
  const [shift, setShift] = useState<ActiveShift | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("pos_shifts")
      .select("id, opening_cash, opened_at")
      .eq("cashier_id", profile.id)
      .is("closed_at", null)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setShift(data ?? null);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (shift === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Stack.Screen options={{ title: "POS", headerShown: true }} />
        <ActivityIndicator />
      </View>
    );
  }

  if (!shift) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Stack.Screen options={{ title: "শিফট শুরু করুন", headerShown: true }} />
        <OpenShiftForm onOpened={load} />
      </ScrollView>
    );
  }

  return <PosScreen shift={shift} onClosed={() => router.back()} />;
}
