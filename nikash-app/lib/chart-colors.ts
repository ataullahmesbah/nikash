// Validated categorical/status palette (light mode) — see the dataviz
// skill's references/palette.md. Fixed order, never cycled or reassigned
// per-filter; each hex cleared CVD Delta E >= 8 and normal-vision >= 15
// against its adjacent slot.
export const categorical = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  yellow: "#eda100",
  magenta: "#e87ba4",
  green: "#008300",
  violet: "#4a3aa7",
  red: "#e34948",
} as const;

// Reserved for state, never reused as a categorical series color.
export const status = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export const chrome = {
  surface: "#fcfcfb",
  textPrimary: "#0b0b0b",
  textSecondary: "#52514e",
  muted: "#898781",
  gridline: "#e1e0d9",
  baseline: "#c3c2b7",
} as const;

// Aging buckets always render in this fixed good->critical order —
// PRD 9.2 #7 calls the 60+ bucket out specifically as the one that
// should read as urgent.
export const agingColor: Record<string, string> = {
  "0-15": status.good,
  "16-30": categorical.yellow,
  "31-60": status.serious,
  "60+": status.critical,
};
