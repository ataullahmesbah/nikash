import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Badge, Card, EmptyState, PageHeader, Table } from "@/components/ui";
import UserActions from "./user-actions";
import AddAdminForm from "./add-admin-form";

export const dynamic = "force-dynamic";

const ROLE_BN: Record<string, { label: string; tone: "info" | "success" | "default" }> = {
  super_admin: { label: "সুপার অ্যাডমিন", tone: "success" },
  support_admin: { label: "সাপোর্ট অ্যাডমিন", tone: "info" },
};

const PERMISSIONS = [
  { resource: "কোম্পানি", super: "সব", support: "দেখা ও সম্পাদনা" },
  { resource: "পেমেন্ট", super: "সব", support: "শুধু দেখা" },
  { resource: "নোটিশ", super: "সব", support: "তৈরি ও পাঠানো" },
  { resource: "অ্যাডমিন ব্যবস্থাপনা", super: "সব", support: "নেই" },
  { resource: "সেটিংস", super: "সব", support: "নেই" },
  { resource: "রিপোর্ট", super: "সব", support: "দেখা" },
];

export default async function UsersPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const db = supabaseAdmin();
  const { data: admins } = await db
    .from("platform_admins")
    .select("id, name, email, role, is_active, is_2fa_enabled, last_login_at, created_at")
    .order("created_at", { ascending: true });

  const isSuper = session.role === "super_admin";

  return (
    <div>
      <PageHeader
        title="ব্যবহারকারী ও রোল"
        subtitle="প্ল্যাটফর্ম অ্যাডমিন ব্যবস্থাপনা ও অনুমতি"
        action={isSuper ? <AddAdminForm /> : undefined}
      />

      {!isSuper && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          শুধু সুপার অ্যাডমিন নতুন অ্যাডমিন যোগ বা সম্পাদনা করতে পারেন।
        </div>
      )}

      <Card className="mb-6">
        {(admins ?? []).length === 0 ? (
          <EmptyState icon="👥" title="কোনো অ্যাডমিন নেই" />
        ) : (
          <Table head={["নাম", "ইমেইল", "রোল", "2FA", "সর্বশেষ লগইন", "অবস্থা", ""]}>
            {(admins ?? []).map((a) => {
              const r = ROLE_BN[a.role] ?? { label: a.role, tone: "default" as const };
              return (
                <tr key={a.id} className={`hover:bg-slate-50 ${a.is_active ? "" : "opacity-50"}`}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {a.name}
                    {a.id === session.adminId && <span className="ml-2 text-xs text-slate-400">(আপনি)</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.email}</td>
                  <td className="px-4 py-3">
                    <Badge label={r.label} tone={r.tone} />
                  </td>
                  <td className="px-4 py-3">
                    {a.is_2fa_enabled ? (
                      <Badge label="চালু" tone="success" />
                    ) : (
                      <Badge label="বন্ধ" tone="default" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {a.last_login_at ? new Date(a.last_login_at).toLocaleDateString("en-GB") : "কখনো না"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={a.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"} tone={a.is_active ? "success" : "danger"} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isSuper && a.id !== session.adminId && (
                      <UserActions id={a.id} name={a.name} role={a.role} isActive={a.is_active} />
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">রোল অনুযায়ী অনুমতি</h2>
        <p className="mb-4 text-xs text-slate-500">
          অনুমতি সার্ভার-সাইডে প্রতিটি API রুটে যাচাই হয় — শুধু মেনু লুকিয়ে রাখা নয়।
        </p>
        <Table head={["রিসোর্স", "সুপার অ্যাডমিন", "সাপোর্ট অ্যাডমিন"]}>
          {PERMISSIONS.map((p) => (
            <tr key={p.resource}>
              <td className="px-4 py-2.5 font-medium text-slate-800">{p.resource}</td>
              <td className="px-4 py-2.5 text-emerald-700">{p.super}</td>
              <td className="px-4 py-2.5 text-slate-600">{p.support}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
