import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
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
    width: 104,
    height: 104,
    borderRadius: 26,
    backgroundColor: "#E6F4FE",
    alignItems: "center",
    justifyContent: "center",
    // অ্যান্ড্রয়েডে elevation, iOS-এ shadow — দুটোই দিলাম
    elevation: 3,
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  logo: { width: 68, height: 68 },
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
});
