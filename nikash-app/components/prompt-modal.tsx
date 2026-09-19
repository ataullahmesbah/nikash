import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { theme } from "./ui";

// কোনো ঝুঁকিপূর্ণ কাজের (বাতিল, সম্পাদনা) আগে "কেন" জানতে চাওয়া হয়।
// React Native-এর Alert.prompt শুধু iOS-এ চলে, তাই নিজেদের ডায়ালগ।
//
// আগে এখানে autoFocus ছিল — কিবোর্ড খুলে "নিশ্চিত করুন" বাটনটাই ঢেকে ফেলত,
// ফলে মনে হতো বাটন কাজ করছে না। এখন কিবোর্ড এলে কার্ড উপরে উঠে যায়,
// আর কিবোর্ড খোলা থাকা অবস্থায়ও বাটনের চাপ ধরা পড়ে।
export function PromptModal({
  visible,
  title,
  hint,
  quickReasons = ["ভুল পরিমাণ", "ভুল দাম", "ভুল পার্টি", "ক্রেতা ফেরত দিয়েছে"],
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  title: string;
  hint?: string;
  /** এক চাপে বসানো যায় এমন চেনা কারণ — টাইপ না করলেও চলে */
  quickReasons?: string[];
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");

  // ডায়ালগ বন্ধ হলে আগের লেখা মুছে যাক, নইলে পরেরবার পুরনো কারণ বসে থাকে
  useEffect(() => {
    if (!visible) setText("");
  }, [visible]);

  const canSubmit = text.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}

            <View style={styles.chipRow}>
              {quickReasons.map((r) => (
                <Pressable key={r} style={styles.chip} onPress={() => setText(r)}>
                  <Text style={styles.chipText}>{r}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="কারণ লিখুন"
              placeholderTextColor={theme.textFaint}
              multiline
            />

            <Pressable
              style={[styles.confirm, !canSubmit && styles.confirmOff]}
              disabled={!canSubmit}
              onPress={() => onSubmit(text.trim())}
            >
              <Text style={styles.confirmText}>
                {canSubmit ? "নিশ্চিত করুন" : "আগে কারণ লিখুন"}
              </Text>
            </Pressable>

            <Pressable style={styles.cancel} onPress={onCancel}>
              <Text style={styles.cancelText}>বাতিল</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: { backgroundColor: theme.surface, borderRadius: 18, padding: 20 },
  title: { fontSize: 16, fontWeight: "800", color: theme.text },
  hint: { fontSize: 12.5, color: theme.textMuted, marginTop: 6, lineHeight: 18 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipText: { fontSize: 12.5, color: theme.text, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 12,
    minHeight: 72,
    textAlignVertical: "top",
    fontSize: 14,
    color: theme.text,
  },
  confirm: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  confirmOff: { backgroundColor: theme.border },
  confirmText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancel: { paddingVertical: 12, alignItems: "center", marginTop: 2 },
  cancelText: { color: theme.textMuted, fontWeight: "600", fontSize: 14 },
});
