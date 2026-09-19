import type { ReactNode } from "react";
import SiteNav from "./_components/site-nav";
import SiteFooter from "./_components/site-footer";

// ফুটার ও পেজগুলো লাইভ সেটিংস পড়ে, তাই স্ট্যাটিক প্রি-রেন্ডার নয়।
export const dynamic = "force-dynamic";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
