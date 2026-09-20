import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { errorMessage, toastMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { ErrorText, FormField, PrimaryButton } from "@/components/form";
import { SkeletonDetail } from "@/components/skeleton";

export default function RouteFormScreen() {
  // ?editId= থাকলে একই ফর্ম এডিট মোডে চলে
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!editId;
  const { profile } = useAuth();
  const toast = useToast();
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      const { data, error: loadErr } = await supabase
        .from("routes")
        .select("name, area")
        .eq("id", editId)
        .maybeSingle();
      if (cancelled) return;
      if (loadErr || !data) {
        toast.error("রুটটি পাওয়া যায়নি");
        router.back();
        return;
      }
      setName(data.name ?? "");
      setArea(data.area ?? "");
      setLoadingExisting(false);
    })();
    return () => { cancelled = true; };
  }, [editId, toast]);

  async function handleSave() {
    if (!profile) return;
    if (!name.trim()) {
      setError("রুটের নাম লিখুন");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const fields = { name: name.trim(), area: area.trim() || null };

      if (isEdit) {
        const { error: updErr } = await supabase.from("routes").update(fields).eq("id", editId);
        if (updErr) throw updErr;
        toast.success("রুট হালনাগাদ হয়েছে");
      } else {
        const { error: insertErr } = await supabase
          .from("routes")
          .insert({ company_id: profile.company_id, ...fields });
        if (insertErr) throw insertErr;
        toast.success("নতুন রুট যোগ হয়েছে");
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
        <Stack.Screen options={{ title: "রুট সম্পাদনা", headerShown: true }} />
        <SkeletonDetail />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: isEdit ? "রুট সম্পাদনা" : "নতুন রুট", headerShown: true }} />

      <FormField label="রুটের নাম *" value={name} onChangeText={setName} placeholder="যেমন: মিরপুর রুট" />
      <FormField label="এলাকা (ঐচ্ছিক)" value={area} onChangeText={setArea} placeholder="যেমন: মিরপুর, ঢাকা" />

      <ErrorText>{error}</ErrorText>
      <View style={{ marginTop: 8 }}>
        <PrimaryButton title={isEdit ? "পরিবর্তন সংরক্ষণ করুন" : "সংরক্ষণ করুন"} onPress={handleSave} loading={loading} />
      </View>
    </ScrollView>
  );
}
