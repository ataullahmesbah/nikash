import { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/lib/toast/toast-context";
import { SyncBadge } from "@/components/sync-badge";
import { ToastContainer } from "@/components/toast-container";
import { loadSoundPref } from "@/lib/sound";
import { UpdateGate } from "@/components/update-gate";

export default function RootLayout() {
  // নোটিফিকেশনের শব্দ চালু/বন্ধ — সেভ করা পছন্দটা শুরুতেই পড়ে নিই
  useEffect(() => {
    loadSoundPref().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          <SafeAreaView edges={["top"]} style={{ backgroundColor: "#fff" }}>
            <SyncBadge />
            {/* নতুন ভার্সন এলে ব্যানার; জরুরি হলে পুরো পর্দা আটকাবে */}
            <UpdateGate />
          </SafeAreaView>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="(tabs)" />
          </Stack>
          <ToastContainer />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
