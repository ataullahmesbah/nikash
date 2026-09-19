import type { NextConfig } from "next";

// নিরাপত্তা হেডার — ব্রাউজারকে বলে দেয় কী করা যাবে না।
// ক্লিকজ্যাকিং (অন্য সাইট iframe-এ আমাদের অ্যাডমিন প্যানেল ঢুকিয়ে ক্লিক
// চুরি), MIME স্নিফিং আর রেফারারে লিংক ফাঁস — তিনটেই এখানে বন্ধ।
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HTTPS-এ একবার ঢুকলে ব্রাউজার আর কখনো http চেষ্টা করবে না।
  // লোকালহোস্টে এই হেডার কিছুই করে না, তাই ডেভেলপমেন্টে সমস্যা নেই।
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
