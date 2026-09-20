import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { errorMessage, toastMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { ErrorText, FormField, PrimaryButton, SegmentedControl } from "@/components/form";
import { DateField } from "@/components/date-field";
import { todayIso } from "@/lib/format";
import { PartyPickerModal, type PickableParty } from "@/components/party-picker-modal";
import { BD_BANKS, PAYMENT_PURPOSES } from "@/lib/banks";
import { theme } from "@/components/ui";
import { SkeletonDetail } from "@/components/skeleton";

type PaymentType = "customer_collection" | "supplier_payment";
type Method = "cash" | "bkash" | "nagad" | "bank" | "cheque";

export default function NewPaymentScreen() {
  // বাকির হিসাব স্ক্রিন থেকে "আদায়" চাপলে পার্টি ও পরিমাণ প্রি-ফিল হয়ে আসে।
  const preset = useLocalSearchParams<{
    partyId?: string; partyName?: string; type?: string; suggested?: string;
    editId?: string;
  }>();
  const editId = preset.editId;
  const isEdit = !!editId;
  const { profile } = useAuth();
  const toast = useToast();
  const [type, setType] = useState<PaymentType>(
    preset.type === "supplier_payment" ? "supplier_payment" : "customer_collection"
  );
  const [party, setParty] = useState<PickableParty | null>(
    preset.partyId ? { id: preset.partyId, name: preset.partyName ?? "", phone: null } : null
  );
  const [parties, setParties] = useState<PickableParty[]>([]);
  const [amount, setAmount] = useState(preset.suggested ?? "");
  const [method, setMethod] = useState<Method>("cash");
  const [entryDate, setEntryDate] = useState(todayIso());
  const [chequeDate, setChequeDate] = useState("");
  // ব্যাংক/চেকের বাড়তি তথ্য — সব ঐচ্ছিক, কিন্তু থাকলে পরে হিসাব মেলানো সহজ
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [slipNo, setSlipNo] = useState("");
  const [purpose, setPurpose] = useState<string>("due");
  const [purposeNote, setPurposeNote] = useState("");
  const [showBankList, setShowBankList] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!preset.editId);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    if (!preset.partyId && !editId) setParty(null);
    supabase
      .from("parties")
      .select("id, name, phone")
      .eq("company_id", profile.company_id)
      .eq("type", type === "customer_collection" ? "customer" : "supplier")
      // status ফিল্টার ইচ্ছে করেই নেই — কাজ বন্ধ করা পার্টির পুরনো বাকিও
      // আদায় করতে হয়, নইলে টাকা তোলার কোনো পথ থাকে না।
      .then(({ data }) => setParties(data ?? []));
  }, [profile, type]);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      const { data, error: loadErr } = await supabase
        .from("payments")
        .select(
          "type, amount, method, entry_date, cheque_date, bank_name, bank_branch, account_no, slip_no, purpose, purpose_note, party_id, parties:party_id(id, name, phone)"
        )
        .eq("id", editId)
        .maybeSingle();
      if (cancelled) return;
      if (loadErr || !data) {
        toast.error("পেমেন্টটি পাওয়া যায়নি");
        router.back();
        return;
      }
      const row = data as unknown as {
        type: PaymentType; amount: number; method: Method; entry_date: string;
        cheque_date: string | null; bank_name: string | null; bank_branch: string | null;
        account_no: string | null; slip_no: string | null; purpose: string | null;
        purpose_note: string | null;
        parties: { id: string; name: string; phone: string | null } | null;
      };
      setType(row.type);
      setAmount(String(row.amount ?? ""));
      setMethod(row.method);
      setEntryDate(row.entry_date);
      setChequeDate(row.cheque_date ?? "");
      setBankName(row.bank_name ?? "");
      setBankBranch(row.bank_branch ?? "");
      setAccountNo(row.account_no ?? "");
      setSlipNo(row.slip_no ?? "");
      setPurpose(row.purpose ?? "due");
      setPurposeNote(row.purpose_note ?? "");
      if (row.parties) setParty({ id: row.parties.id, name: row.parties.name, phone: row.parties.phone });
      setLoadingExisting(false);
    })();
    return () => { cancelled = true; };
  }, [editId, toast]);

  // ব্যাংক ও চেক — দুটোতেই ব্যাংকের তথ্য লাগে
  const isBankish = method === "bank" || method === "cheque";

  async function handleSave() {
    if (!profile) return;
    if (!party) {
      setError("পার্টি বাছাই করুন");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("সঠিক টাকার পরিমাণ দিন");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (isEdit) {
        // অঙ্ক বদলালে আগের বরাদ্দ ফিরিয়ে নিয়ে নতুন করে বসে — সার্ভারেই,
        // এক ট্রানজ্যাকশনে, যাতে বাকির হিসাব কখনো আধাখেঁচড়া না থাকে।
        const { error: updErr } = await supabase.rpc("update_payment", {
          p_payment: editId,
          p_amount: Number(amount),
          p_method: method,
          p_entry_date: entryDate,
          p_bank_name: isBankish ? bankName.trim() || null : null,
          p_bank_branch: isBankish ? bankBranch.trim() || null : null,
          p_account_no: isBankish ? accountNo.trim() || null : null,
          p_slip_no: slipNo.trim() || null,
          p_purpose: purpose,
          p_note: purposeNote.trim() || null,
          p_cheque_date: method === "cheque" ? chequeDate || null : null,
        });
        if (updErr) throw updErr;
        toast.success("পেমেন্ট হালনাগাদ হয়েছে");
        router.back();
        return;
      }

      const paymentId = Crypto.randomUUID();
      const { error: payErr } = await supabase.from("payments").insert({
        id: paymentId,
        company_id: profile.company_id,
        type,
        party_id: party.id,
        amount: Number(amount),
        method,
        entry_date: entryDate,
        cheque_date: method === "cheque" ? chequeDate || null : null,
        bank_name: isBankish ? bankName.trim() || null : null,
        bank_branch: isBankish ? bankBranch.trim() || null : null,
        account_no: isBankish ? accountNo.trim() || null : null,
        slip_no: slipNo.trim() || null,
        purpose,
        purpose_note: purposeNote.trim() || null,
        received_by: profile.id,
        status: "posted",
      });
      if (payErr) throw payErr;

      const { error: allocErr } = await supabase.rpc("allocate_payment", { p_payment: paymentId });
      if (allocErr) throw allocErr;

      toast.success("পেমেন্ট সংরক্ষিত হয়েছে");
      router.back();
    } catch (e) {
      const message = errorMessage(e, "সংরক্ষণ ব্যর্থ হয়েছে");
      setError(message);
      toast.error(toastMessage(e, "সংরক্ষণ ব্যর্থ হয়েছে"));
    } finally {
      setLoading(false);
    }
  }

  if (loadingExisting) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Stack.Screen options={{ title: "পেমেন্ট সম্পাদনা", headerShown: true }} />
        <SkeletonDetail />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: isEdit ? "পেমেন্ট সম্পাদনা" : "নতুন পেমেন্ট", headerShown: true }} />

      {isEdit ? (
        <View style={st.lockBox}>
          <Text style={st.lockTitle}>
            {type === "customer_collection" ? "↓ আদায়" : "↑ পরিশোধ"} · {party?.name ?? "—"}
          </Text>
          <Text style={st.lockHint}>
            ধরন ও পার্টি বদলানো যায় না। ভুল পার্টিতে বসে গেলে এটি বাতিল করে নতুন এন্ট্রি দিন।
          </Text>
        </View>
      ) : (
        <>
          <SegmentedControl
            value={type}
            onChange={setType}
            options={[
              { label: "টাকা আদায় (ক্রেতা থেকে)", value: "customer_collection" },
              { label: "পেমেন্ট (সরবরাহকারীকে)", value: "supplier_payment" },
            ]}
          />

          <View style={{ marginBottom: 16 }}>
            <PrimaryButton
              title={party ? party.name : "পার্টি বাছাই করুন"}
              onPress={() => setShowPicker(true)}
            />
          </View>
        </>
      )}

      <FormField label="টাকার পরিমাণ *" value={amount} onChangeText={setAmount} keyboardType="numeric" />

      <DateField label="তারিখ" value={entryDate} onChange={setEntryDate} maximumDate={new Date()} />

      <SegmentedControl
        value={method}
        onChange={setMethod}
        options={[
          { label: "নগদ", value: "cash" },
          { label: "bKash", value: "bkash" },
          { label: "Nagad", value: "nagad" },
        ]}
      />
      <SegmentedControl
        value={method}
        onChange={setMethod}
        options={[
          { label: "ব্যাংক", value: "bank" },
          { label: "চেক", value: "cheque" },
        ]}
      />
      {method === "cheque" && (
        <DateField label="চেকের তারিখ" value={chequeDate || entryDate} onChange={setChequeDate} />
      )}

      {isBankish && (
        <View style={st.bankBox}>
          <Text style={st.bankTitle}>🏦 ব্যাংকের তথ্য</Text>
          <Text style={st.bankHint}>
            সব ঘর ঐচ্ছিক — তবে ভরে রাখলে পরে ব্যাংক স্টেটমেন্টের সাথে মিলিয়ে নিতে সুবিধা।
          </Text>

          <Text style={st.label}>ব্যাংকের নাম</Text>
          <Pressable style={st.picker} onPress={() => setShowBankList((v) => !v)}>
            <Text style={bankName ? st.pickerValue : st.pickerPlaceholder}>
              {bankName || "তালিকা থেকে বেছে নিন"}
            </Text>
            <Text style={st.pickerArrow}>{showBankList ? "▲" : "▼"}</Text>
          </Pressable>

          {showBankList && (
            <ScrollView style={st.bankList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {BD_BANKS.map((b) => (
                <Pressable
                  key={b}
                  style={st.bankRow}
                  onPress={() => {
                    setBankName(b);
                    setShowBankList(false);
                  }}
                >
                  <Text style={st.bankRowText}>{b}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <FormField
            label="ব্যাংকের নাম (তালিকায় না থাকলে নিজে লিখুন)"
            value={bankName}
            onChangeText={setBankName}
          />
          <FormField label="শাখা" value={bankBranch} onChangeText={setBankBranch} placeholder="যেমন: মিরপুর শাখা" />
          <FormField label="অ্যাকাউন্ট নম্বর" value={accountNo} onChangeText={setAccountNo} />
        </View>
      )}

      <FormField
        label="জমা স্লিপ / রসিদ নম্বর"
        value={slipNo}
        onChangeText={setSlipNo}
        placeholder="ঐচ্ছিক"
      />

      <Text style={st.label}>কী বাবদ টাকা</Text>
      <View style={st.chipRow}>
        {PAYMENT_PURPOSES.map((pp) => (
          <Pressable
            key={pp.value}
            style={[st.chip, purpose === pp.value && st.chipOn]}
            onPress={() => setPurpose(pp.value)}
          >
            <Text style={[st.chipText, purpose === pp.value && st.chipTextOn]}>{pp.label}</Text>
          </Pressable>
        ))}
      </View>

      <FormField
        label="বিস্তারিত (কোন পণ্য / কোন বিলের জন্য)"
        value={purposeNote}
        onChangeText={setPurposeNote}
        placeholder="ঐচ্ছিক — যেমন: মার্চ মাসের তেলের বিল"
      />

      <ErrorText>{error}</ErrorText>
      <PrimaryButton
        title={isEdit ? "পরিবর্তন সংরক্ষণ করুন" : "সংরক্ষণ করুন"}
        onPress={handleSave}
        loading={loading}
        tone="success"
      />

      <PartyPickerModal
        visible={showPicker}
        items={parties}
        onSelect={(p) => {
          setParty(p);
          setShowPicker(false);
        }}
        onClose={() => setShowPicker(false)}
      />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  lockBox: {
    backgroundColor: theme.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  lockTitle: { fontSize: 15, fontWeight: "700", color: theme.text },
  lockHint: { fontSize: 11.5, color: theme.textMuted, marginTop: 5, lineHeight: 17 },
  bankBox: {
    backgroundColor: theme.infoBg,
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  bankTitle: { fontSize: 14.5, fontWeight: "700", color: theme.text },
  bankHint: { fontSize: 11.5, color: theme.textMuted, marginTop: 5, marginBottom: 12, lineHeight: 17 },
  label: { fontSize: 12.5, color: theme.textMuted, fontWeight: "600", marginBottom: 6 },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerValue: { fontSize: 14, color: theme.text, fontWeight: "600", flex: 1 },
  pickerPlaceholder: { fontSize: 14, color: theme.textFaint, flex: 1 },
  pickerArrow: { fontSize: 11, color: theme.textMuted },
  bankList: {
    maxHeight: 220,
    marginTop: 6,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  bankRow: { paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  bankRowText: { fontSize: 13.5, color: theme.text },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipOn: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.textMuted },
  chipTextOn: { color: "#fff" },
});
