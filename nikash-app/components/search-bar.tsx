import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

// সব তালিকা স্ক্রিনে একই সার্চ বার — নাম, ফোন, চালান নম্বর ইত্যাদি দিয়ে।
export function SearchBar({
  value,
  onChange,
  placeholder = "খুঁজুন...",
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>🔍</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange("")} hitSlop={8}>
          <Text style={styles.clear}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  icon: { fontSize: 14 },
  input: { flex: 1, fontSize: 15, color: "#0f172a", paddingVertical: 0 },
  clear: { fontSize: 16, color: "#94a3b8", paddingHorizontal: 4 },
});
