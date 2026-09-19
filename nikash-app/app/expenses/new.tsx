import { useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { enqueueWriteAndSync } from "@/lib/offline/sync-queue";
import { todayIso } from "@/lib/format";
import { SkeletonDetail } from "@/components/skeleton";
import { ErrorText, FormField, PrimaryButton, SegmentedControl } from "@/components/form";

type Suggestion = { title: string; use_count: number };
type Category = { id: string; name_bn: string };

// Approval limit (PRD 16.4): Owner never needs approval. Manager/Accountant
// need it only above the company's configured limit. Salesman/Cashier
// always need approval. Storekeeper can't add expenses at all (blocked by
// RLS — see 05_security_and_feature_fixes.sql section 4).
function decideStatus(role: string | undefined, amount: number, limit: number): "approved" | "pending" {
  if (role === "owner") return "approved";
  if (role === "manager" || role === "accountant") return amount <= limit ? "approved" : "pending";
  return "pending";
}

export default function ExpenseFormScreen() {
  // ?editId= থাকলে একই ফর্ম এডিট মোডে চলে
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!editId;
  const { profile } = useAuth();
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidFrom, setPaidFrom] = useState<"cash" | "bkash" | "nagad" | "bank">("cash");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [approvalLimit, setApprovalLimit] = useState(2000);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("expense_categories")
      .select("id, name_bn")
      .eq("company_id", profile.company_id)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setCategories(data ?? []));

    supabase
      .from("company_settings")
      .select("expense_approval_limit")
      .eq("company_id", profile.company_id)
      .maybeSingle()
      .then(({ data }) => setApprovalLimit(data?.expense_approval_limit ?? 2000));
  }, [profile]);

  useEffect(() => {
    if (!profile || title.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      supabase
        .from("expense_titles")
        .select("title, use_count")
        .eq("company_id", profile.company_id)
        .ilike("title", `${title.trim()}%`)
        .order("use_count", { ascending: false })
        .limit(5)
        .then(({ data }) => setSuggestions(data ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [profile, title]);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      const { data, error: loadErr } = await supabase
        .from("expenses")
        .select("title, amount, entry_date, paid_from, category_id")
        .eq("id", editId)
        .maybeSingle();
      if (cancelled) return;
      if (loadErr || !data) {
        toast.error("খরচটি পাওয়া যায়নি");
        router.back();
        return;
      }
      setTitle(data.title ?? "");
      setAmount(String(data.amount ?? ""));
      setEntryDate(data.entry_date ?? todayIso());
      if (data.paid_from) setPaidFrom(data.paid_from);
      setCategoryId(data.category_id ?? null);
      setLoadingExisting(false);
    })();
    return () => { cancelled = true; };
  }, [editId, toast]);

  async function handleSave() {
    if (!profile) return;
    if (!title.trim() || !amount || Number(amount) <= 0) {
      setError("কী খরচ ও কত টাকা — দুটোই দিন");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const status = decideStatus(profile.role, Number(amount), approvalLimit);

      // Offline-first (PRD 18): this writes to the local sync queue and
      // returns immediately — it does NOT wait for the network. The queue
      // pushes it to Supabase in the background, using the same uuid so a
      // retry never creates a duplicate row.
      const fields = {
        category_id: categoryId,
        title: title.trim(),
        amount: Number(amount),
        entry_date: entryDate,
        paid_from: paidFrom,
      };

      if (isEdit) {
        const { error: updErr } = await supabase.from("expenses").update(fields).eq("id", editId);
        if (updErr) throw updErr;
        await supabase.rpc("log_entity_change", {
          p_entity_type: "expense",
          p_entity_id: editId,
          p_action: "update",
          p_new: fields,
        });
        toast.success("খরচ হালনাগাদ হয়েছে");
        router.back();
        return;
      }

      await enqueueWriteAndSync("expenses", "insert", {
        id: Crypto.randomUUID(),
        company_id: profile.company_id,
        ...fields,
        status,
        created_by: profile.id,
      });

      if (status === "pending") {
        toast.warning("খরচ যোগ হয়েছে — অনুমোদনের অপেক্ষায়");
      } else {
        toast.success("খরচ যোগ হয়েছে (sync হচ্ছে)");
      }
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : "সংরক্ষণ ব্যর্থ হয়েছে";
      setError(message);
      toast.error(message.length > 60 ? "সংরক্ষণ ব্যর্থ, আবার চেষ্টা করুন" : message);
    } finally {
      setLoading(false);
    }
  }

  if (loadingExisting) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Stack.Screen options={{ title: "খরচ সম্পাদনা", headerShown: true }} />
        <SkeletonDetail />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: isEdit ? "খরচ সম্পাদনা" : "নতুন খরচ", headerShown: true }} />

      <FormField label="কী খরচ? *" value={title} onChangeText={setTitle} placeholder="যেমন: কুলির মজুরি" />
      {suggestions.length > 0 && (
        <View style={{ marginTop: -8, marginBottom: 12 }}>
          {suggestions.map((s) => (
            <Pressable key={s.title} onPress={() => setTitle(s.title)} style={{ paddingVertical: 6 }}>
              <Text style={{ color: "#059669", fontSize: 13 }}>
                💡 {s.title} ({s.use_count} বার)
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <FormField label="কত টাকা? *" value={amount} onChangeText={setAmount} keyboardType="numeric" />
      <FormField label="তারিখ (YYYY-MM-DD)" value={entryDate} onChangeText={setEntryDate} />

      <SegmentedControl
        value={paidFrom}
        onChange={setPaidFrom}
        options={[
          { label: "নগদ", value: "cash" },
          { label: "bKash", value: "bkash" },
          { label: "Nagad", value: "nagad" },
          { label: "ব্যাংক", value: "bank" },
        ]}
      />

      {categories.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, color: "#475569", marginBottom: 6, fontWeight: "600" }}>
            ক্যাটাগরি (ঐচ্ছিক)
          </Text>
          <FlatList
            horizontal
            data={categories}
            keyExtractor={(c) => c.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setCategoryId(categoryId === item.id ? null : item.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: categoryId === item.id ? "#0f172a" : "#f1f5f9",
                  marginRight: 8,
                }}
              >
                <Text style={{ color: categoryId === item.id ? "#fff" : "#334155", fontSize: 13 }}>
                  {item.name_bn}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}

      <ErrorText>{error}</ErrorText>
      <PrimaryButton title="সংরক্ষণ করুন" onPress={handleSave} loading={loading} tone="success" />
    </ScrollView>
  );
}
