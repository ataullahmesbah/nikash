import type { NextRequest } from "next/server";

// সহজ ইন-মেমরি রেট লিমিটার।
//
// লগইন ব্রুট-ফোর্স, সাইনআপ স্প্যাম আর যোগাযোগ ফর্মের বন্যা ঠেকানোর জন্য।
// একাধিক সার্ভার ইনস্ট্যান্স বা রিস্টার্টে গণনা রিসেট হয় — তাই এটাই
// নিরাপত্তার একমাত্র স্তর নয়, প্রথম ধাক্কাটা ঠেকানোই উদ্দেশ্য। বড় পরিসরে
// গেলে এটাকে Redis/Upstash দিয়ে বদলে দিলেই হবে, কল করার জায়গা বদলাবে না।

const buckets = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export type RateRule = { windowMs: number; limit: number };

export const RATE = {
  /** অ্যাডমিন লগইন — ১৫ মিনিটে ১০ বার */
  adminLogin: { windowMs: 15 * 60 * 1000, limit: 10 },
  /** TOTP যাচাই — ৬ সংখ্যার কোড, তাই আরও কড়া */
  totp: { windowMs: 15 * 60 * 1000, limit: 8 },
  /** নতুন কোম্পানি সাইনআপ — ঘণ্টায় ৫ বার */
  signup: { windowMs: 60 * 60 * 1000, limit: 5 },
  /** পাবলিক যোগাযোগ ফর্ম — ১০ মিনিটে ৩ বার */
  contact: { windowMs: 10 * 60 * 1000, limit: 3 },
} satisfies Record<string, RateRule>;

/** রিভার্স প্রক্সির পেছনে আসল IP — না পেলে "unknown" (সবাই এক বালতিতে) */
export function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * সীমা ছাড়ালে true। ছাড়ায়নি মানে এই চেষ্টাটা গোনা হয়ে গেছে — তাই
 * একই রিকোয়েস্টে দুবার ডাকবেন না।
 */
export function rateLimited(key: string, rule: RateRule) {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < rule.windowMs);

  if (recent.length >= rule.limit) {
    buckets.set(key, recent);
    return true;
  }

  recent.push(now);
  // ম্যাপটা যেন বাড়তে বাড়তে মেমরি খেয়ে না ফেলে
  if (buckets.size > MAX_KEYS) buckets.clear();
  buckets.set(key, recent);
  return false;
}
