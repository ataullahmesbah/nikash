import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "logins" ? "logins" : "actions";

  const db = supabaseAdmin();

  const [{ data: adminLogs }, { data: logins }, { data: admins }] = await Promise.all([
    db
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("login_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("platform_admins").select("id, name"),
  ]);

  const adminName = (id: string | null) => admins?.find((a) => a.id === id)?.name ?? "—";

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">অডিট রিপোর্ট</h1>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <a
          href="/admin/audit?tab=actions"
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "actions"
              ? "border-b-2 border-slate-900 text-slate-900"
              : "text-slate-500"
          }`}
        >
          অ্যাডমিন কার্যক্রম
        </a>
        <a
          href="/admin/audit?tab=logins"
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "logins"
              ? "border-b-2 border-slate-900 text-slate-900"
              : "text-slate-500"
          }`}
        >
          লগইন ইতিহাস
        </a>
      </div>

      {activeTab === "actions" ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3">সময়</th>
                <th className="px-4 py-3">অ্যাডমিন</th>
                <th className="px-4 py-3">কাজ</th>
                <th className="px-4 py-3">টার্গেট</th>
                <th className="px-4 py-3">বিবরণ</th>
              </tr>
            </thead>
            <tbody>
              {(adminLogs ?? []).map((log) => (
                <tr key={log.id} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {new Date(log.created_at).toLocaleString("bn-BD")}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{adminName(log.admin_id)}</td>
                  <td className="px-4 py-3 text-slate-700">{log.action}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {log.target_type ? `${log.target_type}${log.target_id ? ` · ${log.target_id.slice(0, 8)}` : ""}` : "—"}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-400">
                    {log.new_value ? JSON.stringify(log.new_value) : "—"}
                  </td>
                </tr>
              ))}
              {(adminLogs ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    কোনো অ্যাডমিন কার্যক্রম রেকর্ড হয়নি
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3">সময়</th>
                <th className="px-4 py-3">ধরন</th>
                <th className="px-4 py-3">অবস্থা</th>
                <th className="px-4 py-3">কারণ</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {(logins ?? []).map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {new Date(l.created_at).toLocaleString("bn-BD")}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{l.user_type}</td>
                  <td className="px-4 py-3">
                    {l.success ? (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        সফল
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                        ব্যর্থ
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{l.failure_reason ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{l.ip_address ?? "—"}</td>
                </tr>
              ))}
              {(logins ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    কোনো লগইন রেকর্ড নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
