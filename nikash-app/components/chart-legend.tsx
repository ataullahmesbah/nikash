import { StyleSheet, Text, View } from "react-native";

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={styles.row}>
      {items.map((it) => (
        <View key={it.label} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: it.color }]} />
          <Text style={styles.label}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 },
  item: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 12, color: "#52514e", fontWeight: "600" },
});
