import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { signInWithPhone } from "@/lib/supabase";

type BusinessType = "shop" | "warehouse" | "vendor";

const BUSINESS_TYPES: { value: BusinessType; label: string; hint: string }[] = [
  { value: "shop", label: "দোকান", hint: "খুচরা বিক্রেতা, POS" },
  { value: "warehouse", label: "গুদাম", hint: "পরিবেশক, গাড়ি/রুট" },
  { value: "vendor", label: "সরবরাহকারী", hint: "উৎপাদক/মিল, বড় লটে বিক্রি" },
];

// Signup is a public web-backend call (nikash-web /api/signup), not a
// direct Supabase insert — provisioning a company runs with elevated
// privileges (creates the auth user via the admin API, then calls the
// service_role-only provision_company RPC). See that route's comments.
export default function SignupScreen() {
  const [businessType, setBusinessType] = useState<BusinessType>("shop");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!businessName.trim() || !ownerName.trim() || !phone.trim() || !password) {
      setError("সব ঘর পূরণ করুন");
      return;
    }
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) {
      setError("EXPO_PUBLIC_API_URL সেট করা নেই — .env দেখুন");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessType,
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "সাইনআপ ব্যর্থ হয়েছে");

      const { error: loginErr } = await signInWithPhone(phone.trim(), password);
      if (loginErr) throw new Error("অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু লগইন ব্যর্থ — ম্যানুয়ালি লগইন করুন");

      router.replace("/(tabs)/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "সাইনআপ ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={styles.title}>নতুন অ্যাকাউন্ট</Text>
        <Text style={styles.subtitle}>১৫ দিনের ফ্রি ট্রায়াল — কোনো টাকা লাগবে না</Text>

        <Text style={styles.label}>আপনার ব্যবসার ধরন</Text>
        <View style={styles.typeRow}>
          {BUSINESS_TYPES.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => setBusinessType(t.value)}
              style={[styles.typeCard, businessType === t.value && styles.typeCardActive]}
            >
              <Text style={[styles.typeLabel, businessType === t.value && styles.typeLabelActive]}>
                {t.label}
              </Text>
              <Text style={styles.typeHint}>{t.hint}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="ব্যবসার নাম"
          value={businessName}
          onChangeText={setBusinessName}
        />
        <TextInput style={styles.input} placeholder="আপনার নাম" value={ownerName} onChangeText={setOwnerName} />
        <TextInput
          style={styles.input}
          placeholder="ফোন নম্বর (০১XXXXXXXXX)"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <TextInput
          style={styles.input}
          placeholder="পাসওয়ার্ড (অন্তত ৮ অক্ষর)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={handleSignup} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ট্রায়াল শুরু করুন</Text>}
        </Pressable>

        <Pressable onPress={() => router.replace("/login")}>
          <Text style={styles.loginLink}>আগে থেকেই অ্যাকাউন্ট আছে? লগইন করুন</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  title: { fontSize: 26, fontWeight: "700", textAlign: "center", color: "#0f172a" },
  subtitle: { fontSize: 13, textAlign: "center", color: "#64748b", marginTop: 4, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 8 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  typeCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  typeCardActive: { borderColor: "#0f172a", backgroundColor: "#f1f5f9" },
  typeLabel: { fontSize: 13, fontWeight: "700", color: "#334155" },
  typeLabelActive: { color: "#0f172a" },
  typeHint: { fontSize: 10, color: "#94a3b8", marginTop: 2, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 15,
  },
  error: { color: "#dc2626", marginBottom: 12, fontSize: 13 },
  button: {
    backgroundColor: "#059669",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  loginLink: { textAlign: "center", marginTop: 20, color: "#0f172a", fontWeight: "600" },
});
