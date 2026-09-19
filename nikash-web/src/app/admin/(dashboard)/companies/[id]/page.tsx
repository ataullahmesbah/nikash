import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Badge, Card, COMPANY_STATUS, EmptyState, PageHeader, Table } from "@/components/ui";
import { SubscriptionPanel, StatusPanel } from "./_components/company-actions";

export const dynamic = "force-dynamic";

const TYPE_BN: Record<string, string> = { shop: "দোকান", warehouse: "গুদাম", vendor: "পরিবেশক" };

function taka(n: number | null | undefined) {
  return `৳${Math.round(Number(n ?? 0)).toLocaleString("en-BD")}`;
}
function fmt(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("en-GB") : "—";
}

type Usage = {
  total_sales: number; invoice_count: number; party_count: number;
  product_count: number; user_count: number; last_login: string | null;
};

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();

  const [{ data: company }, { data: usageRaw }, { data: payments }, { data: history }, { data: users }] =
    await Promise.all([
      db
        .from("companies")
        .select("*, plans(name_bn, price, duration_days)")
        .eq("id", id)
        .maybeSingle(),
      db.rpc("company_usage_stats", { p_company: id }),
      db
        .from("payment_requests")
        .select("id, amount, method, trx_id, status, requested_at")
        .eq("company_id", id)
        .order("requested_at", { ascending: false })
        .limit(20),
      db
        .from("subscription_history")
        .select("id, action, old_end, new_end, amount, note, created_at")
        .eq("company_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("users")
        .select("id, name, phone, role, is_active, created_at")
        .eq("company_id", id)
        .order("created_at", { ascending: true }),
    ]);

  if (!company) notFound();

  const usage = (usageRaw ?? {}) as Partial<Usage>;
  const st = COMPANY_STATUS[company.status] ?? { label: company.status, tone: "default" as const };
  const daysLeft = company.end_date
    ? Math.ceil((new Date(company.end_date).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div>
      <Link href="/admin/companies" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← কোম্পানি তালিকায় ফিরে যান
      </Link>

      <PageHeader
        title={company.name}
        subtitle={`${company.nikash_id} · ${company.phone ?? "—"} · ${company.district ?? "—"}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge label={st.label} tone={st.tone} />
            <Badge label={TYPE_BN[company.business_type] ?? company.business_type} tone="info" />
            {company.is_free && <Badge label="লাইফটাইম ফ্রি" tone="success" />}
          </div>
        }
      />

      {/* সারসংক্ষেপ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">মোট বিক্রয়</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{taka(usage.total_sales)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">চালান</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{usage.invoice_count ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">পার্টি / প্রোডাক্ট</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {usage.party_count ?? 0} / {usage.product_count ?? 0}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">সর্বশেষ লগইন</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {usage.last_login ? fmt(usage.last_login) : "কখনো না"}
          </p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* বাম: সাবস্ক্রিপশন ও স্ট্যাটাস */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">সাবস্ক্রিপশন</h2>

            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Info label="প্ল্যান" value={company.plans?.name_bn ?? "ট্রায়াল"} />
              <Info label="শুরু" value={fmt(company.start_date)} />
              <Info label="মেয়াদ শেষ" value={company.is_free ? "লাইফটাইম" : fmt(company.end_date)} />
              <Info
                label="বাকি দিন"
                value={company.is_free ? "—" : daysLeft !== null ? `${daysLeft} দিন` : "—"}
                tone={daysLeft !== null && daysLeft <= 7 ? "danger" : "default"}
              />
            </div>

            <SubscriptionPanel companyId={id} currentEnd={company.end_date} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">পেমেন্ট ইতিহাস</h2>
            {(payments ?? []).length === 0 ? (
              <EmptyState icon="💳" title="কোনো পেমেন্ট নেই" />
            ) : (
              <Table head={["পরিমাণ", "মাধ্যম", "TrxID", "অবস্থা", "তারিখ"]}>
                {(payments ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">{taka(p.amount)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.method}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.trx_id}</td>
                    <td className="px-4 py-2.5">
                      <Badge
                        label={p.status === "approved" ? "অনুমোদিত" : p.status === "rejected" ? "বাতিল" : "অপেক্ষমাণ"}
                        tone={p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : "warning"}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{fmt(p.requested_at)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">সাবস্ক্রিপশন ইতিহাস</h2>
            {(history ?? []).length === 0 ? (
              <EmptyState icon="📜" title="কোনো পরিবর্তন হয়নি" />
            ) : (
              <ol className="space-y-3">
                {(history ?? []).map((h) => (
                  <li key={h.id} className="flex gap-3 border-l-2 border-slate-200 pl-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {h.action === "extend" ? "মেয়াদ বাড়ানো" : h.action === "reduce" ? "মেয়াদ কমানো" : h.action}
                        {h.old_end && h.new_end ? ` — ${fmt(h.old_end)} → ${fmt(h.new_end)}` : ""}
                      </p>
                      {h.note && <p className="mt-0.5 text-xs text-slate-500">{h.note}</p>}
                      <p className="mt-0.5 text-xs text-slate-400">{fmt(h.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* ডান: স্ট্যাটাস, তথ্য, ইউজার */}
        <div className="space-y-6">
          <Card className="p-5">
            <StatusPanel companyId={id} currentStatus={company.status} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">ব্যবসার তথ্য</h2>
            <div className="space-y-2.5">
              <Info label="মালিক" value={company.owner_name ?? "—"} />
              <Info label="ফোন" value={company.phone ?? "—"} />
              <Info label="ইমেইল" value={company.email ?? "—"} />
              <Info label="ঠিকানা" value={company.address ?? "—"} />
              <Info label="জেলা" value={company.district ?? "—"} />
              <Info label="সর্বোচ্চ ইউজার" value={String(company.max_users)} />
              <Info label="সর্বোচ্চ ডিভাইস" value={String(company.max_devices)} />
              <Info label="যোগদান" value={fmt(company.created_at)} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              ব্যবহারকারী ({(users ?? []).length})
            </h2>
            {(users ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">কোনো ইউজার নেই</p>
            ) : (
              <ul className="space-y-2">
                {(users ?? []).map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{u.name}</p>
                      <p className="text-xs text-slate-500">
                        {u.phone} · {u.role}
                      </p>
                    </div>
                    <Badge label={u.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"} tone={u.is_active ? "success" : "default"} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, tone }: { label: string; value: string; tone?: "danger" | "default" }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${tone === "danger" ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}
