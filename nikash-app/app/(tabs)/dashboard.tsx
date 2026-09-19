import { useCallback, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useCompanyWatch, useRealtimeTable } from "@/lib/realtime";
import { unreadCount } from "@/lib/notifications";
import { playNotificationSound } from "@/lib/sound";
import { taka, daysAgoBn, type DateRange } from "@/lib/format";
import { DateRangePicker, defaultRange } from "@/components/date-range-picker";
import { NoticeBanner } from "@/components/notice-banner";
import { Card, EmptyState, Section, StatCard, theme } from "@/components/ui";
import { SkeletonDashboard } from "@/components/skeleton";

type Totals = {
  sales: number;
  collection: number;
  purchase: number;
  expense: number;
  profit: number;
  receivable: number;
  payable: number;
  stockValue: number;
};

const EMPTY: Totals = {
  sales: 0, collection: 0, purchase: 0, expense: 0,
  profit: 0, receivable: 0, payable: 0, stockValue: 0,
};

const QUICK = [
  { icon: "🧾", label: "নতুন বিক্রয়", href: "/sales/new" },
  { icon: "🛒", label: "নতুন ক্রয়", href: "/purchases/new" },
  { icon: "💵", label: "পেমেন্ট", href: "/payments/new" },
  { icon: "📋", label: "বাকির হিসাব", href: "/due" },
] as const;

export default function DashboardScreen() {
  const { profile, refreshProfile } = useAuth();
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [totals, setTotals] = useState<Totals>(EMPTY);
  const [hasRows, setHasRows] = useState(false);
  const [expiryDays, setExpiryDays] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  // ব্যাংক/চেকে কত এলো-গেলো — ক্যাশের পাশে আলাদা করে দেখা দরকার
  const [bank, setBank] = useState<{ received: number; paid: number; count: number }>({
    received: 0,
    paid: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    // রেঞ্জের সব দিনের সারসংক্ষেপ যোগ করি — এক দিনের বদলে যেকোনো সময়সীমা।
    const { data } = await supabase
      .from("daily_summaries")
      .select(
        "summary_date, sales_total, collection_total, purchase_total, expense_total, net_profit, receivable, payable, stock_value"
      )
      .eq("company_id", profile.company_id)
      .gte("summary_date", range.from)
      .lte("summary_date", range.to)
      .order("summary_date", { ascending: true });

    const { data: bankData } = await supabase.rpc("bank_payment_summary", {
      p_from: range.from,
      p_to: range.to,
    });
    if (bankData) {
      const b = bankData as { received?: number; paid?: number; count?: number };
      setBank({
        received: Number(b.received ?? 0),
        paid: Number(b.paid ?? 0),
        count: Number(b.count ?? 0),
      });
    }

    const rows = data ?? [];
    setHasRows(rows.length > 0);

    // প্রবাহ (বিক্রয়/খরচ) যোগ হয়, কিন্তু স্থিতি (পাওনা/স্টক) সর্বশেষ দিনেরটাই।
    const last = rows[rows.length - 1];
    setTotals({
      sales: rows.reduce((s, r) => s + Number(r.sales_total), 0),
      collection: rows.reduce((s, r) => s + Number(r.collection_total), 0),
      purchase: rows.reduce((s, r) => s + Number(r.purchase_total), 0),
      expense: rows.reduce((s, r) => s + Number(r.expense_total), 0),
      profit: rows.reduce((s, r) => s + Number(r.net_profit), 0),
      receivable: Number(last?.receivable ?? 0),
      payable: Number(last?.payable ?? 0),
      stockValue: Number(last?.stock_value ?? 0),
    });

    // সাবস্ক্রিপশনের মেয়াদ কত দিন বাকি
    const { data: company } = await supabase
      .from("companies")
      .select("end_date, is_free")
      .eq("id", profile.company_id)
      .maybeSingle();
    if (company?.end_date && !company.is_free) {
      const diff = Math.ceil((new Date(company.end_date).getTime() - Date.now()) / 86400000);
      setExpiryDays(diff);
    } else {
      setExpiryDays(null);
    }

    setUnread(await unreadCount());
    setLoading(false);
  }, [profile, range]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // অ্যাডমিন স্ট্যাটাস/মেয়াদ বদলালে সাথে সাথে প্রোফাইল ও হিসাব রিফ্রেশ
  useCompanyWatch(profile?.company_id, () => {
    refreshProfile();
    load();
  });

  // নতুন নোটিফিকেশন এলে ব্যাজ সাথে সাথে আপডেট হবে, সাথে ঘণ্টার শব্দ ও
  // কাঁপুনি — নইলে ব্যাজটা চোখ এড়িয়ে যায়
  useRealtimeTable(
    "notifications",
    profile?.company_id ? `company_id=eq.${profile.company_id}` : undefined,
    () => {
      playNotificationSound();
      unreadCount().then(setUnread).catch(() => { });
    },
    !!profile
  );

  if (loading && !hasRows && totals === EMPTY) return <SkeletonDashboard />;

  const isToday = range.from === range.to;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.companyName}>{profile?.companies?.name ?? "—"}</Text>
          <Text style={styles.companyMeta}>
            {profile?.companies?.nikash_id} · {profile?.role}
          </Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={() => router.push("/notifications")}>
          <Text style={styles.iconBtnText}>🔔</Text>
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <NoticeBanner />

      {expiryDays !== null && expiryDays <= 7 && (
        <Pressable
          style={[styles.expiryBar, expiryDays <= 3 && styles.expiryBarUrgent]}
          onPress={() => router.push("/subscription")}
        >
          <Text style={[styles.expiryText, expiryDays <= 3 && styles.expiryTextUrgent]}>
            {expiryDays <= 0
              ? "⛔ সাবস্ক্রিপশনের মেয়াদ শেষ — নবায়ন করুন"
              : `⏰ মেয়াদ শেষ হতে ${expiryDays} দিন বাকি — নবায়ন করুন`}
          </Text>
        </Pressable>
      )}

      <View style={styles.quickRow}>
        {QUICK.map((q) => (
          <Pressable key={q.href} style={styles.quickAction} onPress={() => router.push(q.href)}>
            <Text style={styles.quickIcon}>{q.icon}</Text>
            <Text style={styles.quickLabel}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <Card style={styles.rangeCard}>
        <DateRangePicker value={range} onChange={setRange} />
      </Card>

      <Section title={isToday ? "আজকের হিসাব" : "নির্বাচিত সময়ের হিসাব"}>
        <View style={styles.grid}>
          <StatCard
            label={isToday ? "আজকের বিক্রি" : "মোট বিক্রি"}
            value={taka(totals.sales)}
            onPress={() => router.push("/sales")}
          />
          <StatCard
            label="আদায়"
            value={taka(totals.collection)}
            tone="success"
            onPress={() => router.push("/payments/new")}
          />
          <StatCard label="ক্রয়" value={taka(totals.purchase)} onPress={() => router.push("/purchases")} />
          <StatCard label="খরচ" value={taka(totals.expense)} onPress={() => router.push("/expenses")} />
          <StatCard
            label="নিট লাভ"
            value={taka(totals.profit)}
            tone={totals.profit >= 0 ? "success" : "danger"}
            onPress={() => router.push("/analytics")}
          />
          <StatCard label="স্টকের মূল্য" value={taka(totals.stockValue)} onPress={() => router.push("/inventory")} />
        </View>
      </Section>

      <Section title="বাকি ও পাওনা" action={{ label: "সব দেখুন", onPress: () => router.push("/due") }}>
        <View style={styles.grid}>
          <StatCard
            label="মোট পাওনা (ক্রেতা)"
            value={taka(totals.receivable)}
            tone="danger"
            hint="ট্যাপ করে আদায় করুন"
            onPress={() => router.push("/due?tab=receivable")}
          />
          <StatCard
            label="মোট দেনা (সরবরাহকারী)"
            value={taka(totals.payable)}
            tone="warning"
            hint="ট্যাপ করে পরিশোধ করুন"
            onPress={() => router.push("/due?tab=payable")}
          />
        </View>
      </Section>

      {bank.count > 0 && (
        <Section title="🏦 ব্যাংক লেনদেন">
          <View style={styles.grid}>
            <StatCard
              label="ব্যাংকে জমা হয়েছে"
              value={taka(bank.received)}
              tone="success"
              hint={`${bank.count} টি লেনদেন`}
              onPress={() => router.push("/payments/new")}
            />
            <StatCard
              label="ব্যাংক থেকে দেওয়া"
              value={taka(bank.paid)}
              tone="warning"
              onPress={() => router.push("/payments/new")}
            />
          </View>
        </Section>
      )}

      <Pressable style={styles.analyticsLink} onPress={() => router.push("/analytics")}>
        <Text style={styles.analyticsLinkText}>📈 সম্পূর্ণ Analytics ও রিপোর্ট</Text>
        <Text style={styles.analyticsChevron}>›</Text>
      </Pressable>

      {!hasRows && (
        <EmptyState
          icon="📊"
          title="এই সময়ের কোনো হিসাব নেই"
          message="বিক্রয় বা ক্রয় পোস্ট করলে এখানে হিসাব দেখা যাবে।"
          action={{ label: "প্রথম বিক্রয় লিখুন", onPress: () => router.push("/sales/new") }}
        />
      )}

      {hasRows && (
        <Text style={styles.updatedNote}>সর্বশেষ হালনাগাদ: {daysAgoBn(new Date().toISOString())}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  companyName: { fontSize: 21, fontWeight: "800", color: theme.text, letterSpacing: -0.4 },
  companyMeta: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: { fontSize: 17 },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: theme.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  expiryBar: {
    backgroundColor: theme.warningBg,
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  expiryBarUrgent: { backgroundColor: theme.dangerBg, borderColor: "#fecaca" },
  expiryText: { fontSize: 13, fontWeight: "700", color: theme.warning, textAlign: "center" },
  expiryTextUrgent: { color: theme.danger },
  quickRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  quickAction: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 14,
    alignItems: "center",
  },
  quickIcon: { fontSize: 22 },
  quickLabel: { fontSize: 10.5, color: theme.text, marginTop: 5, fontWeight: "600", textAlign: "center" },
  rangeCard: { marginBottom: 18, paddingVertical: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  analyticsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: theme.primary,
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 4,
  },
  analyticsLinkText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  analyticsChevron: { color: "#fff", fontSize: 18 },
  updatedNote: { textAlign: "center", color: theme.textFaint, fontSize: 11, marginTop: 16 },
});
