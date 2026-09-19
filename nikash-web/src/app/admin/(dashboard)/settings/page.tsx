import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/ui";
import { TwoFactorPanel } from "./two-factor-panel";
import PlansPanel, { type Plan } from "./_components/plans-panel";
import {
  AppLinksPanel,
  BillingRulesPanel,
  PaymentNumbersPanel,
  ProfilePanel,
  SupportPanel,
} from "./_components/settings-panels";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "profile", label: "প্রোফাইল ও নিরাপত্তা", icon: "🔐" },
  { key: "plans", label: "প্ল্যান ও দাম", icon: "🏷️" },
  { key: "payment", label: "পেমেন্ট নম্বর", icon: "💳" },
  { key: "support", label: "সাপোর্ট তথ্য", icon: "☎️" },
  { key: "app", label: "অ্যাপ লিংক", icon: "📱" },
  { key: "billing", label: "বিলিং নিয়ম", icon: "⚙️" },
] as const;

function asObject(v: unknown): Record<string, string> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? (rawTab as string) : "profile";

  const db = supabaseAdmin();
  const [adminRes, settingsRes, plansRes] = await Promise.all([
    db.from("platform_admins").select("name, email, role, is_2fa_enabled").eq("id", session.adminId).maybeSingle(),
    db.from("platform_settings").select("key, value"),
    db.from("plans").select("*").order("price"),
  ]);

  const admin = adminRes.data;
  const settings: Record<string, unknown> = {};
  for (const row of settingsRes.data ?? []) settings[row.key] = row.value;

  const isSuper = session.role === "super_admin";

  return (
    <div>
      <PageHeader
        title="সেটিংস"
        subtitle="প্ল্যাটফর্মের সব কনফিগারেশন — প্ল্যান, পেমেন্ট নম্বর, সাপোর্ট তথ্য ও নিজের অ্যাকাউন্ট"
      />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/settings?tab=${t.key}`}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </div>

      {!isSuper && tab !== "profile" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          আপনি সাপোর্ট অ্যাডমিন — এই সেটিংসগুলো দেখতে পারবেন, কিন্তু বদলাতে পারবেন না।
        </div>
      )}

      {tab === "profile" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="mb-4 font-bold text-slate-900">অ্যাকাউন্ট</h2>
            <ProfilePanel
              name={admin?.name ?? session.name}
              email={admin?.email ?? ""}
              role={admin?.role ?? session.role}
            />
          </Card>

          <Card className="h-fit p-6">
            <h2 className="mb-1 font-bold text-slate-900">দুই-ধাপ যাচাইকরণ (2FA)</h2>
            <p className="mb-4 text-sm text-slate-500">
              চালু থাকলে লগইনের সময় পাসওয়ার্ডের পাশাপাশি Google Authenticator / Authy-এর ৬-সংখ্যার কোডও লাগবে।
            </p>
            <TwoFactorPanel initialEnabled={admin?.is_2fa_enabled ?? false} />
          </Card>
        </div>
      )}

      {tab === "plans" && (
        <Card className="p-6">
          <h2 className="mb-4 font-bold text-slate-900">সাবস্ক্রিপশন প্ল্যান</h2>
          <PlansPanel plans={(plansRes.data ?? []) as Plan[]} />
        </Card>
      )}

      {tab === "payment" && (
        <Card className="max-w-3xl p-6">
          <h2 className="mb-4 font-bold text-slate-900">পেমেন্ট নম্বর</h2>
          <PaymentNumbersPanel value={asObject(settings["public.payment_numbers"])} />
        </Card>
      )}

      {tab === "support" && (
        <Card className="max-w-3xl p-6">
          <h2 className="mb-4 font-bold text-slate-900">সাপোর্ট ও যোগাযোগ</h2>
          <SupportPanel value={asObject(settings["public.support"])} />
        </Card>
      )}

      {tab === "app" && (
        <Card className="max-w-3xl p-6">
          <h2 className="mb-4 font-bold text-slate-900">অ্যাপ ডাউনলোড লিংক</h2>
          <AppLinksPanel value={asObject(settings["public.app_links"])} />
        </Card>
      )}

      {tab === "billing" && (
        <Card className="max-w-3xl p-6">
          <h2 className="mb-4 font-bold text-slate-900">বিলিং নিয়ম</h2>
          <BillingRulesPanel
            trialDays={Number(settings["billing.trial_days"] ?? 15)}
            graceDays={Number(settings["billing.grace_days"] ?? 7)}
          />
        </Card>
      )}
    </div>
  );
}
