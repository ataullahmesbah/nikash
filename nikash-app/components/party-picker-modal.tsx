import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { theme } from "./ui";

export type PickableParty = { id: string; name: string; phone: string | null };

export function PartyPickerModal({
  visible,
  items,
  onSelect,
  onClose,
  /** "customer" হলে নতুন যোগ করার ফর্ম ক্রেতা হিসেবে খুলবে */
  partyType = "customer",
  title = "পার্টি বাছাই করুন",
}: {
  visible: boolean;
  items: PickableParty[];
  onSelect: (item: PickableParty) => void;
  onClose: () => void;
  partyType?: "customer" | "supplier";
  title?: string;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(needle) || (i.phone ?? "").includes(needle)
    );
  }, [items, q]);

  const label = partyType === "supplier" ? "সরবরাহকারী" : "ক্রেতা / দোকান";

  // বিক্রি করতে গিয়ে দেখা গেল দোকানটা তালিকায় নেই — তখন যেন এখান থেকেই
  // যোগ করা যায়, আলাদা মেনুতে ঘুরে আসতে না হয়।
  function addNew() {
    onClose();
    setQ("");
    router.push(`/parties/new?type=${partyType}&name=${encodeURIComponent(q.trim())}`);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>বন্ধ করুন</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.search}
          placeholder="নাম বা ফোন দিয়ে খুঁজুন..."
          value={q}
          onChangeText={setQ}
          autoFocus
        />

        <Pressable style={styles.addNew} onPress={addNew}>
          <Text style={styles.addNewText}>
            ＋ নতুন {label} যোগ করুন{q.trim() ? ` — “${q.trim()}”` : ""}
          </Text>
        </Pressable>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>
                {q.trim() ? `“${q.trim()}” নামে কিছু পাওয়া যায়নি` : `কোনো ${label} নেই`}
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
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.phone}>{item.phone ?? "—"}</Text>
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
  title: { fontSize: 18, fontWeight: "700", color: theme.text },
  close: { color: theme.danger, fontWeight: "600" },
  search: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
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
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  name: { fontSize: 15, fontWeight: "600", color: theme.text },
  phone: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  emptyBox: { marginTop: 40, alignItems: "center" },
  empty: { textAlign: "center", color: theme.textMuted, fontSize: 14 },
  emptyHint: { textAlign: "center", color: theme.textFaint, fontSize: 12.5, marginTop: 6 },
});
