import { useEffect, useRef } from "react";
import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Supabase Realtime — অ্যাডমিন প্যানেল থেকে নোটিশ পাঠালে বা কোম্পানির
// স্ট্যাটাস বদলালে অ্যাপে সাথে সাথে পৌঁছাবে, রিফ্রেশের অপেক্ষা ছাড়াই।
//
// ⚠️ Supabase ড্যাশবোর্ডে Database → Replication-এ গিয়ে এই টেবিলগুলোর
// জন্য realtime চালু করতে হবে: notices, companies, users, notifications.

type ChangeHandler = (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void;

// প্রতিটা সাবস্ক্রিপশনকে আলাদা নাম দিতে কাউন্টার।
//
// কেন দরকার: supabase-js একই topic-এর চ্যানেল আবার চাইলে আগেরটাই ফেরত দেয়।
// স্ক্রিন দুইবার মাউন্ট হলে (বা ফিল্টার বদলালে) removeChannel শেষ হওয়ার আগেই
// নতুন কল চলে আসে — তখন already-subscribed চ্যানেলে .on() ডাকা পড়ে এবং
// "cannot add postgres_changes callbacks after subscribe()" এরর দিয়ে অ্যাপ
// আটকে যায়। নাম আলাদা হলে সেই সংঘর্ষটাই আর হয় না।
let channelSeq = 0;

export function useRealtimeTable(
  table: string,
  filter: string | undefined,
  onChange: ChangeHandler,
  enabled = true
) {
  const handlerRef = useRef(onChange);
  handlerRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    let channel: RealtimeChannel | null = null;

    try {
      channel = supabase
        .channel(`rt:${table}:${filter ?? "all"}:${++channelSeq}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter },
          (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
            handlerRef.current(payload);
          }
        )
        .subscribe();
    } catch (e) {
      // Realtime শুধু "সাথে সাথে আপডেট" দেখানোর জন্য — এটা কাজ না করলেও
      // স্ক্রিন নিজের ডেটা ঠিকই লোড করে। তাই এখানে অ্যাপ ক্র্যাশ করানো যাবে না।
      console.warn(`[realtime] ${table} subscribe failed`, e);
      channel = null;
    }

    return () => {
      if (!channel) return;
      supabase.removeChannel(channel).catch(() => undefined);
    };
  }, [table, filter, enabled]);
}

/** কোম্পানির স্ট্যাটাস/মেয়াদ বদলালে (অ্যাডমিন ব্লক/readonly করলে) সাথে সাথে জানবে */
export function useCompanyWatch(companyId: string | undefined, onChange: ChangeHandler) {
  useRealtimeTable("companies", companyId ? `id=eq.${companyId}` : undefined, onChange, !!companyId);
}

/** নতুন নোটিশ এলে সাথে সাথে দেখাবে */
export function useNoticeWatch(enabled: boolean, onChange: ChangeHandler) {
  useRealtimeTable("notices", undefined, onChange, enabled);
}
