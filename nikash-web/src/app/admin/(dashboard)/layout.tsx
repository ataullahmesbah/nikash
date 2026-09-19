import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import AdminNav from "./_components/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <AdminNav name={session.name} role={session.role} />
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
