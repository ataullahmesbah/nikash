import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { signInWithPhone } from "@/lib/supabase";

const DEMO_PHONE = process.env.EXPO_PUBLIC_DEMO_PHONE;
const DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD;

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const { error } = await signInWithPhone(phone.trim(), password);
    setLoading(false);
    if (error) {
      setError("ভুল ফোন নম্বর অথবা পাসওয়ার্ড");
      return;
    }
    router.replace("/(tabs)/dashboard");
  }

  async function handleDemo() {
    if (!DEMO_PHONE || !DEMO_PASSWORD) return;
    setError(null);
    setDemoLoading(true);
    const { error } = await signInWithPhone(DEMO_PHONE, DEMO_PASSWORD);
    setDemoLoading(false);
    if (error) {
      setError("ডেমো অ্যাকাউন্টে লগইন করা যায়নি");
      return;
    }
    router.replace("/(tabs)/dashboard");
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>নিকাশ</Text>
      <Text style={styles.subtitle}>ফোন নম্বর দিয়ে লগইন করুন</Text>

      <TextInput
        style={styles.input}
        placeholder="০১৭XXXXXXXX"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput
        style={styles.input}
        placeholder="পাসওয়ার্ড"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>লগইন করুন</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.push("/signup")}>
        <Text style={styles.demoLink}>নতুন অ্যাকাউন্ট — ১৫ দিন ফ্রি ট্রায়াল</Text>
      </Pressable>

      {DEMO_PHONE && DEMO_PASSWORD && (
        <Pressable style={styles.demoButton} onPress={handleDemo} disabled={demoLoading}>
          {demoLoading ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.demoButtonText}>👀 ডেমো দেখুন (নিবন্ধন ছাড়াই)</Text>
          )}
        </Pressable>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 32, fontWeight: "700", textAlign: "center", color: "#0f172a" },
  subtitle: { fontSize: 14, textAlign: "center", color: "#64748b", marginTop: 4, marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  error: { color: "#dc2626", marginBottom: 12, fontSize: 13 },
  button: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  demoLink: { textAlign: "center", marginTop: 20, color: "#059669", fontWeight: "600" },
  demoButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  demoButtonText: { color: "#334155", fontWeight: "600", fontSize: 14 },
});
