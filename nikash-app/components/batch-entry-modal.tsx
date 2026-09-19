import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DateField } from "./date-field";
import { theme } from "./ui";

// মেয়াদ ট্র্যাক করা পণ্য ক্রয়ে যোগ করার সময় ব্যাচ তথ্য চাওয়া হয়।
//
// আগে এখানে "বাদ দিন" চাপলে পুরো পণ্যটাই কার্টে যোগ হতো না — দোকানির মনে
// হতো অ্যাপ আটকে দিচ্ছে। এখন তিনটা স্পষ্ট পথ: ব্যাচসহ যোগ, ব্যাচ ছাড়াই যোগ,
// অথবা পণ্যটাই বাদ। ব্যাচ তথ্য সবসময় ঐচ্ছিক।
export function BatchEntryModal({
  visible,
  productName,
  onSubmit,
  onSkip,
  onCancel,
}: {
  visible: boolean;
  productName: string;
  onSubmit: (batchNo: string, expiryDate: string) => void;
  /** ব্যাচ তথ্য ছাড়াই পণ্যটি কার্টে যোগ করবে */
  onSkip: () => void;
  /** পণ্যটি একেবারেই যোগ করবে না */
  onCancel: () => void;
}) {
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  function reset() {
    setBatchNo("");
    setExpiryDate("");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{productName}</Text>
          <Text style={styles.hint}>
            এই পণ্যের মেয়াদ ট্র্যাক করা হয়। তথ্য দিলে মেয়াদ শেষের আগে সতর্কবার্তা
            পাবেন — না দিলেও সমস্যা নেই, পরে যোগ করা যাবে।
          </Text>

          <Text style={styles.label}>ব্যাচ / লট নম্বর (ঐচ্ছিক)</Text>
          <TextInput
            style={styles.input}
            value={batchNo}
            onChangeText={setBatchNo}
            placeholder="প্যাকেটের গায়ে যা লেখা"
          />

          <Text style={styles.label}>মেয়াদ শেষের তারিখ (ঐচ্ছিক)</Text>
          <DateField
            label=""
            value={expiryDate}
            onChange={setExpiryDate}
            minimumDate={new Date()}
          />

          <Pressable
            style={styles.primary}
            onPress={() => {
              onSubmit(batchNo.trim(), expiryDate.trim());
              reset();
            }}
          >
            <Text style={styles.primaryText}>যোগ করুন</Text>
          </Pressable>

          <Pressable
            style={styles.secondary}
            onPress={() => {
              onSkip();
              reset();
            }}
          >
            <Text style={styles.secondaryText}>ব্যাচ তথ্য ছাড়াই যোগ করুন</Text>
          </Pressable>

          <Pressable
            style={styles.cancel}
            onPress={() => {
              onCancel();
              reset();
            }}
          >
            <Text style={styles.cancelText}>এই পণ্যটি বাদ দিন</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center", padding: 20 },
  card: { backgroundColor: theme.surface, borderRadius: 18, padding: 20 },
  title: { fontSize: 16, fontWeight: "800", color: theme.text },
  hint: { fontSize: 12.5, color: theme.textMuted, marginTop: 6, marginBottom: 16, lineHeight: 18 },
  label: { fontSize: 12, color: theme.textMuted, marginBottom: 5, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 14,
    fontSize: 14,
    color: theme.text,
  },
  primary: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 14.5 },
  secondary: {
    backgroundColor: theme.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryText: { color: theme.text, fontWeight: "600", fontSize: 13.5 },
  cancel: { paddingVertical: 12, alignItems: "center", marginTop: 4 },
  cancelText: { color: theme.danger, fontWeight: "600", fontSize: 13 },
});
