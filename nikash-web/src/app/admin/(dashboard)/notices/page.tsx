import { supabaseAdmin } from "@/lib/supabase/admin";
import { Badge, Card, EmptyState, PageHeader, Table } from "@/components/ui";
import AddNoticeForm from "./_components/add-notice-form";
import NoticeRowActions from "./_components/notice-row-actions";

export const dynamic = "force-dynamic";

const SEVERITY: Record<string, { label: string; tone: "info" | "warning" | "danger" }> = {
  info: { label: "তথ্য", tone: "info" },
  warning: { label: "সতর্কতা", tone: "warning" },
  critical: { label: "জরুরি", tone: "danger" },
};

const TYPE_BN: Record<string, string> = { shop: "দোকান", warehouse: "গুদাম", vendor: "পরিবেশক" };

function targetLabel(n: {
  company_id: string | null;
  business_type: string | null;
  target_company_ids: string[] | null;
  target_statuses: string[] | null;
}) {
  if (n.target_company_ids?.length) return `${n.target_company_ids.length}টি নির্দিষ্ট কোম্পানি`;
  if (n.company_id) return "১টি কোম্পানি";
  if (n.business_type) return TYPE_BN[n.business_type] ?? n.business_type;
  if (n.target_statuses?.length) return `স্ট্যাটাস: ${n.target_statuses.join(", ")}`;
  return "সব কোম্পানি";
}

/** এখন সত্যিই অ্যাপে দেখাচ্ছে কিনা — বন্ধ, মেয়াদ শেষ, নাকি চলছে */
function liveState(n: { is_active: boolean; start_at: string; end_at: string | null }) {
  if (!n.is_active) return { label: "বন্ধ", tone: "default" as const };
  if (n.end_at && new Date(n.end_at) < new Date()) return { label: "মেয়াদ শেষ", tone: "default" as const };
  if (new Date(n.start_at) > new Date()) return { label: "অপেক্ষমাণ", tone: "info" as const };
  return { label: "চলছে", tone: "success" as const };
}

export default async function NoticesPage() {
  const db = supabaseAdmin();

  const [{ data: notices }, { data: companies }, { data: reads }] = await Promise.all([
    db
      .from("notices")
      .select("id, title_bn, body_bn, severity, show_as, company_id, business_type, target_company_ids, target_statuses, start_at, end_at, created_at, is_active")
      // মুছে ফেলা নোটিশ তালিকায় দেখাব না (soft delete)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("companies").select("id, name, nikash_id, status, business_type").order("name"),
    db.from("notice_reads").select("notice_id"),
  ]);

  const readCount = new Map<string, number>();
  (reads ?? []).forEach((r) => readCount.set(r.notice_id, (readCount.get(r.notice_id) ?? 0) + 1));

  return (
    <div>
      <PageHeader title="নোটিশ" subtitle="কোম্পানিগুলোর অ্যাপে বার্তা পাঠান" />

      <div className="mb-6">
        <AddNoticeForm companies={companies ?? []} />
      </div>

      <Card>
        {(notices ?? []).length === 0 ? (
          <EmptyState icon="📢" title="কোনো নোটিশ পাঠানো হয়নি" />
        ) : (
          <Table head={["শিরোনাম", "অবস্থা", "গুরুত্ব", "কাদের", "ধরন", "পড়েছে", "তারিখ", ""]}>
            {(notices ?? []).map((n) => {
              const sev = SEVERITY[n.severity] ?? { label: n.severity, tone: "info" as const };
              const live = liveState(n);
              return (
                <tr key={n.id} className="hover:bg-slate-50">
                  <td className="max-w-xs px-4 py-3">
                    <p className="font-medium text-slate-900">{n.title_bn}</p>
                    {n.body_bn && <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{n.body_bn}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={live.label} tone={live.tone} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={sev.label} tone={sev.tone} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{targetLabel(n)}</td>
                  <td className="px-4 py-3 text-slate-600">{n.show_as === "popup" ? "পপআপ" : "ব্যানার"}</td>
                  <td className="px-4 py-3 text-slate-600">{readCount.get(n.id) ?? 0} জন</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {new Date(n.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3">
                    <NoticeRowActions
                      notice={{
                        id: n.id,
                        title_bn: n.title_bn,
                        body_bn: n.body_bn,
                        severity: n.severity,
                        show_as: n.show_as,
                        end_at: n.end_at,
                        is_active: n.is_active,
                      }}
                    />
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
