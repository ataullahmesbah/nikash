import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import type { PickableUnit } from "@/lib/catalog";
import { theme } from "./ui";

export function ItemPickerModal({
  visible,
  items,
  priceField,
  onSelect,
  onClose,
}: {
  visible: boolean;
  items: PickableUnit[];
  priceField: "sale_price" | "purchase_price";
  onSelect: (item: PickableUnit) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (i) =>
        i.product_name.toLowerCase().includes(needle) ||
        i.variant_name.toLowerCase().includes(needle)
    );
  }, [items, q]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>প্রোডাক্ট বাছাই করুন</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>বন্ধ করুন</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.search}
          placeholder="প্রোডাক্ট খুঁজুন..."
          placeholderTextColor={theme.textFaint}
          value={q}
          onChangeText={setQ}
          autoFocus
        />

        {/* মাল তুলতে গিয়ে দেখা গেল পণ্যটা তালিকায় নেই — তখন যেন এখান
            থেকেই যোগ করা যায়, এন্ট্রি ফেলে অন্য মেনুতে যেতে না হয়। */}
        <Pressable
          style={styles.addNew}
          onPress={() => {
            const name = q.trim();
            onClose();
            setQ("");
            router.push(`/products/new?name=${encodeURIComponent(name)}`);
          }}
        >
          <Text style={styles.addNewText}>
            ＋ নতুন প্রোডাক্ট যোগ করুন{q.trim() ? ` — “${q.trim()}”` : ""}
          </Text>
        </Pressable>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={{ marginTop: 40 }}>
              <Text style={styles.empty}>
                {q.trim() ? `“${q.trim()}” নামে কিছু পাওয়া যায়নি` : "কোনো প্রোডাক্ট নেই"}
              </Text>
              <Text style={styles.emptyHint}>উপরের সবুজ বাটনে চাপ দিয়ে যোগ করে নিন</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => {
                onSelect(item);
                setQ("");
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{item.product_name}</Text>
                <Text style={styles.variantName}>
                  {item.variant_name} · {item.unit_name}
                </Text>
              </View>
              <Text style={styles.price}>৳{item[priceField] ?? "—"}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 56, paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  close: { color: "#dc2626", fontWeight: "600" },
  search: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
   color: theme.text,},
  addNew: {
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: theme.successBg,
    borderWidth: 1,
    borderColor: theme.success,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  addNewText: { color: theme.success, fontWeight: "700", fontSize: 14 },
  emptyHint: { textAlign: "center", color: theme.textFaint, fontSize: 12.5, marginTop: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  productName: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  variantName: { fontSize: 13, color: "#64748b", marginTop: 2 },
  price: { fontSize: 15, fontWeight: "700", color: "#059669" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
});
