import type { MetadataRoute } from "next";

// ক্রলারদের নিয়ম। অ্যাডমিন প্যানেল ও API কখনো ইনডেক্স হবে না।

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nikash-web.vercel.app").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/admin/", "/api/"] }],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
