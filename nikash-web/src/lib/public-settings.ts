import { supabaseAdmin } from "./supabase/admin";

// পাবলিক সাইটের সব পেজে সাপোর্ট নম্বর, পেমেন্ট নম্বর ও অ্যাপ লিংক লাগে।
// এক জায়গায় পড়ে নেই যাতে কোথাও নম্বর হার্ডকোড না থাকে।

export type Support = {
  phone: string;
  whatsapp: string;
  email: string;
  hours: string;
  address: string;
};

export type AppLinks = {
  apk_url: string;
  play_store: string;
  manual_url: string;
  version: string;
};

export type PaymentNumbers = {
  bkash: string;
  nagad: string;
  rocket: string;
  bank: string;
  note: string;
};

const FALLBACK_SUPPORT: Support = {
  phone: "",
  whatsapp: "",
  email: "",
  hours: "সকাল ৯টা – রাত ৯টা",
  address: "",
};

function pick<T extends object>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return { ...fallback, ...(value as Partial<T>) };
}

export async function getPublicSettings() {
  // সেটিংস না পড়তে পারলেও পাবলিক সাইট চালু থাকবে — শুধু নম্বরগুলো ফাঁকা
  // দেখাবে। (env না থাকা বিল্ড, DB সাময়িক ডাউন — কোনোটাতেই পেজ ভাঙবে না।)
  let map: Record<string, unknown> = {};
  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from("platform_settings")
      .select("key, value")
      .in("key", ["public.support", "public.payment_numbers", "public.app_links"]);
    map = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
  } catch {
    map = {};
  }

  return {
    support: pick<Support>(map["public.support"], FALLBACK_SUPPORT),
    appLinks: pick<AppLinks>(map["public.app_links"], {
      apk_url: "",
      play_store: "",
      manual_url: "",
      version: "",
    }),
    paymentNumbers: pick<PaymentNumbers>(map["public.payment_numbers"], {
      bkash: "",
      nagad: "",
      rocket: "",
      bank: "",
      note: "",
    }),
  };
}

/** হোয়াটসঅ্যাপ লিংক — নম্বর থেকে +, স্পেস, ড্যাশ বাদ দিয়ে */
export function whatsappLink(number: string, text?: string) {
  const digits = number.replace(/[^\d]/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("880") ? digits : `880${digits.replace(/^0/, "")}`;
  return `https://wa.me/${normalized}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
