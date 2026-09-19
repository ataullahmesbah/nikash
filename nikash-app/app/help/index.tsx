import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Card, Section, theme } from "@/components/ui";
import { MENU_GUIDES } from "@/lib/user-guide";

type Support = { phone?: string; whatsapp?: string; email?: string; hours?: string };

const FAQ = [
  {
    q: "ইন্টারনেট ছাড়া কি অ্যাপ চলবে?",
    a: "হ্যাঁ। খরচ, পার্টি, প্রোডাক্ট ও স্টক সমন্বয় ইন্টারনেট ছাড়াই লেখা যায় — নেট এলে নিজে থেকেই সিঙ্ক হয়ে যায়। বিক্রয়/ক্রয় পোস্ট করতে ইন্টারনেট লাগে।",
  },
  {
    q: "ভুল করে বিক্রয় লিখে ফেললে কী করব?",
    a: "চালানে গিয়ে '✏️ সম্পাদনা করুন' চাপুন। পোস্ট করা চালান হলে কারণ লিখতে হবে — স্টক ফেরত নিয়ে চালান আবার সম্পাদনার জন্য খুলে যাবে।",
  },
  {
    q: "কে কত বাকি রেখেছে কোথায় দেখব?",
    a: "ড্যাশবোর্ড থেকে 'বাকির হিসাব' চাপুন। পার্টি অনুযায়ী মোট বাকি, কত পুরনো, আর সরাসরি WhatsApp রিমাইন্ডার পাঠানোর সুবিধা আছে।",
  },
  {
    q: "বাকি আদায় করলে হিসাব কীভাবে আপডেট হবে?",
    a: "বাকির হিসাব থেকে '💰 আদায়' চাপুন — টাকা সবচেয়ে পুরনো চালান থেকে স্বয়ংক্রিয়ভাবে সমন্বয় হবে এবং তালিকা থেকে সরে যাবে।",
  },
  {
    q: "সাবস্ক্রিপশনের মেয়াদ শেষ হলে কী হবে?",
    a: "কয়েক দিন গ্রেস পিরিয়ড পাবেন। এরপর অ্যাপ শুধু-দেখার মোডে চলে যাবে — ডেটা মুছবে না, নবায়ন করলেই আবার সব চালু হবে।",
  },
  {
    q: "ডেটা হারিয়ে যাওয়ার ভয় আছে?",
    a: "না। সব ডেটা সার্ভারে সংরক্ষিত থাকে, আর প্রতিদিন ফোনে একটা ব্যাকআপ ফাইলও তৈরি হয় — 'আরও → ব্যাকআপ' থেকে শেয়ার করা যায়।",
  },
];

const GUIDE = [
  { icon: "১️⃣", title: "পার্টি যোগ করুন", body: "পার্টি ট্যাব → '+ নতুন পার্টি' — ক্রেতা ও সরবরাহকারী দুটোই এখানে।" },
  { icon: "২️⃣", title: "প্রোডাক্ট যোগ করুন", body: "আরও → প্রোডাক্ট তালিকা → '+ নতুন প্রোডাক্ট' — ইউনিট ও দাম দিন।" },
  { icon: "৩️⃣", title: "ক্রয় লিখুন", body: "ড্যাশবোর্ড → নতুন ক্রয় — স্টক বেড়ে যাবে।" },
  { icon: "৪️⃣", title: "বিক্রয় লিখুন", body: "ড্যাশবোর্ড → নতুন বিক্রয় — স্টক কমবে, লাভ হিসাব হবে।" },
  { icon: "৫️⃣", title: "বাকি আদায় করুন", body: "বাকির হিসাব → আদায় — পাওনা কমে যাবে।" },
];

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const bnNum = (n: number) => String(n).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

export default function HelpScreen() {
  const [support, setSupport] = useState<Support>({});
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openGuide, setOpenGuide] = useState<number | null>(null);
  const [guideSearch, setGuideSearch] = useState("");

  // মেনুর নাম বা কাজ — যেকোনোটা দিয়ে খোঁজা যায়, যাতে ১৫টা কার্ড
  // ঘাঁটতে না হয়।
  const q = guideSearch.trim().toLowerCase();
  const guides = q
    ? MENU_GUIDES.filter(
        (g) =>
          g.menu.toLowerCase().includes(q) ||
          g.purpose.toLowerCase().includes(q) ||
          g.where.toLowerCase().includes(q) ||
          g.steps.some((st) => st.toLowerCase().includes(q))
      )
    : MENU_GUIDES;

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "public.support")
      .maybeSingle()
      .then(({ data }) => setSupport((data?.value as Support) ?? {}));
  }, []);

  const call = (n?: string) => n && Linking.openURL(`tel:${n}`).catch(() => {});
  const wa = (n?: string) =>
    n && Linking.openURL(`whatsapp://send?phone=${n.replace(/[^0-9]/g, "")}`).catch(() => {});
  const mail = (e?: string) => e && Linking.openURL(`mailto:${e}`).catch(() => {});

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: "সাহায্য ও যোগাযোগ", headerShown: true }} />

      <Section title="যোগাযোগ করুন">
        <View style={{ gap: 10 }}>
          <Pressable style={styles.contact} onPress={() => call(support.phone)}>
            <Text style={styles.contactIcon}>📞</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>হটলাইন</Text>
              <Text style={styles.contactValue}>{support.phone ?? "—"}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>

          <Pressable style={styles.contact} onPress={() => wa(support.whatsapp)}>
            <Text style={styles.contactIcon}>💬</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>WhatsApp</Text>
              <Text style={styles.contactValue}>{support.whatsapp ?? "—"}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>

          <Pressable style={styles.contact} onPress={() => mail(support.email)}>
            <Text style={styles.contactIcon}>✉️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>ইমেইল</Text>
              <Text style={styles.contactValue}>{support.email ?? "—"}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        </View>
        {support.hours ? <Text style={styles.hours}>🕐 {support.hours}</Text> : null}
      </Section>

      <Section title="শুরু করার নির্দেশিকা">
        <Card>
          {GUIDE.map((g, i) => (
            <View key={g.title} style={[styles.guideRow, i === GUIDE.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.guideIcon}>{g.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.guideTitle}>{g.title}</Text>
                <Text style={styles.guideBody}>{g.body}</Text>
              </View>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="মেনু অনুযায়ী নির্দেশিকা">
        <TextInput
          value={guideSearch}
          onChangeText={(t) => {
            setGuideSearch(t);
            setOpenGuide(null);
          }}
          placeholder="🔍 মেনু খুঁজুন — যেমন: ক্রয়, বাকি, খরচ"
          placeholderTextColor={theme.textFaint}
          style={styles.search}
        />

        <View style={{ gap: 8 }}>
          {guides.map((g) => {
            const idx = MENU_GUIDES.indexOf(g);
            const open = openGuide === idx;
            return (
              <Pressable
                key={g.menu}
                style={[styles.mg, open && styles.mgOpen]}
                onPress={() => setOpenGuide(open ? null : idx)}
              >
                <View style={styles.mgHead}>
                  <Text style={styles.mgIcon}>{g.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mgMenu}>{g.menu}</Text>
                    <Text style={styles.mgPurpose} numberOfLines={open ? undefined : 2}>
                      {g.purpose}
                    </Text>
                  </View>
                  <Text style={styles.mgToggle}>{open ? "−" : "+"}</Text>
                </View>

                {open && (
                  <View style={styles.mgBody}>
                    <View style={styles.mgWhere}>
                      <Text style={styles.mgWhereLabel}>কোথায় পাবেন</Text>
                      <Text style={styles.mgWhereValue}>{g.where}</Text>
                    </View>

                    {g.steps.map((st, si) => (
                      <View key={si} style={styles.mgStep}>
                        <View style={styles.mgStepNo}>
                          <Text style={styles.mgStepNoText}>{bnNum(si + 1)}</Text>
                        </View>
                        <Text style={styles.mgStepText}>{st}</Text>
                      </View>
                    ))}

                    {g.tips?.length ? (
                      <View style={styles.mgTips}>
                        {g.tips.map((t, ti) => (
                          <Text key={ti} style={styles.mgTip}>
                            💡 {t}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                )}
              </Pressable>
            );
          })}

          {guides.length === 0 && (
            <Text style={styles.mgEmpty}>এই নামে কোনো মেনু পাওয়া যায়নি</Text>
          )}
        </View>
      </Section>

      <Section title="সাধারণ প্রশ্ন">
        <View style={{ gap: 8 }}>
          {FAQ.map((f, i) => (
            <Pressable key={f.q} style={styles.faq} onPress={() => setOpenFaq(openFaq === i ? null : i)}>
              <View style={styles.faqHead}>
                <Text style={styles.faqQ}>{f.q}</Text>
                <Text style={styles.faqToggle}>{openFaq === i ? "−" : "+"}</Text>
              </View>
              {openFaq === i && <Text style={styles.faqA}>{f.a}</Text>}
            </Pressable>
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
  },
  contactIcon: { fontSize: 20 },
  contactLabel: { fontSize: 12, color: theme.textMuted },
  contactValue: { fontSize: 15, fontWeight: "700", color: theme.text, marginTop: 2 },
  chev: { fontSize: 20, color: theme.textFaint },
  hours: { fontSize: 12, color: theme.textMuted, marginTop: 10, textAlign: "center" },
  guideRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  guideIcon: { fontSize: 18 },
  guideTitle: { fontSize: 14, fontWeight: "700", color: theme.text },
  guideBody: { fontSize: 12.5, color: theme.textMuted, marginTop: 3, lineHeight: 18 },
  search: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: theme.text,
    marginBottom: 10,
  },
  mg: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
  },
  mgOpen: { borderColor: theme.primary },
  mgHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  mgIcon: { fontSize: 20, marginTop: 1 },
  mgMenu: { fontSize: 14.5, fontWeight: "700", color: theme.text },
  mgPurpose: { fontSize: 12.5, color: theme.textMuted, marginTop: 3, lineHeight: 18 },
  mgToggle: { fontSize: 20, color: theme.textMuted, fontWeight: "700" },
  mgBody: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 12, gap: 9 },
  mgWhere: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.bg,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  mgWhereLabel: { fontSize: 11, color: theme.textMuted },
  mgWhereValue: { flex: 1, fontSize: 12.5, fontWeight: "700", color: theme.text },
  mgStep: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  mgStepNo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  mgStepNoText: { fontSize: 11, fontWeight: "700", color: theme.textMuted },
  mgStepText: { flex: 1, fontSize: 13, color: theme.text, lineHeight: 20 },
  mgTips: { marginTop: 3, gap: 6 },
  mgTip: {
    fontSize: 12.5,
    color: theme.textMuted,
    lineHeight: 19,
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    padding: 10,
  },
  mgEmpty: { fontSize: 13, color: theme.textMuted, textAlign: "center", paddingVertical: 20 },
  faq: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14 },
  faqHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: "600", color: theme.text },
  faqToggle: { fontSize: 20, color: theme.textMuted, fontWeight: "700" },
  faqA: { fontSize: 13, color: theme.textMuted, marginTop: 10, lineHeight: 20 },
});
