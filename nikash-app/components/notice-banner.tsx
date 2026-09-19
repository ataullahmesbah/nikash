import { useCallback, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { useNoticeWatch } from "@/lib/realtime";
import { dismissNotice, getDismissed, loadActiveNotices, markNoticeRead, type Notice } from "@/lib/notices";
import { playNotificationSound } from "@/lib/sound";
import { theme } from "./ui";

const toneFor = (severity: string) =>
  severity === "critical"
    ? { bg: theme.dangerBg, border: "#fecaca", fg: theme.danger, icon: "🚨" }
    : severity === "warning"
      ? { bg: theme.warningBg, border: "#fde68a", fg: theme.warning, icon: "⚠️" }
      : { bg: theme.infoBg, border: "#bae6fd", fg: theme.info, icon: "📢" };

// ড্যাশবোর্ডের উপরে বসে। অ্যাডমিন প্যানেল থেকে নোটিশ পাঠানোর সাথে সাথে
// Realtime দিয়ে এখানে চলে আসে — অ্যাপ রিস্টার্ট করা লাগে না।
export function NoticeBanner() {
  const { profile, session } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [popup, setPopup] = useState<Notice | null>(null);

  // আগে দেখা নোটিশের আইডি — নতুন কিছু এলে তবেই ভাইব্রেট করব
  const seenIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    const [list, hidden] = await Promise.all([loadActiveNotices(), getDismissed()]);
    setNotices(list);
    setDismissed(hidden);

    const fresh = list.filter((n) => !seenIds.current.has(n.id) && !hidden.includes(n.id));
    list.forEach((n) => seenIds.current.add(n.id));

    // প্রথমবার লোডে বাজাই না — পুরনো নোটিশে শব্দ করার মানে নেই
    if (!firstLoad.current && fresh.length > 0) {
      playNotificationSound([0, 180, 90, 180]);
    }
    firstLoad.current = false;

    // অ্যাডমিন নোটিশটা বন্ধ বা মুছে দিলে খোলা পপআপটাও সরে যাওয়া চাই —
    // তাই না পেলে null বসাই (আগে শুধু পেলে সেট হতো, ফলে বাতিল করা
    // নোটিশের পপআপ পর্দায় আটকে থাকত)।
    const firstPopup = list.find((n) => n.show_as === "popup" && !hidden.includes(n.id));
    setPopup(firstPopup ?? null);
  }, []);

  // স্ক্রিনে ফিরলেই আবার দেখি — আগে শুধু একবার (লগইনের পর) লোড হতো, তাই
  // অ্যাপ খোলা থাকা অবস্থায় পাঠানো নোটিশ আর আসত না।
  useFocusEffect(
    useCallback(() => {
      if (profile) load();
    }, [profile, load])
  );

  // অ্যাডমিন নতুন নোটিশ দিলে সাথে সাথে রিলোড
  useNoticeWatch(!!profile, load);

  const visible = notices.filter((n) => n.show_as === "banner" && !dismissed.includes(n.id));
  if (visible.length === 0 && !popup) return null;

  async function hide(n: Notice) {
    await dismissNotice(n.id);
    setDismissed((prev) => [...prev, n.id]);
    if (session?.user.id) markNoticeRead(n.id, session.user.id).catch(() => {});
  }

  return (
    <>
      {visible.slice(0, 2).map((n) => {
        const tone = toneFor(n.severity);
        return (
          <Pressable
            key={n.id}
            style={[styles.banner, { backgroundColor: tone.bg, borderColor: tone.border }]}
            onPress={() => router.push("/notices")}
          >
            <Text style={styles.bannerIcon}>{tone.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: tone.fg }]} numberOfLines={1}>
                {n.title_bn}
              </Text>
              {n.body_bn ? (
                <Text style={styles.bannerBody} numberOfLines={2}>
                  {n.body_bn}
                </Text>
              ) : null}
            </View>
            {n.is_dismissible && (
              <Pressable hitSlop={10} onPress={() => hide(n)}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            )}
          </Pressable>
        );
      })}

      <Modal visible={!!popup} transparent animationType="fade" onRequestClose={() => setPopup(null)}>
        <View style={styles.backdrop}>
          <View style={styles.popupCard}>
            <Text style={styles.popupIcon}>{popup ? toneFor(popup.severity).icon : ""}</Text>
            <Text style={styles.popupTitle}>{popup?.title_bn}</Text>
            {popup?.body_bn ? <Text style={styles.popupBody}>{popup.body_bn}</Text> : null}
            <Pressable
              style={styles.popupBtn}
              onPress={async () => {
                if (popup) await hide(popup);
                setPopup(null);
              }}
            >
              <Text style={styles.popupBtnText}>বুঝেছি</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  bannerIcon: { fontSize: 18 },
  bannerTitle: { fontSize: 13, fontWeight: "700" },
  bannerBody: { fontSize: 12, color: theme.textMuted, marginTop: 2, lineHeight: 17 },
  close: { fontSize: 15, color: theme.textFaint, paddingHorizontal: 4 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "center", padding: 24 },
  popupCard: { backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center" },
  popupIcon: { fontSize: 40, marginBottom: 10 },
  popupTitle: { fontSize: 17, fontWeight: "800", color: theme.text, textAlign: "center" },
  popupBody: { fontSize: 14, color: theme.textMuted, textAlign: "center", marginTop: 10, lineHeight: 21 },
  popupBtn: {
    marginTop: 20,
    backgroundColor: theme.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  popupBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
