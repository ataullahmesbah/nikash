import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { theme } from "./ui";

// লগইন ও সাইনআপ পাতার ইনপুট ঘর।
//
// ⚠️ এই ফাইলটা কেন আলাদা: আগে দুই পাতায় সরাসরি <TextInput> লেখা ছিল,
// আর সেখানে `color` বা `placeholderTextColor` কিছুই দেওয়া হয়নি। ফলে
// কিছু অ্যান্ড্রয়েড ফোনে (বিশেষত ডার্ক থিমে) লেখা আর প্লেসহোল্ডার
// দুটোই প্রায় অদৃশ্য হয়ে যেত — ঘরগুলো ফাঁকা দেখাত, কোনটায় কী বসবে
// বোঝার উপায় ছিল না।
//
// এখন প্রতিটা ঘরের উপরে লেবেল থাকে, রঙ স্পষ্ট করে বলা, আর
// পাসওয়ার্ডে 👁️ বোতাম।

export function AuthField({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secure = false,
  autoCapitalize = "none",
  maxLength,
  editable = true,
}: {
  label: string;
  /** ঘরের নিচে ছোট ব্যাখ্যা — "কী বসাব" প্রশ্নটা যেন না ওঠে */
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secure?: boolean;
  autoCapitalize?: "none" | "sentences" | "words";
  maxLength?: number;
  editable?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.box, focused && styles.boxFocused]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          // ⬇️ এই দুটোই আগে ছিল না — এগুলোর জন্যই লেখা দেখা যেত না
          placeholderTextColor={theme.textFaint}
          keyboardType={keyboardType}
          secureTextEntry={secure && !show}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {secure && (
          <Pressable
            onPress={() => setShow((v) => !v)}
            hitSlop={12}
            style={styles.eye}
            accessibilityLabel={show ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
          >
            <Text style={styles.eyeIcon}>{show ? "🙈" : "👁️"}</Text>
          </Pressable>
        )}
      </View>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.text,
    marginBottom: 6,
  },
  box: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  boxFocused: { borderColor: theme.accent },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15.5,
    color: theme.text, // ⬅️ স্পষ্ট করে বলা, নইলে ফোনের থিম ঠিক করত
  },
  eye: { paddingLeft: 10, paddingVertical: 8 },
  eyeIcon: { fontSize: 17 },
  hint: {
    fontSize: 11.5,
    color: theme.textMuted,
    marginTop: 5,
    lineHeight: 16,
  },
});
