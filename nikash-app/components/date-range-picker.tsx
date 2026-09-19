import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DateField } from "./date-field";
import { formatDateBn, presetRange, todayIso, type DateRange } from "@/lib/format";

const PRESETS = [
  { key: "today", label: "আজ" },
  { key: "yesterday", label: "গতকাল" },
  { key: "week", label: "৭ দিন" },
  { key: "month", label: "এই মাস" },
  { key: "last_month", label: "গত মাস" },
] as const;

// ড্যাশবোর্ড ও সব তালিকার উপরে বসবে — প্রিসেট চিপ + কাস্টম ক্যালেন্ডার রেঞ্জ।
export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);

  function applyCustom() {
    const [a, b] = from <= to ? [from, to] : [to, from];
    onChange({ from: a, to: b, label: `${formatDateBn(a, true)} – ${formatDateBn(b, true)}` });
    setCustomOpen(false);
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {PRESETS.map((p) => {
          const range = presetRange(p.key);
          const active = value.from === range.from && value.to === range.to;
          return (
            <Pressable
              key={p.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(range)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
        <Pressable style={[styles.chip, styles.chipCustom]} onPress={() => setCustomOpen(true)}>
          <Text style={styles.chipText}>📅 কাস্টম</Text>
        </Pressable>
      </ScrollView>

      <Text style={styles.rangeLabel}>{value.label}</Text>

      <Modal visible={customOpen} transparent animationType="fade" onRequestClose={() => setCustomOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>তারিখ বাছুন</Text>
            <DateField label="শুরু" value={from} onChange={setFrom} maximumDate={new Date()} />
            <DateField label="শেষ" value={to} onChange={setTo} maximumDate={new Date()} />
            <View style={styles.actions}>
              <Pressable style={styles.cancel} onPress={() => setCustomOpen(false)}>
                <Text style={styles.cancelText}>বাতিল</Text>
              </Pressable>
              <Pressable style={styles.confirm} onPress={applyCustom}>
                <Text style={styles.confirmText}>প্রয়োগ করুন</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function defaultRange(): DateRange {
  return presetRange("today");
}

export function monthToDateRange(): DateRange {
  return presetRange("month");
}

export { todayIso };

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  chipCustom: { backgroundColor: "#fff" },
  chipText: { fontSize: 13, color: "#334155", fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  rangeLabel: { fontSize: 12, color: "#64748b", marginTop: 8, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 14 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 4 },
  cancel: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelText: { color: "#64748b", fontWeight: "600" },
  confirm: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#0f172a", borderRadius: 10 },
  confirmText: { color: "#fff", fontWeight: "700" },
});
