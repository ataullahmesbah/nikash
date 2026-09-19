import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Badge, Card, EmptyState, PageHeader, StatCard, Table } from "@/components/ui";
import PaymentRowActions from "./_components/payment-row-actions";
import ManualPaymentForm from "./_components/manual-payment-form";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "requests", label: "যাচাই বাকি" },
  { key: "payments", label: "সব পেমেন্ট" },
  { key: "invoices", label: "ইনভয়েস" },
] as const;

const METHOD_BN: Record<string, string> = {
  bkash: "বিকাশ",
  nagad: "নগদ",
  rocket: "রকেট",
  bank: "ব্যাংক",
  cash: "ক্যাশ",
  cheque: "চেক",
};

const REQ_STATUS: Record<string, { label: string; tone: "warning" | "success" | "danger" }> = {
  pending: { label: "অপেক্ষমাণ", tone: "warning" },
  approved: { label: "অনুমোদিত", tone: "success" },
  rejected: { label: "বাতিল", tone: "danger" },
};

function taka(n: number | null | undefined) {
  return `৳${Number(n ?? 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function shortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

type Totals = { lifetime: number; this_month: number; last_month: number };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? (rawTab as string) : "requests";

  const db = supabaseAdmin();

  const [summaryRes, companiesRes, plansRes] = await Promise.all([
    db.rpc("finance_summary", { p_months: 6 }),
    db
      .from("companies")
      .select("id, name, nikash_id, end_date")
      .order("name")
      .limit(500),
    db.from("plans").select("id, name_bn, price, duration_days").eq("is_active", true).order("price"),
  ]);

  const summary = (summaryRes.data ?? {}) as {
    totals?: Totals;
    pending_requests?: { count: number; amount: number };
    unpaid_invoices?: { count: number; amount: number };
  };
  const totals = summary.totals ?? { lifetime: 0, this_month: 0, last_month: 0 };
  const pending = summary.pending_requests ?? { count: 0, amount: 0 };
  const unpaid = summary.unpaid_invoices ?? { count: 0, amount: 0 };

  const growth =
    totals.last_month > 0
      ? Math.round(((totals.this_month - totals.last_month) / totals.last_month) * 100)
      : null;

  return (
    <div>
      <PageHeader
        title="পেমেন্ট ও ইনভয়েস"
        subtitle="কোম্পানির সাবস্ক্রিপশন পেমেন্ট যাচাই, ম্যানুয়াল রেকর্ড ও ইনভয়েস"
        action={<ManualPaymentForm companies={companiesRes.data ?? []} plans={plansRes.data ?? []} />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="এই মাসের আয়"
          value={taka(totals.this_month)}
          hint={growth === null ? "গত মাসে আয় ছিল না" : `গত মাসের চেয়ে ${growth >= 0 ? "+" : ""}${growth}%`}
          tone={growth !== null && growth < 0 ? "warning" : "success"}
          icon="💰"
        />
        <StatCard label="মোট আয় (লাইফটাইম)" value={taka(totals.lifetime)} icon="📈" />
        <StatCard
          label="যাচাই বাকি"
          value={pending.count}
          hint={taka(pending.amount)}
          tone={pending.count > 0 ? "warning" : "default"}
          href="/admin/payments?tab=requests"
          icon="⏳"
        />
        <StatCard
          label="অপরিশোধিত ইনভয়েস"
          value={unpaid.count}
          hint={taka(unpaid.amount)}
          tone={unpaid.count > 0 ? "danger" : "default"}
          href="/admin/payments?tab=invoices"
          icon="🧾"
        />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/payments?tab=${t.key}`}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {t.label}
            {t.key === "requests" && pending.count > 0 && (
              <span className="ml-2 rounded-full bg-amber-400 px-1.5 text-xs text-slate-900">
                {pending.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      <Card>
        {tab === "requests" && <RequestsTable db={db} />}
        {tab === "payments" && <PaymentsTable db={db} />}
        {tab === "invoices" && <InvoicesTable db={db} />}
      </Card>
    </div>
  );
}

type Db = ReturnType<typeof supabaseAdmin>;

async function RequestsTable({ db }: { db: Db }) {
  const { data } = await db
    .from("payment_requests")
    .select("*, companies(name, nikash_id), plans(name_bn)")
    .order("requested_at", { ascending: false })
    .limit(100);

  const rows = data ?? [];
  if (rows.length === 0) {
    return <EmptyState icon="✅" title="কোনো পেমেন্ট রিকোয়েস্ট নেই" message="কোম্পানি অ্যাপ থেকে পেমেন্ট পাঠালে এখানে দেখা যাবে।" />;
  }

  return (
    <Table head={["কোম্পানি", "প্ল্যান", "টাকা", "মাধ্যম", "TrxID", "তারিখ", "স্ট্যাটাস", ""]}>
      {rows.map((r) => {
        const st = REQ_STATUS[r.status] ?? { label: r.status, tone: "warning" as const };
        return (
          <tr key={r.id} className="hover:bg-slate-50/60">
            <td className="px-4 py-3">
              <p className="font-medium text-slate-900">{r.companies?.name}</p>
              <p className="font-mono text-xs text-slate-400">{r.companies?.nikash_id}</p>
            </td>
            <td className="px-4 py-3 text-slate-600">{r.plans?.name_bn ?? "—"}</td>
            <td className="px-4 py-3 font-semibold text-slate-900">{taka(r.amount)}</td>
            <td className="px-4 py-3 text-slate-600">{METHOD_BN[r.method] ?? r.method}</td>
            <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.trx_id}</td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{shortDate(r.requested_at)}</td>
            <td className="px-4 py-3">
              <Badge label={st.label} tone={st.tone} />
              {r.reject_reason && <p className="mt-1 text-xs text-slate-400">{r.reject_reason}</p>}
            </td>
            <td className="px-4 py-3">{r.status === "pending" && <PaymentRowActions requestId={r.id} />}</td>
          </tr>
        );
      })}
    </Table>
  );
}

async function PaymentsTable({ db }: { db: Db }) {
  const { data } = await db
    .from("platform_payments")
    .select("*, companies(name, nikash_id), platform_invoices(invoice_no)")
    .order("created_at", { ascending: false })
    .limit(150);

  const rows = data ?? [];
  if (rows.length === 0) {
    return <EmptyState icon="💳" title="এখনো কোনো পেমেন্ট নেই" message="অনুমোদিত বা ম্যানুয়াল পেমেন্ট এখানে জমা হবে।" />;
  }

  return (
    <Table head={["কোম্পানি", "ইনভয়েস", "টাকা", "মাধ্যম", "TrxID", "তারিখ"]}>
      {rows.map((p) => (
        <tr key={p.id} className="hover:bg-slate-50/60">
          <td className="px-4 py-3">
            <Link href={`/admin/companies/${p.company_id}`} className="font-medium text-slate-900 hover:underline">
              {p.companies?.name}
            </Link>
            <p className="font-mono text-xs text-slate-400">{p.companies?.nikash_id}</p>
          </td>
          <td className="px-4 py-3 font-mono text-xs text-slate-500">
            {p.platform_invoices?.invoice_no ?? "—"}
          </td>
          <td className="px-4 py-3 font-semibold text-emerald-600">{taka(p.amount)}</td>
          <td className="px-4 py-3 text-slate-600">{METHOD_BN[p.method] ?? p.method}</td>
          <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.trx_id ?? "—"}</td>
          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{shortDate(p.created_at)}</td>
        </tr>
      ))}
    </Table>
  );
}

async function InvoicesTable({ db }: { db: Db }) {
  const { data } = await db
    .from("platform_invoices")
    .select("*, companies(name, nikash_id), plans(name_bn)")
    .order("issued_at", { ascending: false })
    .limit(150);

  const rows = data ?? [];
  if (rows.length === 0) {
    return <EmptyState icon="🧾" title="কোনো ইনভয়েস নেই" message="ম্যানুয়াল পেমেন্ট তুললে ইনভয়েস নিজে থেকে তৈরি হয়।" />;
  }

  const statusTone: Record<string, "success" | "warning" | "default"> = {
    paid: "success",
    unpaid: "warning",
    cancelled: "default",
  };
  const statusLabel: Record<string, string> = {
    paid: "পরিশোধিত",
    unpaid: "অপরিশোধিত",
    cancelled: "বাতিল",
  };

  return (
    <Table head={["ইনভয়েস", "কোম্পানি", "মেয়াদকাল", "মোট", "স্ট্যাটাস", "ইস্যু"]}>
      {rows.map((inv) => (
        <tr key={inv.id} className="hover:bg-slate-50/60">
          <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{inv.invoice_no}</td>
          <td className="px-4 py-3">
            <Link href={`/admin/companies/${inv.company_id}`} className="font-medium text-slate-900 hover:underline">
              {inv.companies?.name}
            </Link>
            <p className="font-mono text-xs text-slate-400">{inv.companies?.nikash_id}</p>
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
            {shortDate(inv.period_start)} → {shortDate(inv.period_end)}
          </td>
          <td className="px-4 py-3 font-semibold text-slate-900">{taka(inv.total)}</td>
          <td className="px-4 py-3">
            <Badge label={statusLabel[inv.status] ?? inv.status} tone={statusTone[inv.status] ?? "default"} />
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{shortDate(inv.issued_at)}</td>
        </tr>
      ))}
    </Table>
  );
}
