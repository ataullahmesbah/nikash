import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeTable } from "@/lib/realtime";
import { loadNotifications, markAllRead, markRead, type AppNotification } from "@/lib/notifications";
import { daysAgoBn } from "@/lib/format";
import { isSoundOn, loadSoundPref, setSoundOn } from "@/lib/sound";
import { EmptyState, theme } from "@/components/ui";
import { SkeletonList } from "@/components/skeleton";

const ICONS: Record<string, string> = {
  payment: "💳",
  subscription: "📅",
  notice: "📢",
  due: "📋",
  stock: "📦",
  system: "⚙️",
};

const TONE: Record<string, { bg: string; fg: string }> = {
  info: { bg: theme.infoBg, fg: theme.info },
  success: { bg: theme.successBg, fg: theme.success },
  warning: { bg: theme.warningBg, fg: theme.warning },
  critical: { bg: theme.dangerBg, fg: theme.danger },
};

export default function NotificationsScreen() {
  const { profile } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState(isSoundOn());

  // সেভ করা পছন্দটা পড়ে নিই — কেউ শব্দ বন্ধ করে রাখলে সেটা মনে থাকবে
  useEffect(() => {
    loadSoundPref().then(setSound);
  }, []);

  async function toggleSound() {
    const next = !sound;
    setSound(next);
    await setSoundOn(next); // চালু করলে একবার বাজিয়ে শুনিয়ে দেয়
  }

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setItems(await loadNotifications());
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // নতুন নোটিফিকেশন এলে সাথে সাথে তালিকায় আসবে
  useRealtimeTable(
    "notifications",
    profile?.company_id ? `company_id=eq.${profile.company_id}` : undefined,
    load,
    !!profile
  );

  const unread = items.filter((n) => !n.read_at).length;

  async function openItem(n: AppNotification) {
    if (!n.read_at) {
      markRead(n.id).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    if (n.link) router.push(n.link as never);
  }

  async function handleMarkAll() {
    await markAllRead();
    const now = new Date().toISOString();
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? now })));
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: "নোটিফিকেশন", headerShown: true }} />

      <View style={styles.headerBar}>
        <Pressable onPress={toggleSound} hitSlop={8} style={styles.soundBtn}>
          <Text style={styles.soundIcon}>{sound ? "🔔" : "🔕"}</Text>
          <Text style={styles.soundText}>{sound ? "শব্দ চালু" : "শব্দ বন্ধ"}</Text>
        </Pressable>

        {unread > 0 ? (
          <Pressable onPress={handleMarkAll} hitSlop={8}>
            <Text style={styles.markAll}>{unread}টি অপঠিত · সব পড়া হলো</Text>
          </Pressable>
        ) : (
          <Text style={styles.headerText}>সব পড়া হয়েছে</Text>
        )}
      </View>

      {loading && items.length === 0 ? (
        <SkeletonList rows={6} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={items.length === 0 ? { flex: 1 } : styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          ListEmptyComponent={
            <EmptyState
              icon="🔔"
              title="কোনো নোটিফিকেশন নেই"
              message="পেমেন্ট, সাবস্ক্রিপশন বা নোটিশ এলে এখানে দেখা যাবে।"
            />
          }
          renderItem={({ item }) => {
            const tone = TONE[item.severity] ?? TONE.info;
            return (
              <Pressable
                style={[styles.row, !item.read_at && styles.rowUnread]}
                onPress={() => openItem(item)}
              >
                <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
                  <Text style={styles.icon}>{ICONS[item.type] ?? "🔔"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, !item.read_at && styles.titleUnread]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.body ? (
                    <Text style={styles.body} numberOfLines={3}>
                      {item.body}
                    </Text>
                  ) : null}
                  <Text style={styles.time}>{daysAgoBn(item.created_at)}</Text>
                </View>
                {!item.read_at && <View style={[styles.dot, { backgroundColor: tone.fg }]} />}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  soundBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.bg,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  soundIcon: { fontSize: 14 },
  soundText: { fontSize: 12, fontWeight: "700", color: theme.textMuted },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerText: { fontSize: 13, fontWeight: "700", color: theme.text },
  markAll: { fontSize: 12, fontWeight: "600", color: theme.accent },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
  },
  rowUnread: { borderColor: "#c7d2fe", backgroundColor: "#fbfcff" },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 17 },
  title: { fontSize: 14, color: theme.text, fontWeight: "600" },
  titleUnread: { fontWeight: "800" },
  body: { fontSize: 12.5, color: theme.textMuted, marginTop: 4, lineHeight: 18 },
  time: { fontSize: 11, color: theme.textFaint, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
