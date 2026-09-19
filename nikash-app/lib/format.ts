// বাংলা তারিখ/সংখ্যা ফরম্যাটিং — পুরো অ্যাপে একই নিয়ম।

const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

const BN_MONTHS_SHORT = [
  "জানু", "ফেব", "মার্চ", "এপ্রি", "মে", "জুন",
  "জুলা", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে",
];

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBnDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/** "2026-09-18" → "১৮ সেপ্টেম্বর ২০২৬" */
export function formatDateBn(iso: string | null | undefined, short = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = short ? BN_MONTHS_SHORT : BN_MONTHS;
  return `${toBnDigits(d.getDate())} ${months[d.getMonth()]} ${toBnDigits(d.getFullYear())}`;
}

/** Date object → "2026-09-18" (ডাটাবেসে যা যায়) */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

/** টাকার অঙ্ক — ৳১২,৫০০ */
export function taka(n: number | null | undefined, bnDigits = false): string {
  const v = Number(n ?? 0);
  const formatted = v.toLocaleString("en-BD", { maximumFractionDigits: 2 });
  return `৳${bnDigits ? toBnDigits(formatted) : formatted}`;
}

/** কত দিন আগে — "১২ দিন আগে" */
export function daysAgoBn(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff <= 0) return "আজ";
  if (diff === 1) return "গতকাল";
  return `${toBnDigits(diff)} দিন আগে`;
}

export type DateRangeKey = "today" | "yesterday" | "week" | "month" | "last_month" | "custom";

export type DateRange = { from: string; to: string; label: string };

/** ড্যাশবোর্ড ও তালিকার প্রিসেট রেঞ্জ */
export function presetRange(key: Exclude<DateRangeKey, "custom">): DateRange {
  const now = new Date();
  const startOfDay = (d: Date) => toIsoDate(d);

  switch (key) {
    case "today":
      return { from: startOfDay(now), to: startOfDay(now), label: "আজ" };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: startOfDay(y), label: "গতকাল" };
    }
    case "week": {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { from: startOfDay(start), to: startOfDay(now), label: "এই সপ্তাহ" };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(start), to: startOfDay(now), label: "এই মাস" };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(start), to: startOfDay(end), label: "গত মাস" };
    }
  }
}

// ---------------------------------------------------------------- প্যাকের হিসাব

export type PackUnit = { unit_name: string; factor: number };

/**
 * স্টক সবসময় ছোট এককে (বোতল/পিস/গ্রাম) জমা থাকে। দোকানি কিন্তু প্যাকে ভাবেন।
 *
 * ১ কেস = ২৪ বোতল হলে ১০,৭৭০ বোতল মানে ৪৪৮ কেস ১৮ বোতল —
 * ৪৪৮.৭৫ কেস নয়। দশমিক কখনো দেখাই না, ভাগশেষ আলাদা করে দেখাই।
 */
export function formatPackQty(
  qtyBase: number,
  baseUnit: string,
  pack: PackUnit | null | undefined
): string {
  const qty = Number(qtyBase) || 0;
  const tidy = (n: number) => Number(n.toFixed(3)).toLocaleString("en-BD");

  if (!pack || pack.factor <= 1) return `${tidy(qty)} ${baseUnit}`;

  const sign = qty < 0 ? -1 : 1;
  const abs = Math.abs(qty);
  const packs = Math.floor(abs / pack.factor);
  const rest = Number((abs % pack.factor).toFixed(3));

  if (packs === 0) return `${tidy(qty)} ${baseUnit}`;
  if (rest === 0) return `${tidy(sign * packs)} ${pack.unit_name}`;
  return `${tidy(sign * packs)} ${pack.unit_name} ${tidy(rest)} ${baseUnit}`;
}

/** ভ্যারিয়েন্টের ইউনিট তালিকা থেকে সবচেয়ে বড় প্যাকটা বেছে নেয় */
export function biggestPack(
  units: { unit_name: string; level: number; factor_to_base: number }[] | null | undefined
): PackUnit | null {
  const big = (units ?? [])
    .filter((u) => u.level > 0 && Number(u.factor_to_base) > 1)
    .sort((a, b) => Number(b.factor_to_base) - Number(a.factor_to_base))[0];
  return big ? { unit_name: big.unit_name, factor: Number(big.factor_to_base) } : null;
}
