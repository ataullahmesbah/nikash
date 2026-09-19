import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type Notice = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical" | string;
  title_bn: string;
  body_bn: string | null;
  show_as: "banner" | "popup" | string;
  is_dismissible: boolean;
  created_at: string;
};

// RLS ইতিমধ্যে টার্গেটিং সামলায় (company_id / business_type / সময়সীমা),
// তাই এখানে শুধু সক্রিয় নোটিশগুলো নামালেই হয়।
export async function loadActiveNotices(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from("notices")
    .select("id, type, severity, title_bn, body_bn, show_as, is_dismissible, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    // আগে চুপচাপ ফাঁকা তালিকা ফেরত যেত — নোটিশ না এলে কারণ বোঝার উপায় ছিল না
    console.warn("[notices] load failed:", error.message);
    return [];
  }
  return (data ?? []) as Notice[];
}

const DISMISS_KEY = "nikash:dismissed-notices";

export async function getDismissed(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function dismissNotice(id: string) {
  try {
    const list = await getDismissed();
    if (!list.includes(id)) {
      await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify([...list, id]));
    }
  } catch {
    // best-effort
  }
}

/** পড়া হয়েছে বলে সার্ভারে চিহ্ন দেওয়া — অ্যাডমিন দেখবে কতজন পড়েছে */
export async function markNoticeRead(noticeId: string, userId: string) {
  await supabase.from("notice_reads").upsert(
    { notice_id: noticeId, user_id: userId },
    { onConflict: "notice_id,user_id" }
  );
}
