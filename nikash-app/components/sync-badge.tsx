import { StyleSheet, Text, View } from "react-native";
import { useSyncStatus } from "@/lib/offline/use-sync-status";

// PRD 18 rule #4/#5: a badge is always visible somewhere in the header,
// and it turns into a persistent yellow warning once something has been
// waiting 2+ days to sync.
export function SyncBadge() {
  const { isOnline, pendingCount, staleForTwoDays } = useSyncStatus();

  if (staleForTwoDays) {
    return (
      <View style={[styles.badge, styles.stale]}>
        <Text style={styles.staleText}>⚠️ ২ দিনের বেশি sync হয়নি — ইন্টারনেট চেক করুন</Text>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <View style={[styles.badge, styles.offline]}>
        <Text style={styles.offlineText}>অফলাইন — ডেটা ফোনে সংরক্ষিত</Text>
      </View>
    );
  }

  if (pendingCount > 0) {
    return (
      <View style={[styles.badge, styles.pending]}>
        <Text style={styles.pendingText}>{pendingCount}টি এন্ট্রি sync হচ্ছে...</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  badge: { paddingVertical: 6, paddingHorizontal: 12, alignItems: "center" },
  offline: { backgroundColor: "#f1f5f9" },
  offlineText: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  pending: { backgroundColor: "#dbeafe" },
  pendingText: { color: "#1d4ed8", fontSize: 12, fontWeight: "600" },
  stale: { backgroundColor: "#fef3c7" },
  staleText: { color: "#92400e", fontSize: 12, fontWeight: "700" },
});
