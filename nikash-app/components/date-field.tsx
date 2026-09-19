import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { formatDateBn, toIsoDate } from "@/lib/format";

// টেক্সট ফিল্ডে YYYY-MM-DD টাইপ করা মোবাইলে অসম্ভব কষ্টের — সব জায়গায়
// এই কম্পোনেন্ট ব্যবহার হবে। ভ্যালু ISO ("2026-09-18") আকারে যায়-আসে,
// কিন্তু ব্যবহারকারী বাংলা তারিখ দেখে ও ক্যালেন্ডার থেকে বাছে।
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const current = value ? new Date(value) : new Date();

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={styles.value}>{formatDateBn(value)}</Text>
        <Text style={styles.icon}>📅</Text>
      </Pressable>

      {open && (
        <DateTimePicker
          value={Number.isNaN(current.getTime()) ? new Date() : current}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, selected) => {
            // Android-এ dismiss করলেও onChange ডাকে — type দেখে বোঝা লাগে।
            if (Platform.OS === "android") setOpen(false);
            if (event.type === "dismissed") {
              if (Platform.OS === "ios") setOpen(false);
              return;
            }
            if (selected) onChange(toIsoDate(selected));
            if (Platform.OS === "ios") setOpen(false);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 13, color: "#475569", marginBottom: 6, fontWeight: "600" },
  input: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  value: { fontSize: 15, color: "#0f172a" },
  icon: { fontSize: 16 },
});
