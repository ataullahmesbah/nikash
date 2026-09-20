import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { signInWithPhone } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { AuthField } from "@/components/auth-field";
import { theme } from "@/components/ui";

type BusinessType = "shop" | "warehouse" | "vendor";

const BUSINESS_TYPES: { value: BusinessType; label: string; hint: string; icon: string }[] = [
  { value: "shop", label: "দোকান", hint: "খুচরা বিক্রি, POS", icon: "🏪" },
  { value: "warehouse", label: "গুদাম", hint: "পরিবেশক, গাড়ি/রুট", icon: "🏭" },
  { value: "vendor", label: "সরবরাহকারী", hint: "মিল, বড় লটে বিক্রি", icon: "🚚" },
];

// নতুন কোম্পানি খোলা ওয়েব সার্ভারের /api/signup দিয়ে হয় — সরাসরি
// Supabase-এ নয়। কারণ provision_company ফাংশনটা service_role ছাড়া
// ডাকা যায় না (নিরাপত্তার জন্যই)। বিস্তারিত ওই রুটের মন্তব্যে।
export default function SignupScreen() {
  const [businessType, setBusinessType] = useState<BusinessType>("shop");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clearError = () => error && setError(null);

  /** কোন ঘরটা এখনো ঠিক নেই — ব্যবহারকারীকে স্পষ্ট করে বলি */
  function firstProblem(): string | null {
    if (businessName.trim().length < 2) return "ব্যবসার নাম লিখুন (অন্তত ২ অক্ষর)";
    if (ownerName.trim().length < 2) return "আপনার নাম লিখুন";
    if (!/^01\d{9}$/.test(phone.trim().replace(/[\s-]/g, "")))
      return "ফোন নম্বরটি ১১ সংখ্যার হতে হবে, ০১ দিয়ে শুরু";
    if (password.length < 8) return "পাসওয়ার্ড অন্তত ৮ অক্ষরের দিন";
    return null;
  }

  async function handleSignup() {
    const problem = firstProblem();
    if (problem) {
      setError(problem);
      return;
    }

    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) {
      setError("অ্যাপের সেটিংসে সার্ভারের ঠিকানা নেই — সাপোর্টে জানান");
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
      if (!res.ok) throw new Error(data.error ?? "অ্যাকাউন্ট তৈরি করা যায়নি");

      const { error: loginErr } = await signInWithPhone(phone.trim(), password);
      if (loginErr) {
        throw new Error("অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু লগইন হয়নি — লগইন পাতা থেকে ঢুকুন");
      }
      router.replace("/(tabs)/dashboard");
    } catch (e) {
      setError(errorMessage(e, "অ্যাকাউন্ট তৈরি করা যায়নি"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>নতুন অ্যাকাউন্ট</Text>
          <Text style={styles.subtitle}>১৫ দিনের ফ্রি ট্রায়াল — কোনো টাকা লাগবে না</Text>
        </View>

        {/* ------------------------ ব্যবসার ধরন ------------------------ */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>১. আপনার ব্যবসা কোন ধরনের?</Text>
          <View style={styles.typeRow}>
            {BUSINESS_TYPES.map((t) => {
              const active = businessType === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => setBusinessType(t.value)}
                  style={[styles.typeCard, active && styles.typeCardActive]}
                >
                  <Text style={styles.typeIcon}>{t.icon}</Text>
                  <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{t.label}</Text>
                  <Text style={styles.typeHint}>{t.hint}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* -------------------------- তথ্য -------------------------- */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>২. আপনার তথ্য</Text>

          <AuthField
            label="ব্যবসার নাম"
            placeholder="যেমন: রহিম স্টোর"
            hint="চালান ও রিপোর্টে এই নামটাই ছাপা হবে"
            autoCapitalize="words"
            maxLength={100}
            value={businessName}
            onChangeText={(v) => {
              setBusinessName(v);
              clearError();
            }}
          />

          <AuthField
            label="আপনার নাম"
            placeholder="যেমন: আব্দুর রহিম"
            hint="দোকানের মালিক বা যিনি হিসাব রাখবেন"
            autoCapitalize="words"
            maxLength={80}
            value={ownerName}
            onChangeText={(v) => {
              setOwnerName(v);
              clearError();
            }}
          />

          <AuthField
            label="ফোন নম্বর"
            placeholder="01712345678"
            hint="এই নম্বর দিয়েই পরে লগইন করবেন — ১১ সংখ্যা"
            keyboardType="phone-pad"
            maxLength={14}
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              clearError();
            }}
          />

          <AuthField
            label="পাসওয়ার্ড"
            placeholder="অন্তত ৮ অক্ষর"
            hint="মনে রাখতে পারবেন এমন কিছু দিন"
            secure
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              clearError();
            }}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>ট্রায়াল শুরু করুন</Text>
            )}
          </Pressable>

          <Text style={styles.terms}>
            চালিয়ে গেলে আপনি আমাদের শর্তাবলি ও গোপনীয়তা নীতিতে সম্মত হচ্ছেন।
          </Text>
        </View>

        <Pressable style={styles.loginBtn} onPress={() => router.replace("/login")}>
          <Text style={styles.loginText}>
            আগে থেকেই অ্যাকাউন্ট আছে? <Text style={styles.loginStrong}>লগইন করুন</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 18, paddingBottom: 40 },

  header: { alignItems: "center", marginTop: 8, marginBottom: 18 },
  title: { fontSize: 24, fontWeight: "800", color: theme.text },
  subtitle: { fontSize: 13, color: theme.textMuted, marginTop: 5, textAlign: "center" },

  card: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 14.5, fontWeight: "800", color: theme.text, marginBottom: 12 },

  typeRow: { flexDirection: "row", gap: 8 },
  typeCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    backgroundColor: theme.surface,
  },
  typeCardActive: { borderColor: theme.success, backgroundColor: theme.successBg },
  typeIcon: { fontSize: 22, marginBottom: 5 },
  typeLabel: { fontSize: 13, fontWeight: "800", color: theme.text },
  typeLabelActive: { color: theme.success },
  typeHint: { fontSize: 10, color: theme.textMuted, marginTop: 3, textAlign: "center", lineHeight: 14 },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: theme.dangerBg,
    borderRadius: 12,
    padding: 11,
    marginBottom: 12,
  },
  errorIcon: { fontSize: 14 },
  errorText: { flex: 1, color: theme.danger, fontSize: 13, lineHeight: 19 },

  button: {
    backgroundColor: theme.success,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 15.5 },

  terms: {
    fontSize: 11,
    color: theme.textFaint,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 16,
  },

  loginBtn: { paddingVertical: 14, alignItems: "center" },
  loginText: { fontSize: 13.5, color: theme.textMuted },
  loginStrong: { color: theme.text, fontWeight: "800" },
});
