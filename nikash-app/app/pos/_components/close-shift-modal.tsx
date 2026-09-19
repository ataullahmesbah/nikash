import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import type { ActiveShift } from "../index";

export default function CloseShiftModal({
  visible,
  shift,
  onClose,
  onClosed,
}: {
  visible: boolean;
  shift: ActiveShift;
  onClose: () => void;
  onClosed: () => void;
}) {
  const { profile } = useAuth();
  const toast = useToast();
  const [expected, setExpected] = useState<number | null>(null);
  const [actualCash, setActualCash] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !profile) return;
    (async () => {
      const [collectionsRes, expensesRes] = await Promise.all([
        supabase
          .from("payments")
          .select("amount")
          .eq("company_id", profile.company_id)
          .eq("type", "customer_collection")
          .eq("method", "cash")
          .gte("created_at", shift.opened_at),
        supabase
          .from("expenses")
          .select("amount")
          .eq("company_id", profile.company_id)
          .eq("paid_from", "cash")
          .eq("status", "approved")
          .gte("created_at", shift.opened_at),
      ]);
      const collected = (collectionsRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const spent = (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      setExpected(Number(shift.opening_cash) + collected - spent);
    })();
  }, [visible, profile, shift]);

  async function handleClose() {
    if (!actualCash) return;
    setLoading(true);
    const { error } = await supabase
      .from("pos_shifts")
      .update({
        closed_at: new Date().toISOString(),
        expected_cash: expected,
        actual_cash: Number(actualCash),
        difference: Number(actualCash) - (expected ?? 0),
      })
      .eq("id", shift.id);
    setLoading(false);
    if (error) {
      toast.error("শিফট বন্ধ করা যায়নি");
      return;
    }
    toast.success("শিফট বন্ধ হয়েছে");
    onClosed();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>শিফট শেষ করুন</Text>

          <Text style={styles.label}>ড্রয়ারে থাকার কথা</Text>
          <Text style={styles.expected}>{expected === null ? "গণনা হচ্ছে..." : `৳${expected.toFixed(0)}`}</Text>

          <Text style={styles.label}>আসলে কত টাকা আছে গুনে দেখুন</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={actualCash}
            onChangeText={setActualCash}
            autoFocus
          />

          {actualCash !== "" && expected !== null && (
            <Text
              style={[
                styles.diff,
                { color: Number(actualCash) - expected === 0 ? "#059669" : "#dc2626" },
              ]}
            >
              পার্থক্য: ৳{(Number(actualCash) - expected).toFixed(0)}
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>বাতিল</Text>
            </Pressable>
            <Pressable style={styles.confirm} onPress={handleClose} disabled={loading || !actualCash}>
              <Text style={styles.confirmText}>{loading ? "..." : "শিফট বন্ধ করুন"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  title: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 16 },
  label: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  expected: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  diff: { fontSize: 14, fontWeight: "700", marginBottom: 12 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8 },
  cancel: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelText: { color: "#64748b", fontWeight: "600" },
  confirm: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#0f172a", borderRadius: 10 },
  confirmText: { color: "#fff", fontWeight: "700" },
});
