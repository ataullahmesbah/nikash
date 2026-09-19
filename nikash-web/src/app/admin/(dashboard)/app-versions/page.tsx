import { supabaseAdmin } from "@/lib/supabase/admin";
import AddVersionForm from "./_components/add-version-form";
import VersionRowActions from "./_components/version-row-actions";

export const dynamic = "force-dynamic";

export default async function AppVersionsPage() {
  const db = supabaseAdmin();
  const { data: versions } = await db
    .from("app_versions")
    .select("*")
    .order("build_number", { ascending: false });

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900">অ্যাপ ভার্সন</h1>
        <p className="mt-1 text-sm text-slate-500">
          APK Play Store-এ নেই, তাই নিজে থেকে আপডেট হয় না। এখানে নতুন ভার্সন
          যোগ করলে ব্যবহারকারীর অ্যাপে আপডেটের খবর যাবে।
        </p>
      </div>

      <div className="mb-6">
        <AddVersionForm />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3">ভার্সন</th>
              <th className="px-4 py-3">বিল্ড</th>
              <th className="px-4 py-3">সাইজ</th>
              <th className="px-4 py-3">সর্বনিম্ন সমর্থিত</th>
              <th className="px-4 py-3">জরুরি</th>
              <th className="px-4 py-3">প্রকাশিত</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(versions ?? []).map((v, i) => (
              <tr key={v.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-900">{v.version}</span>
                  {i === 0 && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      সর্বশেষ
                    </span>
                  )}
                  {v.release_notes && (
                    <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-slate-400">
                      {v.release_notes}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{v.build_number}</td>
                <td className="px-4 py-3 text-slate-600">{v.file_size_mb ? `${v.file_size_mb} MB` : "—"}</td>
                <td className="px-4 py-3 text-slate-600">{v.min_supported ?? "—"}</td>
                <td className="px-4 py-3">
                  {v.force_update ? (
                    <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">হ্যাঁ</span>
                  ) : (
                    <span className="text-slate-400">না</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {new Date(v.released_at).toLocaleDateString("bn-BD")}
                </td>
                <td className="px-4 py-3">
                  <VersionRowActions
                    version={{
                      id: v.id,
                      version: v.version,
                      build_number: v.build_number,
                      apk_url: v.apk_url,
                      file_size_mb: v.file_size_mb,
                      release_notes: v.release_notes,
                      min_supported: v.min_supported,
                      force_update: v.force_update,
                    }}
                  />
                </td>
              </tr>
            ))}
            {(versions ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  এখনো কোনো ভার্সন প্রকাশিত হয়নি
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
