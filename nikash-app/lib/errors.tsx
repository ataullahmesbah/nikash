// সার্ভারের এরর থেকে মানুষের পড়ার মতো বার্তা বের করা।
//
// Supabase যে এরর ফেরত দেয় সেটা সাধারণ অবজেক্ট ({ message, details, hint,
// code }) — JavaScript-এর `Error` নয়। তাই `e instanceof Error ? e.message
// : "..."` লিখলে আসল কারণটা হারিয়ে গিয়ে সবসময় "সংরক্ষণ ব্যর্থ হয়েছে"
// দেখাত। কী ভুল হলো সেটা না জানলে ঠিক করার উপায় থাকে না।

/** এররের ভেতর থেকে message/details যা পাওয়া যায় তা টেনে আনে */
export function errorMessage(e: unknown, fallback = "কাজটি করা যায়নি"): string {
    if (!e) return fallback;
    if (typeof e === "string") return e.trim() || fallback;
    if (e instanceof Error && e.message) return e.message;

    if (typeof e === "object") {
        const o = e as Record<string, unknown>;
        const parts = [o.message, o.details, o.hint]
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
        if (parts.length > 0) {
            // একই কথা দুবার এলে একবারই রাখি
            return [...new Set(parts)].join(" — ");
        }
        if (typeof o.code === "string") return `সার্ভার এরর (${o.code})`;
    }

    return fallback;
}

/**
 * টোস্টে দেখানোর মতো ছোট বার্তা। ডেটাবেজের কিছু এরর ইংরেজিতে ও অনেক
 * লম্বা হয়, তাই চেনা কয়েকটাকে বাংলায় বদলে দিই — বাকিগুলো ছেঁটে দিই
 * (পুরোটা স্ক্রিনে inline লেখায় থেকেই যায়)।
 */
export function toastMessage(e: unknown, fallback = "কাজটি করা যায়নি"): string {
    const raw = errorMessage(e, fallback);
    const low = raw.toLowerCase();

    if (low.includes("row-level security")) return "এই কাজের অনুমতি নেই";
    if (low.includes("duplicate key")) return "এটি আগেই যোগ করা হয়েছে";
    if (low.includes("foreign key")) return "এর সাথে যুক্ত তথ্য আছে, আগে সেটি সরান";
    if (low.includes("insufficient") || low.includes("স্টক")) return raw.slice(0, 80);
    if (low.includes("failed to fetch") || low.includes("network")) {
        return "ইন্টারনেট সংযোগ পাওয়া যায়নি";
    }

    return raw.length > 70 ? `${raw.slice(0, 67)}…` : raw;
}
