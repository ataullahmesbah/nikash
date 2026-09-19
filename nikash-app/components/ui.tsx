import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

// পুরো অ্যাপের শেয়ার্ড ডিজাইন সিস্টেম — একই কার্ড, ব্যাজ, সেকশন,
// খালি-অবস্থা সব জায়গায় ব্যবহার হবে যাতে দেখতে একরকম ও প্রফেশনাল লাগে।

export const theme = {
  bg: "#f6f7f9",
  surface: "#ffffff",
  surfaceAlt: "#f1f5f9",
  border: "#e5e9f0",
  text: "#0f172a",
  textMuted: "#64748b",
  textFaint: "#94a3b8",
  primary: "#0f172a",
  accent: "#2563eb",
  success: "#059669",
  successBg: "#ecfdf5",
  warning: "#d97706",
  warningBg: "#fffbeb",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  info: "#0284c7",
  infoBg: "#f0f9ff",
} as const;

export function Section({
  title,
  action,
  children,
  style,
}: {
  title?: string;
  action?: { label: string; onPress: () => void };
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ marginBottom: 18 }, style]}>
      {(title || action) && (
        <View style={s.sectionHead}>
          {title ? <Text style={s.sectionTitle}>{title}</Text> : <View />}
          {action && (
            <Pressable onPress={action.onPress} hitSlop={8}>
              <Text style={s.sectionAction}>{action.label}</Text>
            </Pressable>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [s.card, style, pressed && s.pressed]} onPress={onPress}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  onPress,
  width,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger" | "success" | "warning";
  onPress?: () => void;
  width?: ViewStyle["width"];
}) {
  const toneColor =
    tone === "danger" ? theme.danger : tone === "success" ? theme.success : tone === "warning" ? theme.warning : theme.text;
  const body = (
    <>
      <Text style={s.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[s.statValue, { color: toneColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      {hint ? <Text style={s.statHint}>{hint}</Text> : null}
      {onPress ? <Text style={s.statChevron}>›</Text> : null}
    </>
  );
  const cardStyle: ViewStyle = { width: width ?? "47.5%" };
  return onPress ? (
    <Pressable style={({ pressed }) => [s.card, s.stat, cardStyle, pressed && s.pressed]} onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    <View style={[s.card, s.stat, cardStyle]}>{body}</View>
  );
}

export function Badge({ label, tone = "default" }: { label: string; tone?: "default" | "success" | "warning" | "danger" | "info" }) {
  const map = {
    default: { bg: theme.surfaceAlt, fg: theme.textMuted },
    success: { bg: theme.successBg, fg: theme.success },
    warning: { bg: theme.warningBg, fg: theme.warning },
    danger: { bg: theme.dangerBg, fg: theme.danger },
    info: { bg: theme.infoBg, fg: theme.info },
  } as const;
  const c = map[tone];
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={[s.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon = "📭",
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyIcon}>{icon}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      {message ? <Text style={s.emptyMessage}>{message}</Text> : null}
      {action && (
        <Pressable style={s.emptyBtn} onPress={action.onPress}>
          <Text style={s.emptyBtnText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  rightSub,
  badge,
  onPress,
  onLongPress,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  rightSub?: string;
  badge?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const Wrapper: React.ElementType = onPress ? Pressable : View;
  return (
    <Wrapper
      style={({ pressed }: { pressed?: boolean }) => [s.card, s.listRow, pressed && s.pressed]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={s.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {right ? <Text style={s.rowRight}>{right}</Text> : null}
        {rightSub ? <Text style={s.rowRightSub}>{rightSub}</Text> : null}
        {badge}
      </View>
    </Wrapper>
  );
}

export function Loader() {
  return (
    <View style={s.loader}>
      <ActivityIndicator color={theme.primary} />
    </View>
  );
}

export function Divider() {
  return <View style={s.divider} />;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pressed: { opacity: 0.7 },
  stat: { minHeight: 82, justifyContent: "center" },
  statLabel: { fontSize: 12, color: theme.textMuted, fontWeight: "500" },
  statValue: { fontSize: 19, fontWeight: "800", marginTop: 4, letterSpacing: -0.3 },
  statHint: { fontSize: 11, color: theme.textFaint, marginTop: 2 },
  statChevron: { position: "absolute", right: 12, top: 12, fontSize: 18, color: theme.textFaint },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: theme.text },
  sectionAction: { fontSize: 13, fontWeight: "600", color: theme.accent },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: theme.text, textAlign: "center" },
  emptyMessage: { fontSize: 13, color: theme.textMuted, textAlign: "center", marginTop: 6, lineHeight: 19 },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: theme.text },
  rowSubtitle: { fontSize: 12, color: theme.textMuted, marginTop: 3 },
  rowRight: { fontSize: 15, fontWeight: "700", color: theme.text },
  rowRightSub: { fontSize: 11, color: theme.textFaint },
  loader: { paddingVertical: 40, alignItems: "center" },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 12 },
});
