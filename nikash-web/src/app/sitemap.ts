import type { MetadataRoute } from "next";

// সার্চ ইঞ্জিনকে বলে দেয় সাইটে কোন কোন পাতা আছে। শুধু পাবলিক পাতা —
// /admin আর /api ইচ্ছে করেই বাদ, ওগুলো Google-এ আসার কথা নয়।
// ডোমেইন বদলালে NEXT_PUBLIC_SITE_URL বসিয়ে দিলেই হবে, কোড ছুঁতে হবে না।

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nikash-web.vercel.app").replace(/\/$/, "");

const ROUTES: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/",         priority: 1.0, freq: "weekly"  },
  { path: "/services", priority: 0.9, freq: "monthly" },
  { path: "/pricing",  priority: 0.9, freq: "monthly" },
  { path: "/download", priority: 0.9, freq: "weekly"  },
  { path: "/signup",   priority: 0.8, freq: "monthly" },
  { path: "/about",    priority: 0.6, freq: "yearly"  },
  { path: "/contact",  priority: 0.6, freq: "yearly"  },
  { path: "/privacy",  priority: 0.3, freq: "yearly"  },
  { path: "/terms",    priority: 0.3, freq: "yearly"  },
  { path: "/refund",   priority: 0.3, freq: "yearly"  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));
}
