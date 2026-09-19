import { supabase } from "./supabase";

export type AppNotification = {
  id: string;
  type: string;
  severity: "info" | "success" | "warning" | "critical";
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

// RLS নিজেই কোম্পানি-স্কোপ সামলায় — এখানে শুধু নামানো।
export async function loadNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, severity, title, body, link, read_at, created_at")
    .eq("audience", "company")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as AppNotification[];
}

export async function unreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("audience", "company")
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function markRead(id: string) {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function markAllRead() {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("audience", "company")
    .is("read_at", null);
}
