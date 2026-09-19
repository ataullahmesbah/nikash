import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

// ডিলিট/বাতিলের মতো ঝুঁকিপূর্ণ কাজের আগে নিশ্চিতকরণ।
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "নিশ্চিত করুন",
  cancelLabel = "বাতিল",
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onCancel}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.confirm, tone === "danger" && styles.confirmDanger]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
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
  title: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  message: { fontSize: 14, color: "#64748b", marginTop: 8, lineHeight: 20 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20 },
  cancel: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelText: { color: "#64748b", fontWeight: "600" },
  confirm: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#0f172a", borderRadius: 10 },
  confirmDanger: { backgroundColor: "#dc2626" },
  confirmText: { color: "#fff", fontWeight: "700" },
});
