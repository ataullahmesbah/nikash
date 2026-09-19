import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, ViewStyle } from "react-native";
import { theme } from "./ui";

// শিমার স্কেলিটন — স্পিনারের বদলে এটা দেখালে অ্যাপ দ্রুত ও প্রফেশনাল লাগে,
// কারণ ব্যবহারকারী আগেই বুঝতে পারে কী ধরনের কনটেন্ট আসছে।
function Shimmer({ style }: { style?: ViewStyle }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  return <Animated.View style={[styles.block, style, { opacity }]} />;
}

export function SkeletonLine({ width = "100%", height = 12 }: { width?: ViewStyle["width"]; height?: number }) {
  return <Shimmer style={{ width, height, borderRadius: height / 2 }} />;
}

/** তালিকা স্ক্রিনের লোডিং — কয়েকটা সারির কঙ্কাল */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.card}>
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonLine width="60%" height={14} />
            <SkeletonLine width="40%" height={10} />
          </View>
          <View style={{ gap: 8, alignItems: "flex-end" }}>
            <SkeletonLine width={64} height={14} />
            <SkeletonLine width={44} height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** ড্যাশবোর্ডের লোডিং — কার্ড গ্রিডের কঙ্কাল */
export function SkeletonDashboard() {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <View style={{ gap: 8 }}>
        <SkeletonLine width="55%" height={20} />
        <SkeletonLine width="35%" height={12} />
      </View>
      <View style={styles.quickRow}>
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} style={styles.quickBlock} />
        ))}
      </View>
      <Shimmer style={{ height: 64, borderRadius: 16 }} />
      <View style={styles.grid}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Shimmer key={i} style={styles.statBlock} />
        ))}
      </View>
    </View>
  );
}

/** বিস্তারিত পেজের লোডিং */
export function SkeletonDetail() {
  return (
    <View style={{ padding: 16, gap: 14 }}>
      <SkeletonLine width="50%" height={20} />
      <SkeletonLine width="30%" height={12} />
      <Shimmer style={{ height: 160, borderRadius: 16, marginTop: 8 }} />
      <Shimmer style={{ height: 48, borderRadius: 12 }} />
      <Shimmer style={{ height: 48, borderRadius: 12 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: "#e2e8f0" },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
  },
  quickRow: { flexDirection: "row", gap: 10 },
  quickBlock: { flex: 1, height: 68, borderRadius: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statBlock: { width: "47.5%", height: 82, borderRadius: 16 },
});
