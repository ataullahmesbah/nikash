import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Badge, Card, COMPANY_STATUS, EmptyState, PageHeader, Table } from "@/components/ui";
import CompanyFilters from "./company-filters";

export const dynamic = "force-dynamic";

const TYPE_BN: Record<string, string> = { shop: "দোকান", warehouse: "গুদাম", vendor: "পরিবেশক" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; expiring?: string }>;
}) {
  const sp = await searchParams;
  const db = supabaseAdmin();

  let query = db
    .from("companies")
    .select("id, name, nikash_id, business_type, status, end_date, phone, district, created_at, is_free")
    .order("created_at", { ascending: false })
    .limit(200);

  if (sp.status) query = query.eq("status", sp.status);
  if (sp.type) query = query.eq("business_type", sp.type);
  if (sp.q) {
    const q = sp.q.trim();
    query = query.or(`name.ilike.%${q}%,nikash_id.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  if (sp.expiring === "1") {
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    query = query.lte("end_date", in7).eq("is_free", false);
  }

  const { data: companies } = await query;
  const rows = companies ?? [];

  return (
    <div>
      <PageHeader title="কোম্পানি" subtitle={`${rows.length} টি কোম্পানি দেখানো হচ্ছে`} />

      <div className="mb-4">
        <CompanyFilters />
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon="🏢" title="কোনো কোম্পানি পাওয়া যায়নি" message="ফিল্টার বদলে আবার চেষ্টা করুন।" />
        ) : (
          <Table head={["নাম", "ID", "ধরন", "স্ট্যাটাস", "ফোন", "মেয়াদ শেষ", "বাকি", ""]}>
            {rows.map((c) => {
              const st = COMPANY_STATUS[c.status] ?? { label: c.status, tone: "default" as const };
              const days = c.end_date
                ? Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000)
                : null;
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/companies/${c.id}`} className="font-medium text-slate-900 hover:underline">
                      {c.name}
                    </Link>
                    {c.district && <p className="text-xs text-slate-400">{c.district}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.nikash_id}</td>
                  <td className="px-4 py-3 text-slate-600">{TYPE_BN[c.business_type] ?? c.business_type}</td>
                  <td className="px-4 py-3">
                    <Badge label={st.label} tone={st.tone} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.is_free ? "লাইফটাইম" : c.end_date ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.is_free ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : days !== null ? (
                      <Badge
                        label={days <= 0 ? "শেষ" : `${days} দিন`}
                        tone={days <= 0 ? "danger" : days <= 7 ? "warning" : "default"}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/companies/${c.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      বিস্তারিত
                    </Link>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
