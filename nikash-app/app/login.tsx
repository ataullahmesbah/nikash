import { useState } from "react";
import {
  ActivityIndicator,
  Image,
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

const DEMO_PHONE = process.env.EXPO_PUBLIC_DEMO_PHONE;
const DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD;

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const canSubmit = phone.trim().length >= 11 && password.length >= 4;

  async function handleLogin() {
    if (!canSubmit) {
      setError("ফোন নম্বর ও পাসওয়ার্ড দুটোই দিন");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await signInWithPhone(phone.trim(), password);
      if (err) {
        // সার্ভার কী বলল সেটা লুকিয়ে ফেলি না, কিন্তু চেনা ভুলটা
        // সহজ ভাষায় বলি
        const raw = errorMessage(err, "").toLowerCase();
        setError(
          raw.includes("invalid login") || raw.includes("credentials")
            ? "ফোন নম্বর বা পাসওয়ার্ড মিলছে না"
            : errorMessage(err, "লগইন করা যায়নি")
        );
        return;
      }
      router.replace("/(tabs)/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo() {
    if (!DEMO_PHONE || !DEMO_PASSWORD) return;
    setError(null);
    setDemoLoading(true);
    try {
      const { error: err } = await signInWithPhone(DEMO_PHONE, DEMO_PASSWORD);
      if (err) {
        setError("ডেমো অ্যাকাউন্টে ঢোকা যায়নি");
        return;
      }
      router.replace("/(tabs)/dashboard");
    } finally {
      setDemoLoading(false);
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
        {/* ---------------------------- লোগো ---------------------------- */}
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Image source={require("../assets/icon.png")} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.title}>নিকাশ</Text>
          <Text style={styles.subtitle}>দোকানের হিসাব, হাতের মুঠোয়</Text>
        </View>

        {/* ---------------------------- ফর্ম ---------------------------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>লগইন করুন</Text>

          <AuthField
            label="ফোন নম্বর"
            placeholder="01712345678"
            hint="যে নম্বর দিয়ে অ্যাকাউন্ট খুলেছেন"
            keyboardType="phone-pad"
            maxLength={14}
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              if (error) setError(null);
            }}
          />

          <AuthField
            label="পাসওয়ার্ড"
            placeholder="আপনার পাসওয়ার্ড"
            secure
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (error) setError(null);
            }}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading || !canSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>লগইন করুন</Text>
            )}
          </Pressable>
        </View>

        {/* ------------------------- নতুন অ্যাকাউন্ট ------------------------- */}
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>অথবা</Text>
          <View style={styles.line} />
        </View>

        <Pressable style={styles.secondaryBtn} onPress={() => router.push("/signup")}>
          <Text style={styles.secondaryText}>নতুন অ্যাকাউন্ট খুলুন</Text>
          <Text style={styles.secondaryBadge}>১৫ দিন ফ্রি</Text>
        </Pressable>

        {DEMO_PHONE && DEMO_PASSWORD ? (
          <Pressable style={styles.demoBtn} onPress={handleDemo} disabled={demoLoading}>
            {demoLoading ? (
              <ActivityIndicator color={theme.textMuted} />
            ) : (
              <Text style={styles.demoText}>👀 আগে দেখে নিন (নিবন্ধন ছাড়াই)</Text>
            )}
          </Pressable>
        ) : null}

        <Text style={styles.footer}>ইন্টারনেট ছাড়াও চলে · আপনার হিসাব নিরাপদ</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 22, paddingBottom: 36 },

  header: { alignItems: "center", marginBottom: 26 },
  logoWrap: {
    // লোগোতেই সবুজ পটভূমি আছে — এখানে শুধু ছায়া
    borderRadius: 20,
    elevation: 3,
    shadowColor: "#0f172a",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  logo: { width: 76, height: 76, borderRadius: 20 },
  title: { fontSize: 28, fontWeight: "800", color: theme.text, marginTop: 14 },
  subtitle: { fontSize: 13, color: theme.textMuted, marginTop: 4 },

  card: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 18,
    elevation: 1,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: theme.text, marginBottom: 16 },

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
    backgroundColor: theme.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 15.5 },

  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  line: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: { fontSize: 12, color: theme.textFaint },

  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.success,
    borderRadius: 14,
    paddingVertical: 14,
  },
  secondaryText: { color: theme.success, fontWeight: "800", fontSize: 14.5 },
  secondaryBadge: {
    backgroundColor: theme.successBg,
    color: theme.success,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },

  demoBtn: { paddingVertical: 14, alignItems: "center", marginTop: 6 },
  demoText: { color: theme.textMuted, fontSize: 13.5, fontWeight: "600" },

  footer: { fontSize: 11.5, color: theme.textFaint, textAlign: "center", marginTop: 22 },
});
