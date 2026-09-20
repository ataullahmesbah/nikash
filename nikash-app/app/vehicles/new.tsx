import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { useAuth } from "@/lib/auth-context";
import { enqueueWriteAndSync } from "@/lib/offline/sync-queue";
import { supabase } from "@/lib/supabase";
import { errorMessage, toastMessage } from "@/lib/errors";
import { useToast } from "@/lib/toast/toast-context";
import { ErrorText, FormField, PrimaryButton } from "@/components/form";
import { SkeletonDetail } from "@/components/skeleton";

export default function VehicleFormScreen() {
  // ?editId= থাকলে একই ফর্ম এডিট মোডে চলে
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!editId;
  const { profile } = useAuth();
  const toast = useToast();
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [regNo, setRegNo] = useState("");
  const [type, setType] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      const { data, error: loadErr } = await supabase
        .from("vehicles")
        .select("reg_no, type, driver_name, driver_phone")
        .eq("id", editId)
        .maybeSingle();
      if (cancelled) return;
      if (loadErr || !data) {
        toast.error("গাড়িটি পাওয়া যায়নি");
        router.back();
        return;
      }
      setRegNo(data.reg_no ?? "");
      setType(data.type ?? "");
      setDriverName(data.driver_name ?? "");
      setDriverPhone(data.driver_phone ?? "");
      setLoadingExisting(false);
    })();
    return () => { cancelled = true; };
  }, [editId, toast]);

  async function handleSave() {
    if (!profile) return;
    if (!regNo.trim()) {
      setError("গাড়ির নম্বর দিন");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const fields = {
        reg_no: regNo.trim(),
        type: type.trim() || null,
        driver_name: driverName.trim() || null,
        driver_phone: driverPhone.trim() || null,
      };

      if (isEdit) {
        const { error: updErr } = await supabase.from("vehicles").update(fields).eq("id", editId);
        if (updErr) throw updErr;
        toast.success("গাড়ির তথ্য হালনাগাদ হয়েছে");
      } else {
        await enqueueWriteAndSync("vehicles", "insert", {
          id: Crypto.randomUUID(),
          company_id: profile.company_id,
          ...fields,
        });
        toast.success("নতুন গাড়ি যোগ হয়েছে");
      }
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
        <Stack.Screen options={{ title: "গাড়ি সম্পাদনা", headerShown: true }} />
        <SkeletonDetail />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: isEdit ? "গাড়ি সম্পাদনা" : "নতুন গাড়ি", headerShown: true }} />

      <FormField label="গাড়ির নম্বর *" value={regNo} onChangeText={setRegNo} placeholder="ঢাকা মেট্রো ট-১১" />
      <FormField label="ধরন" value={type} onChangeText={setType} placeholder="ট্রাক / পিকআপ / ভ্যান" />
      <FormField label="ড্রাইভারের নাম" value={driverName} onChangeText={setDriverName} />
      <FormField label="ড্রাইভারের ফোন" value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" />

      <ErrorText>{error}</ErrorText>
      <PrimaryButton title={isEdit ? "পরিবর্তন সংরক্ষণ করুন" : "সংরক্ষণ করুন"} onPress={handleSave} loading={loading} />
    </ScrollView>
  );
}
