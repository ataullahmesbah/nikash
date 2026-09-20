import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Badge, Card, EmptyState, PageHeader, StatCard, Table } from "@/components/ui";

export const dynamic = "force-dynamic";

/* ------------------------- কাজের বাংলা নাম ------------------------- */
// ডেটাবেজে ইংরেজি স্ল্যাগ জমা হয় (record_manual_payment)। পর্দায়
// সেটা দেখালে কেউ বুঝবে না, তাই এখানে বাংলায় অনুবাদ + রঙ।
const ACTIONS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "default" }> = {
    login: { label: "লগইন", tone: "default" },
    approve_payment: { label: "পেমেন্ট অনুমোদন", tone: "success" },
    reject_payment: { label: "পেমেন্ট বাতিল", tone: "danger" },
    record_manual_payment: { label: "ম্যানুয়াল পেমেন্ট", tone: "success" },
    set_company_status: { label: "কোম্পানির স্ট্যাটাস বদল", tone: "warning" },
    create_notice: { label: "নোটিশ পাঠানো", tone: "info" },
    update_notice: { label: "নোটিশ সম্পাদনা", tone: "info" },
    enable_notice: { label: "নোটিশ চালু", tone: "info" },
    disable_notice: { label: "নোটিশ বন্ধ", tone: "warning" },
    delete_notice: { label: "নোটিশ মুছে ফেলা", tone: "danger" },
    create_admin: { label: "নতুন অ্যাডমিন", tone: "warning" },
    update_admin: { label: "অ্যাডমিন সম্পাদনা", tone: "warning" },
    deactivate_admin: { label: "অ্যাডমিন নিষ্ক্রিয়", tone: "danger" },
    create_plan: { label: "নতুন প্ল্যান", tone: "info" },
    update_plan: { label: "প্ল্যান সম্পাদনা", tone: "info" },
    deactivate_plan: { label: "প্ল্যান নিষ্ক্রিয়", tone: "warning" },
    delete_plan: { label: "প্ল্যান মুছে ফেলা", tone: "danger" },
    publish_app_version: { label: "অ্যাপ ভার্সন প্রকাশ", tone: "success" },
    update_app_version: { label: "ভার্সন সম্পাদনা", tone: "info" },
    delete_app_version: { label: "ভার্সন মুছে ফেলা", tone: "danger" },
    update_setting: { label: "সেটিংস বদল", tone: "warning" },
    update_contact_status: { label: "বার্তার অবস্থা বদল", tone: "default" },
};

const TARGETS: Record<string, string> = {
    company: "কোম্পানি",
    companies: "কোম্পানি",
    notices: "নোটিশ",
    plans: "প্ল্যান",
    platform_admins: "অ্যাডমিন",
    app_versions: "অ্যাপ ভার্সন",
    platform_settings: "সেটিংস",
    contact_submissions: "যোগাযোগ বার্তা",
    payment_requests: "পেমেন্ট রিকোয়েস্ট",
};

const FAIL_REASONS: Record<string, string> = {
    invalid_email: "ইমেইল পাওয়া যায়নি",
    invalid_password: "ভুল পাসওয়ার্ড",
    invalid_totp: "ভুল 2FA কোড",
};

/* ----------------------------- সহায়ক ----------------------------- */

function timeAgo(iso: string) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "এইমাত্র";
    if (mins < 60) return `${mins} মিনিট আগে`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ঘণ্টা আগে`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} দিন আগে`;
    return new Date(iso).toLocaleDateString("bn-BD");
}

function fullTime(iso: string) {
    return new Date(iso).toLocaleString("bn-BD", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

/** jsonb থেকে পড়ার মতো সারাংশ — পুরো JSON ঢাললে কেউ পড়বে না */
function summarize(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value !== "object") return String(value);

    const skip = new Set(["id", "updated_at", "created_at", "password_hash", "result"]);
    const parts: string[] = [];

    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (skip.has(k) || v === null || v === "") continue;
        if (typeof v === "object") continue;
        parts.push(`${k}: ${String(v).slice(0, 40)}`);
        if (parts.length >= 4) break;
    }
    return parts.join(" · ");
}

/* ------------------------------ সারির ধরন ------------------------------ */
// supabaseAdmin() ক্লায়েন্টটা জেনারেট-করা Database টাইপ ছাড়া তৈরি,
// তাই select() থেকে আসা সারিগুলো TS-এর কাছে `{}` — কোনো কলামের নাম
// চেনে না। প্রজেক্টের বাকি পাতার মতো এখানেও সারির আকারটা হাতে লিখে
// দেওয়া হলো, নিচে একবার cast করা হয়েছে।
type AdminRow = {
    id: string;
    name: string | null;
    email: string | null;
};

type AdminLogRow = {
    id: string;
    admin_id: string | null;
    action: string;
    target_type: string | null;
    target_id: string | null;
    old_value: unknown;
    new_value: unknown;
    created_at: string;
};

type LoginRow = {
    id: string;
    user_id: string | null;
    user_type: string;
    success: boolean;
    failure_reason: string | null;
    ip_address: string | null;
    created_at: string;
};

/* ------------------------------ পাতা ------------------------------ */

export default async function AuditPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const { tab } = await searchParams;
    const activeTab = tab === "logins" ? "logins" : "actions";

    const db = supabaseAdmin();
    const since24h = new Date(Date.now() - 86400000).toISOString();

    const [
        { data: adminLogs },
        { data: logins },
        { data: admins },
        { count: actions24h },
        { count: failed24h },
    ] = await Promise.all([
        db.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(150),
        db.from("login_history").select("*").order("created_at", { ascending: false }).limit(150),
        db.from("platform_admins").select("id, name, email"),
        db.from("admin_logs").select("*", { count: "exact", head: true }).gte("created_at", since24h),
        db
            .from("login_history")
            .select("*", { count: "exact", head: true })
            .eq("success", false)
            .gte("created_at", since24h),
    ]);

    const adminList = (admins ?? []) as unknown as AdminRow[];
    const rows = (adminLogs ?? []) as unknown as AdminLogRow[];
    const loginRows = (logins ?? []) as unknown as LoginRow[];

    const adminById = new Map<string, AdminRow>(adminList.map((a) => [a.id, a]));

    // গত ২৪ ঘণ্টায় কে সবচেয়ে সক্রিয়
    const busiest = (() => {
        const counts = new Map<string, number>();
        rows
            .filter((r) => r.created_at >= since24h && r.admin_id)
            .forEach((r) => counts.set(r.admin_id!, (counts.get(r.admin_id!) ?? 0) + 1));
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        return top ? { name: adminById.get(top[0])?.name ?? "—", count: top[1] } : null;
    })();

    return (
        <div>
            <PageHeader
                title="অডিট রিপোর্ট"
                subtitle="কে কখন কী করেছে — সবই এখানে রেকর্ড হয়, মুছে ফেলা যায় না"
            />

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="২৪ ঘণ্টায় কার্যক্রম" value={actions24h ?? 0} icon="⚡" />
                <StatCard
                    label="২৪ ঘণ্টায় ব্যর্থ লগইন"
                    value={failed24h ?? 0}
                    hint={failed24h && failed24h > 5 ? "অস্বাভাবিক বেশি — দেখুন" : "স্বাভাবিক"}
                    tone={failed24h && failed24h > 5 ? "danger" : "default"}
                    icon="🔒"
                />
                <StatCard
                    label="সবচেয়ে সক্রিয় (২৪ ঘণ্টা)"
                    value={busiest?.name ?? "—"}
                    hint={busiest ? `${busiest.count} টি কাজ` : "কোনো কার্যক্রম নেই"}
                    icon="👤"
                />
                <StatCard label="সক্রিয় অ্যাডমিন" value={adminList.length} icon="👥" />
            </div>

            <div className="mb-4 flex gap-2 overflow-x-auto">
                {[
                    { key: "actions", label: "অ্যাডমিন কার্যক্রম", count: rows.length },
                    { key: "logins", label: "লগইন ইতিহাস", count: loginRows.length },
                ].map((t) => (
                    <Link
                        key={t.key}
                        href={`/admin/audit?tab=${t.key}`}
                        className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === t.key
                                ? "bg-slate-900 text-white"
                                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}
                    >
                        {t.label}
                        <span className="ml-2 text-xs opacity-60">{t.count}</span>
                    </Link>
                ))}
            </div>

            <Card>
                {activeTab === "actions" ? (
                    rows.length === 0 ? (
                        <EmptyState
                            icon="🕓"
                            title="কোনো কার্যক্রম রেকর্ড হয়নি"
                            message="অ্যাডমিন প্যানেলে কিছু করলে সাথে সাথে এখানে জমা হবে।"
                        />
                    ) : (
                        <Table head={["সময়", "অ্যাডমিন", "কাজ", "কিসের উপর", "বিস্তারিত"]}>
                            {rows.map((log) => {
                                const a = ACTIONS[log.action] ?? { label: log.action, tone: "default" as const };
                                const admin = log.admin_id ? adminById.get(log.admin_id) : null;
                                const before = summarize(log.old_value);
                                const after = summarize(log.new_value);
                                return (
                                    <tr key={log.id} className="align-top hover:bg-slate-50/60">
                                        <td className="whitespace-nowrap px-4 py-3" title={fullTime(log.created_at)}>
                                            <p className="text-slate-700">{timeAgo(log.created_at)}</p>
                                            <p className="text-[11px] text-slate-400">{fullTime(log.created_at)}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-slate-900">{admin?.name ?? "সিস্টেম"}</p>
                                            {admin?.email && (
                                                <p className="truncate text-[11px] text-slate-400">{admin.email}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge label={a.label} tone={a.tone} />
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {log.target_type ? (
                                                <>
                                                    <span>{TARGETS[log.target_type] ?? log.target_type}</span>
                                                    {log.target_id && (
                                                        <p className="font-mono text-[11px] text-slate-400">
                                                            {log.target_id.slice(0, 8)}
                                                        </p>
                                                    )}
                                                </>
                                            ) : (
                                                "—"
                                            )}
                                        </td>
                                        <td className="max-w-sm px-4 py-3 text-xs text-slate-500">
                                            {before && (
                                                <p className="truncate text-slate-400 line-through" title={before}>
                                                    {before}
                                                </p>
                                            )}
                                            {after ? (
                                                <p className="truncate" title={after}>
                                                    {after}
                                                </p>
                                            ) : (
                                                !before && "—"
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </Table>
                    )
                ) : loginRows.length === 0 ? (
                    <EmptyState icon="🔑" title="কোনো লগইন রেকর্ড নেই" />
                ) : (
                    <Table head={["সময়", "কে", "ধরন", "অবস্থা", "কারণ", "IP"]}>
                        {loginRows.map((l) => {
                            const admin = l.user_id ? adminById.get(l.user_id) : null;
                            return (
                                <tr key={l.id} className={`hover:bg-slate-50/60 ${l.success ? "" : "bg-red-50/30"}`}>
                                    <td className="whitespace-nowrap px-4 py-3" title={fullTime(l.created_at)}>
                                        <p className="text-slate-700">{timeAgo(l.created_at)}</p>
                                        <p className="text-[11px] text-slate-400">{fullTime(l.created_at)}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        {admin ? (
                                            <>
                                                <p className="font-medium text-slate-900">{admin.name}</p>
                                                <p className="truncate text-[11px] text-slate-400">{admin.email}</p>
                                            </>
                                        ) : (
                                            <span className="text-slate-400">অজানা</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {l.user_type === "admin" ? "অ্যাডমিন" : "অ্যাপ"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge label={l.success ? "সফল" : "ব্যর্থ"} tone={l.success ? "success" : "danger"} />
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {l.failure_reason ? FAIL_REASONS[l.failure_reason] ?? l.failure_reason : "—"}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">
                                        {l.ip_address ?? "—"}
                                    </td>
                                </tr>
                            );
                        })}
                    </Table>
                )}
            </Card>

            <p className="mt-4 text-xs text-slate-400">
                সর্বশেষ ১৫০টি রেকর্ড দেখানো হচ্ছে। অডিট লগ কখনো মুছে ফেলা যায় না — তাই কোনো
                কাজ নিয়ে প্রশ্ন উঠলে এখানেই প্রমাণ থাকবে।
            </p>
        </div>
    );
}
