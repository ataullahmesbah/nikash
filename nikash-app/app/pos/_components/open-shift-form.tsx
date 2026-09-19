import { useEffect, useState } from "react";
import { View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { ErrorText, FormField, PrimaryButton } from "@/components/form";

export default function OpenShiftForm({ onOpened }: { onOpened: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [openingCash, setOpeningCash] = useState("0");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("locations")
      .select("id, is_default")
      .eq("company_id", profile.company_id)
      .then(({ data }) => {
        const def = (data ?? []).find((l) => l.is_default);
        setLocationId(def?.id ?? data?.[0]?.id ?? null);
      });
  }, [profile]);

  async function handleOpen() {
    if (!profile) return;
    setError(null);
    setLoading(true);
    const { error: insErr } = await supabase.from("pos_shifts").insert({
      company_id: profile.company_id,
      location_id: locationId,
      cashier_id: profile.id,
      opening_cash: Number(openingCash) || 0,
    });
    setLoading(false);
    if (insErr) {
      setError(insErr.message);
      toast.error("শিফট শুরু করা যায়নি");
      return;
    }
    toast.success("শিফট শুরু হয়েছে");
    onOpened();
  }

  return (
    <View>
      <FormField
        label="ড্রয়ারে শুরুতে কত টাকা আছে?"
        value={openingCash}
        onChangeText={setOpeningCash}
        keyboardType="numeric"
      />
      <ErrorText>{error}</ErrorText>
      <PrimaryButton title="শিফট শুরু করুন" onPress={handleOpen} loading={loading} tone="success" />
    </View>
  );
}
