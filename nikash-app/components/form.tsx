import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

export function FormField({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor="#94a3b8" {...props} />
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  tone = "default",
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        tone === "danger" && styles.buttonDanger,
        tone === "success" && styles.buttonSuccess,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[styles.segmentItem, value === opt.value && styles.segmentItemActive]}
        >
          <Text style={[styles.segmentText, value === opt.value && styles.segmentTextActive]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 13, color: "#475569", marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDanger: { backgroundColor: "#dc2626" },
  buttonSuccess: { backgroundColor: "#059669" },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  error: { color: "#dc2626", fontSize: 13, marginBottom: 12 },
  segment: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 9 },
  segmentItemActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4 },
  segmentText: { fontSize: 13, color: "#64748b", fontWeight: "600" },
  segmentTextActive: { color: "#0f172a" },
});
