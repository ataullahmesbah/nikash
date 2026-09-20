import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "./ui";

export type CartLine = {
  key: string;
  variantId: string;
  variantUnitId: string;
  factorToBase: number;
  productName: string;
  variantName: string;
  unitName: string;
  qty: string;
  unitPrice: string;
  // Only set on purchase lines for track_expiry variants (see
  // app/purchases/new.tsx + components/batch-entry-modal.tsx).
  batchNo?: string;
  expiryDate?: string;
};

export function CartLineRow({
  line,
  onChange,
  onRemove,
}: {
  line: CartLine;
  onChange: (patch: Partial<CartLine>) => void;
  onRemove: () => void;
}) {
  const total = (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);

  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{line.productName}</Text>
          <Text style={styles.meta}>
            {line.variantName} · {line.unitName}
          </Text>
          {line.batchNo && (
            <Text style={styles.batch}>
              ব্যাচ: {line.batchNo} {line.expiryDate ? `· মেয়াদ: ${line.expiryDate}` : ""}
            </Text>
          )}
        </View>
        <Pressable onPress={onRemove}>
          <Text style={styles.remove}>সরান</Text>
        </Pressable>
      </View>

      <View style={styles.inputs}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>পরিমাণ</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={line.qty}
            onChangeText={(v) => onChange({ qty: v })}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>দাম/একক</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={line.unitPrice}
            onChangeText={(v) => onChange({ unitPrice: v })}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>মোট</Text>
          <Text style={styles.totalValue}>৳{total.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
  },
  top: { flexDirection: "row", alignItems: "flex-start" },
  name: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  batch: { fontSize: 11, color: "#d97706", marginTop: 2, fontWeight: "600" },
  remove: { color: "#dc2626", fontSize: 12, fontWeight: "600" },
  inputs: { flexDirection: "row", gap: 8, marginTop: 10 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 11, color: "#94a3b8", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 13,
   color: theme.text,},
  totalValue: { fontSize: 14, fontWeight: "700", color: "#059669", paddingVertical: 8 },
});
