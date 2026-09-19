import { useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { enqueueWriteAndSync } from "@/lib/offline/sync-queue";
import { ErrorText, FormField, PrimaryButton, SegmentedControl } from "@/components/form";

type RouteRow = { id: string; name: string };

export default function NewPartyScreen() {
  // ?editId= থাকলে একই ফর্ম এডিট মোডে চলে।
  // বিক্রয়/ক্রয়ের পিকার থেকে এলে ধরন ও নামটা আগেই বসানো থাকে,
  // যাতে দোকানির শুধু ফোন-ঠিকানা লিখলেই চলে।
  const { editId, type: presetType, name: presetName } = useLocalSearchParams<{
    editId?: string;
    type?: string;
    name?: string;
  }>();
  const isEdit = !!editId;
  const { profile } = useAuth();
  const toast = useToast();
  const [type, setType] = useState<"customer" | "supplier">(
    presetType === "supplier" ? "supplier" : "customer"
  );
  const [name, setName] = useState(presetName ?? "");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [altPhone, setAltPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [thana, setThana] = useState("");
  const [district, setDistrict] = useState("");
  const [creditLimit, setCreditLimit] = useState("0");
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUseLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        toast.error("লোকেশন অনুমতি দেওয়া হয়নি");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      toast.success("বর্তমান অবস্থান নেওয়া হয়েছে");
    } catch {
      toast.error("অবস্থান পাওয়া যায়নি — GPS চালু আছে কিনা দেখুন");
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    if (!profile) return;
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
      const { data } = await supabase
        .from("parties")
        .select("id, type, name, phone, alt_phone, whatsapp, area, address, thana, district, route_id, latitude, longitude, opening_balance, credit_limit")
        .eq("id", editId)
        .maybeSingle();
      if (cancelled || !data) return;
      setType(data.type);
      setName(data.name ?? "");
      setPhone(data.phone ?? "");
      setAltPhone(data.alt_phone ?? "");
      setWhatsapp(data.whatsapp ?? "");
      setArea(data.area ?? "");
      setAddress(data.address ?? "");
      setThana(data.thana ?? "");
      setDistrict(data.district ?? "");
      setRouteId(data.route_id ?? null);
      setOpeningBalance(String(data.opening_balance ?? 0));
      setCreditLimit(String(data.credit_limit ?? 0));
      if (data.latitude != null && data.longitude != null) {
        setCoords({ latitude: Number(data.latitude), longitude: Number(data.longitude) });
      }
    })();
    return () => { cancelled = true; };
  }, [editId]);

  async function handleSave() {
    if (!profile) return;
    if (!name.trim()) {
      setError("নাম লিখুন");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const fields = {
        type,
        name: name.trim(),
        phone: phone.trim() || null,
        alt_phone: altPhone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        area: area.trim() || null,
        address: address.trim() || null,
        thana: thana.trim() || null,
        district: district.trim() || null,
        route_id: routeId,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        opening_balance: Number(openingBalance) || 0,
        credit_limit: Number(creditLimit) || 0,
      };

      if (isEdit) {
        const { error: updErr } = await supabase.from("parties").update(fields).eq("id", editId);
        if (updErr) throw updErr;
        await supabase.rpc("log_entity_change", {
          p_entity_type: "party",
          p_entity_id: editId,
          p_action: "update",
          p_new: fields,
        });
        toast.success("পার্টির তথ্য হালনাগাদ হয়েছে");
      } else {
        // Offline-first: লোকালে সাথে সাথে সেভ, অনলাইনে থাকলে তখনই সিঙ্ক —
        // তাই তালিকায় ফিরে গেলে নতুন পার্টি সাথে সাথেই দেখা যায়।
        await enqueueWriteAndSync("parties", "insert", {
          id: Crypto.randomUUID(),
          company_id: profile.company_id,
          ...fields,
        });
        toast.success("নতুন পার্টি যোগ হয়েছে");
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  }

  const customerLabel = profile?.business_type === "shop" ? "ক্রেতা" : "ক্রেতা / দোকান";
  const supplierLabel = profile?.business_type === "vendor" ? "উৎপাদক / মিল" : "সরবরাহকারী";

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: isEdit ? "পার্টি সম্পাদনা" : "নতুন পার্টি", headerShown: true }} />

      <SegmentedControl
        value={type}
        onChange={setType}
        options={[
          { label: customerLabel, value: "customer" },
          { label: supplierLabel, value: "supplier" },
        ]}
      />

      <FormField label="নাম *" value={name} onChangeText={setName} placeholder="যেমন: রহিম স্টোর" />
      <FormField label="ফোন" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <FormField label="বিকল্প ফোন" value={altPhone} onChangeText={setAltPhone} keyboardType="phone-pad" />
      <FormField label="WhatsApp নম্বর" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" />
      <FormField label="এলাকা" value={area} onChangeText={setArea} />

      <View style={{ marginBottom: 16 }}>
        <PrimaryButton
          title={coords ? `📍 অবস্থান নেওয়া হয়েছে (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})` : "📍 বর্তমান অবস্থান নিন"}
          onPress={handleUseLocation}
          loading={locating}
        />
      </View>

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

      <FormField label="ঠিকানা" value={address} onChangeText={setAddress} />
      <FormField label="থানা" value={thana} onChangeText={setThana} />
      <FormField label="জেলা" value={district} onChangeText={setDistrict} />
      <FormField
        label="ক্রেডিট লিমিট (সর্বোচ্চ কত বাকি দেওয়া যাবে)"
        value={creditLimit}
        onChangeText={setCreditLimit}
        keyboardType="numeric"
      />
      <FormField
        label="শুরুর বাকি (Opening balance)"
        value={openingBalance}
        onChangeText={setOpeningBalance}
        keyboardType="numeric"
      />

      <ErrorText>{error}</ErrorText>
      <View style={{ marginTop: 8 }}>
        <PrimaryButton
          title={isEdit ? "পরিবর্তন সংরক্ষণ করুন" : "সংরক্ষণ করুন"}
          onPress={handleSave}
          loading={loading}
        />
      </View>
    </ScrollView>
  );
}
