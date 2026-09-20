import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { supabaseConfigError } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { toBnDigits } from "@/lib/format";
import { theme } from "@/components/ui";

// অ্যাপ খোলার পর্দা (splash)।
//
// আগে এখানে শুধু একটা ঘূর্ণায়মান চাকা ছিল — দেখে মনে হতো অ্যাপ আটকে
// গেছে। এখন বড় অ্যাপগুলোর মতো লোগো, নাম ও ভার্সন দেখায়, নিচে সরু
// প্রগ্রেস বার। সেশন যাচাই আর অনবোর্ডিং দেখা হয়েছে কিনা — দুটোই এই
// ফাঁকে হয়ে যায়।

// খুব দ্রুত চলে গেলে ঝলক লাগে, তাই অন্তত এতটুকু সময় পর্দাটা থাকবে
const MIN_SHOW_MS = 1100;

export default function SplashScreen() {
  const { session, loading } = useAuth();
  const [ready, setReady] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(14)).current;
  const bar = useRef(new Animated.Value(0)).current;

  const version = Constants.expoConfig?.version ?? "1.0.0";

  // লোগো ফুটে ওঠা + নিচের বারটা বারবার বাঁ থেকে ডানে যাওয়া
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 480,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    const loop = Animated.loop(
      Animated.timing(bar, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();

    const t = setTimeout(() => setReady(true), MIN_SHOW_MS);
    return () => {
      loop.stop();
      clearTimeout(t);
    };
  }, [fade, rise, bar]);

  // সেশন যাচাই শেষ আর ন্যূনতম সময়ও পার — তবেই এগোব
  useEffect(() => {
    // সেটিংসই নেই — এগোনোর মানে হয় না, পর্দায় কারণটা দেখাব
    if (supabaseConfigError) return;
    if (loading || !ready) return;

    if (session) {
      router.replace("/(tabs)/dashboard");
      return;
    }
    hasSeenOnboarding()
      .then((seen) => router.replace(seen ? "/login" : "/onboarding"))
      // পড়তে না পারলে লগইনই নিরাপদ ধরে নিই
      .catch(() => router.replace("/login"));
  }, [session, loading, ready]);

  const barShift = bar.interpolate({
    inputRange: [0, 1],
    outputRange: [-110, 110],
  });

  // ---------- সেটিংস মিসিং: অ্যাপ বন্ধ না করে কারণটা দেখাই ----------
  //
  // APK বানানোর সময় .env বিল্ড সার্ভারে না পৌঁছালে এটাই হয়। আগে অ্যাপ
  // চুপচাপ বন্ধ হয়ে যেত, কিছুই বোঝা যেত না।
  if (supabaseConfigError) {
    return (
      <View style={[styles.container, { padding: 28 }]}>
        <Text style={styles.errIcon}>⚙️</Text>
        <Text style={styles.errTitle}>অ্যাপের সেটিংস পাওয়া যায়নি</Text>
        <Text style={styles.errBody}>
          সার্ভারের ঠিকানা অ্যাপের ভেতরে ঢোকেনি, তাই কিছু দেখানো যাচ্ছে না।
          এটি অ্যাপ তৈরির সময়ের ভুল — আপনার ফোনের কোনো সমস্যা নয়।
        </Text>

        <View style={styles.errBox}>
          <Text style={styles.errBoxLabel}>যা নেই</Text>
          <Text style={styles.errBoxValue}>{supabaseConfigError}</Text>
        </View>

        <Text style={styles.errHint}>
          অনুগ্রহ করে এই লেখাটি সাপোর্টে জানান — নতুন সংস্করণ দিয়ে ঠিক করা হবে।
        </Text>
        <Text style={styles.version}>সংস্করণ {toBnDigits(version)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }], alignItems: "center" }}>
        <View style={styles.logoWrap}>
          <Image source={require("../assets/icon.png")} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.name}>নিকাশ</Text>
        <Text style={styles.tagline}>দোকানের হিসাব, হাতের মুঠোয়</Text>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fade }]}>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { transform: [{ translateX: barShift }] }]} />
        </View>
        <Text style={styles.version}>সংস্করণ {toBnDigits(version)}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
    paddingBottom: 40,
  },
  logoWrap: {
    // লোগোটা নিজেই গোল-চৌকো সবুজ, তাই পেছনে আর কোনো রঙের বাক্স নয় —
    // শুধু ছায়াটুকু, যাতে পর্দা থেকে একটু উঠে থাকে।
    borderRadius: 26,
    // অ্যান্ড্রয়েডে elevation, iOS-এ shadow — দুটোই দিলাম
    elevation: 4,
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  logo: { width: 104, height: 104, borderRadius: 26 },
  name: {
    marginTop: 20,
    fontSize: 30,
    fontWeight: "800",
    color: theme.text,
    letterSpacing: 0.5,
  },
  tagline: {
    marginTop: 6,
    fontSize: 13.5,
    color: theme.textMuted,
  },
  footer: {
    position: "absolute",
    bottom: 48,
    alignItems: "center",
    gap: 14,
  },
  barTrack: {
    width: 140,
    height: 3,
    borderRadius: 999,
    backgroundColor: theme.surfaceAlt,
    overflow: "hidden",
  },
  barFill: {
    width: 56,
    height: 3,
    borderRadius: 999,
    backgroundColor: theme.accent,
  },
  version: { fontSize: 11.5, color: theme.textFaint, letterSpacing: 0.3 },

  // সেটিংস মিসিং পর্দা
  errIcon: { fontSize: 46, marginBottom: 14 },
  errTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.text,
    textAlign: "center",
    marginBottom: 10,
  },
  errBody: {
    fontSize: 13.5,
    color: theme.textMuted,
    textAlign: "center",
    lineHeight: 21,
  },
  errBox: {
    marginTop: 18,
    alignSelf: "stretch",
    backgroundColor: theme.dangerBg,
    borderRadius: 12,
    padding: 13,
    gap: 4,
  },
  errBoxLabel: { fontSize: 11, color: theme.danger, fontWeight: "700" },
  errBoxValue: { fontSize: 12.5, color: theme.text, lineHeight: 19 },
  errHint: {
    marginTop: 16,
    fontSize: 12.5,
    color: theme.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
});
