import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { getPendingCount, processSyncQueue } from "@/lib/offline/sync-queue";
import { runDailyBackupIfNeeded, shareBackup } from "@/lib/backup";
import { unreadCount } from "@/lib/notifications";
import { Badge, Section, theme } from "@/components/ui";

type Item = { label: string; icon: string; href?: string; onPress?: () => void; badge?: string; hide?: boolean };

function MenuGroup({ title, items }: { title: string; items: Item[] }) {
  const visible = items.filter((i) => !i.hide);
  if (visible.length === 0) return null;
  return (
    <Section title={title}>
      <View style={styles.group}>
        {visible.map((item, i) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [
              styles.row,
              i === visible.length - 1 && { borderBottomWidth: 0 },
              pressed && { backgroundColor: theme.surfaceAlt },
            ]}
            onPress={item.onPress ?? (() => item.href && router.push(item.href as never))}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.label}>{item.label}</Text>
            {item.badge ? <Badge label={item.badge} tone="danger" /> : null}
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

export default function MoreScreen() {
  const { profile, signOut } = useAuth();
  const toast = useToast();
  const [backingUp, setBackingUp] = useState(false);
  const [unread, setUnread] = useState(0);

  const isShop = profile?.business_type === "shop";
  const isWarehouse = profile?.business_type === "warehouse";
  const isOwner = profile?.role === "owner";

  useEffect(() => {
    if (!profile) return;
    // PRD 18 rule #6 — দিনে একবার নিঃশব্দে ব্যাকআপ
    runDailyBackupIfNeeded(profile.company_id, profile.companies?.name ?? "").catch(() => { });
    unreadCount().then(setUnread).catch(() => { });
  }, [profile]);

  async function handleBackup() {
    if (!profile) return;
    setBackingUp(true);
    try {
      await shareBackup(profile.company_id, profile.companies?.name ?? "");
    } catch {
      toast.error("ব্যাকআপ তৈরি করা যায়নি");
    } finally {
      setBackingUp(false);
    }
  }

  async function handleLogout() {
    // PRD 18 rule #2 — অসিঙ্ক ডেটা থাকলে লগআউট আটকাবে
    const pending = await getPendingCount();
    if (pending > 0) {
      Alert.alert(
        `${pending}টি এন্ট্রি এখনো sync হয়নি`,
        "লগ আউট করলে ঝুঁকি আছে। আগে ইন্টারনেট চালু করে sync হতে দিন, অথবা জোর করে লগ আউট করুন।",
        [
          { text: "বাতিল", style: "cancel" },
          { text: "আবার Sync করুন", onPress: () => processSyncQueue() },
          {
            text: "জোর করে লগ আউট",
            style: "destructive",
            onPress: async () => {
              await signOut();
              router.replace("/login");
            },
          },
        ]
      );
      return;
    }
    await signOut();
    router.replace("/login");
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile?.name ?? "N").slice(0, 1)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile?.name}</Text>
          <Text style={styles.role}>
            {profile?.companies?.name} · {profile?.role}
          </Text>
        </View>
        <Pressable style={styles.bell} onPress={() => router.push("/notifications")}>
          <Text style={{ fontSize: 17 }}>🔔</Text>
          {unread > 0 && (
            <View style={styles.bellDot}>
              <Text style={styles.bellDotText}>{unread > 9 ? "9+" : unread}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <MenuGroup
        title="হিসাব ও রিপোর্ট"
        items={[
          { label: "বাকির হিসাব", icon: "📋", href: "/due" },
          { label: "Analytics (গ্রাফ)", icon: "📈", href: "/analytics" },
          { label: "রিপোর্ট", icon: "📑", href: "/reports" },
        ]}
      />

      <MenuGroup
        title="ইনভেন্টরি"
        items={[
          { label: "প্রোডাক্ট তালিকা", icon: "📦", href: "/products" },
          { label: "বর্তমান স্টক", icon: "🏷️", href: "/inventory" },
          { label: "স্টক সমন্বয়", icon: "⚖️", href: "/inventory/adjust" },
          { label: "স্টক ট্রান্সফার", icon: "🔄", href: "/inventory/transfers" },
          { label: "স্টক গণনা", icon: "🔢", href: "/inventory/counts" },
          { label: "মেয়াদ রেজিস্টার", icon: "📅", href: "/inventory/expiry" },
        ]}
      />

      <MenuGroup
        title="লেনদেন"
        items={[
          { label: "লেনদেন খাতা", icon: "📒", href: "/payments" },
          { label: "নতুন পেমেন্ট", icon: "💵", href: "/payments/new" },
          { label: "খরচ", icon: "💸", href: "/expenses" },
          { label: "POS (দ্রুত বিক্রয়)", icon: "🧾", href: "/pos", hide: !isShop },
        ]}
      />

      <MenuGroup
        title="পরিবহন"
        items={[
          { label: "গাড়ি", icon: "🚚", href: "/vehicles" },
          { label: "ট্রিপ", icon: "🛣️", href: "/trips" },
          { label: "রুট ব্যবস্থাপনা", icon: "🗺️", href: "/routes", hide: !isWarehouse },
        ]}
      />

      <MenuGroup
        title="সেটিংস"
        items={[
          { label: "নোটিফিকেশন", icon: "🔔", href: "/notifications", badge: unread > 0 ? String(unread) : undefined },
          { label: "আমার সাবস্ক্রিপশন", icon: "💳", href: "/subscription" },
          {
            label: backingUp ? "ব্যাকআপ তৈরি হচ্ছে..." : "ব্যাকআপ শেয়ার করুন",
            icon: "📦",
            onPress: backingUp ? () => { } : handleBackup,
          },
          { label: "অডিট লগ", icon: "🕓", href: "/audit", hide: !isOwner },
        ]}
      />

      <MenuGroup title="সহায়তা" items={[{ label: "সাহায্য ও যোগাযোগ", icon: "❓", href: "/help" }]} />

      <Pressable style={styles.logout} onPress={handleLogout}>
        <Text style={styles.logoutText}>লগ আউট</Text>
      </Pressable>

      <Text style={styles.version}>নিকাশ v1.2.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  name: { fontSize: 17, fontWeight: "800", color: theme.text },
  role: { fontSize: 12.5, color: theme.textMuted, marginTop: 2 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 3,
    right: 3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellDotText: { color: "#fff", fontSize: 9.5, fontWeight: "800" },
  group: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  icon: { fontSize: 17, width: 24 },
  label: { flex: 1, fontSize: 14.5, color: theme.text, fontWeight: "500" },
  arrow: { fontSize: 19, color: theme.textFaint },
  logout: {
    marginTop: 8,
    backgroundColor: theme.dangerBg,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  logoutText: { color: theme.danger, fontWeight: "700", fontSize: 15 },
  version: { textAlign: "center", color: theme.textFaint, fontSize: 11, marginTop: 16 },
});
