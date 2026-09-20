import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AdminNav from "./_components/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  // সেশন কুকিতে ইমেইল রাখা হয় না (যত কম তথ্য তত ভালো), তাই সাইডবারে
  // দেখানোর জন্য এখানে একবার তুলে নিই।
  const { data: admin } = await supabaseAdmin()
    .from("platform_admins")
    .select("email")
    .eq("id", session.adminId)
    .maybeSingle();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <AdminNav name={session.name} role={session.role} email={admin?.email ?? undefined} />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
