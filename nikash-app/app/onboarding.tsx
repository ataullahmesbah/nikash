import { useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { markOnboardingSeen } from "@/lib/onboarding";

const { width } = Dimensions.get("window");

const slides = [
  {
    icon: "📒",
    title: "সব হিসাব এক জায়গায়",
    body: "বিক্রয়, ক্রয়, খরচ, বাকি-পাওনা — প্রতিদিনের সব লেনদেন এক অ্যাপ থেকেই সহজে লিখুন।",
  },
  {
    icon: "📶",
    title: "ইন্টারনেট ছাড়াও চলবে",
    body: "নেট না থাকলেও এন্ট্রি বন্ধ থাকবে না — ফোনে জমা থাকবে, নেট ফিরলেই নিজে থেকে সিঙ্ক হয়ে যাবে।",
  },
  {
    icon: "📊",
    title: "ব্যবসার অবস্থা এক নজরে",
    body: "লাভ-ক্ষতি, স্টক, সেরা পণ্য-ক্রেতা, মাসের লক্ষ্য — গ্রাফে দেখে সিদ্ধান্ত নিন দ্রুত।",
  },
];

export default function OnboardingScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === slides.length - 1;

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    if (newIndex !== index) setIndex(newIndex);
  }

  async function finish() {
    await markOnboardingSeen();
    router.replace("/login");
  }

  function handleNext() {
    if (isLast) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.skip} onPress={finish}>
        <Text style={styles.skipText}>এড়িয়ে যান</Text>
      </Pressable>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
      >
        {slides.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <Text style={styles.icon}>{slide.icon}</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {slides.map((slide, i) => (
          <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <Pressable style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>{isLast ? "শুরু করুন" : "পরবর্তী"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  skip: { position: "absolute", top: 56, right: 20, zIndex: 1 },
  skipText: { color: "#94a3b8", fontWeight: "600", fontSize: 14 },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  icon: { fontSize: 72, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a", textAlign: "center" },
  body: { fontSize: 15, color: "#64748b", textAlign: "center", marginTop: 12, lineHeight: 22 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e2e8f0" },
  dotActive: { backgroundColor: "#0f172a", width: 20 },
  button: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginHorizontal: 24,
    marginBottom: 40,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
