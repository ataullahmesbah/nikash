import type { ReactNode } from "react";
import SiteNav from "./_components/site-nav";
import SiteFooter from "./_components/site-footer";
import { getAdminSession } from "@/lib/auth/session";

// ফুটার ও পেজগুলো লাইভ সেটিংস পড়ে, তাই স্ট্যাটিক প্রি-রেন্ডার নয়।
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  // অ্যাডমিন হিসেবে লগইন করা থাকলে হেডারে "লগইন"-এর বদলে "ড্যাশবোর্ড"
  // দেখাব। ADMIN_JWT_SECRET না থাকলে getAdminSession() throw করে — তখনও
  // যেন পাবলিক সাইট না ভাঙে, তাই try/catch; ব্যর্থ হলে শুধু লগইনই থাকবে।
  let adminName: string | null = null;
  try {
    adminName = (await getAdminSession())?.name ?? null;
  } catch {
    adminName = null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav adminName={adminName} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
