import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast/toast-context";
import { ConfirmModal } from "./confirm-modal";
import { theme } from "./ui";

/** soft_delete_row() যে টেবিলগুলো মুছতে দেয় (07 SQL-এর হোয়াইটলিস্ট) */
export type DeletableTable = "vehicles" | "routes" | "expenses" | "vehicle_trips";

// তালিকার প্রতিটা সারিতে একই রকম "সম্পাদনা / মুছুন" জোড়া। চার জায়গায়
// একই কোড না লিখে এক জায়গায় রাখলাম — আচরণও সব জায়গায় এক থাকে।
export function RowActions({
  table,
  id,
  editHref,
  label,
  deleteMessage,
  onDone,
}: {
  table: DeletableTable;
  id: string;
  /** এডিট ফর্মের পথ, যেমন `/vehicles/new?editId=123` */
  editHref: string;
  /** নিশ্চিতকরণে যা দেখাবে, যেমন "গাড়িটি" */
  label: string;
  deleteMessage?: string;
  onDone: () => void;
}) {
  const { profile } = useAuth();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  // মালিক ও ম্যানেজারই কেবল বদলাতে/মুছতে পারবে (সার্ভারেও একই নিয়ম)
  const canManage = profile?.role === "owner" || profile?.role === "manager";
  if (!canManage) return null;

  async function handleDelete() {
    setConfirm(false);
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("soft_delete_row", {
        p_table: table,
        p_id: id,
      });
      if (error) throw error;
      toast.success(data === "already_deleted" ? "আগেই মুছে ফেলা হয়েছে" : `${label} মুছে ফেলা হয়েছে`);
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "মুছে ফেলা যায়নি";
      toast.error(msg.length > 70 ? "মুছে ফেলা যায়নি" : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, { backgroundColor: theme.infoBg }]}
          onPress={() => router.push(editHref as never)}
          hitSlop={6}
        >
          <Text style={[styles.text, { color: theme.info }]}>✏️ সম্পাদনা</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, { backgroundColor: theme.dangerBg }]}
          onPress={() => setConfirm(true)}
          disabled={busy}
          hitSlop={6}
        >
          <Text style={[styles.text, { color: theme.danger }]}>{busy ? "মুছছে…" : "🗑️ মুছুন"}</Text>
        </Pressable>
      </View>

      <ConfirmModal
        visible={confirm}
        title={`${label} মুছে ফেলবেন?`}
        message={
          deleteMessage ??
          "তালিকা থেকে সরে যাবে। পুরনো হিসাব-নিকাশ ঠিকই থাকবে, শুধু নতুন এন্ট্রিতে আর আসবে না।"
        }
        confirmLabel="হ্যাঁ, মুছুন"
        onConfirm={handleDelete}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  text: { fontSize: 12.5, fontWeight: "700" },
});
