import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToastList, type ToastType } from "@/lib/toast/toast-context";

// PRD 20.3 colors: success green, error red, warning yellow, info blue,
// offline gray. Position: bottom on mobile. Tap anywhere on a toast to
// dismiss it early (a full swipe gesture would need react-native-gesture-handler,
// which isn't otherwise needed in this app — tap-to-dismiss covers the
// same "get it out of my way" need without the extra dependency).
const STYLES: Record<ToastType, { bg: string; text: string }> = {
  success: { bg: "#059669", text: "#fff" },
  error: { bg: "#dc2626", text: "#fff" },
  warning: { bg: "#d97706", text: "#fff" },
  info: { bg: "#2563eb", text: "#fff" },
  offline: { bg: "#475569", text: "#fff" },
};

export function ToastContainer() {
  const { toasts, dismiss } = useToastList();
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.container, { bottom: insets.bottom + 16 }]}>
      {toasts.map((t) => {
        const style = STYLES[t.type];
        return (
          <Pressable
            key={t.id}
            onPress={() => dismiss(t.id)}
            style={[styles.toast, { backgroundColor: style.bg }]}
          >
            <Text style={[styles.message, { color: style.text }]} numberOfLines={2}>
              {t.message}
            </Text>
            {t.actionLabel && (
              <Pressable
                onPress={() => {
                  t.onAction?.();
                  dismiss(t.id);
                }}
                hitSlop={8}
              >
                <Text style={styles.action}>{t.actionLabel}</Text>
              </Pressable>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  message: { fontSize: 13, fontWeight: "600", flex: 1, marginRight: 8 },
  action: { fontSize: 13, fontWeight: "800", color: "#fff", textDecorationLine: "underline" },
});
