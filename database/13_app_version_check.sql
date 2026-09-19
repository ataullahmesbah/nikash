-- =====================================================================
-- Nikash — 13_app_version_check.sql
--
-- অ্যাপের ভার্সন যাচাই।
--
-- ওয়েবে /admin/app-versions পেজ আগে থেকেই ছিল, টেবিলও ছিল — কিন্তু
-- অ্যাপ টেবিলটা কোনোদিন পড়ত না। ফলে APK বিতরণের পরে নতুন ভার্সন বের
-- করলে পুরনো ব্যবহারকারীরা জানতেই পারত না।
--
-- এখানে দুটো জিনিস:
--   ১. লগইনের আগেও যেন ভার্সন দেখা যায় (জরুরি আপডেট আটকে দিতে হলে
--      আগে লগইন করানোর মানে হয় না)
--   ২. সবচেয়ে নতুন ভার্সনটা এক কলে আনার ফাংশন
--
-- ভার্সন নম্বর ও APK লিংক এমনিতেই পাবলিক ডাউনলোড পেজে থাকে, তাই এতে
-- নতুন করে কিছু ফাঁস হচ্ছে না।
-- =====================================================================

drop policy if exists app_versions_read on public.app_versions;
create policy app_versions_read on public.app_versions
for select to authenticated, anon
using (true);

create index if not exists idx_app_versions_latest
  on public.app_versions(platform, build_number desc);


-- সবচেয়ে নতুন ভার্সন — build_number সবচেয়ে বড় যেটা
create or replace function public.latest_app_version(p_platform text default 'android')
returns table (
  version       text,
  build_number  integer,
  apk_url       text,
  release_notes text,
  force_update  boolean,
  min_supported text,
  file_size_mb  numeric,
  released_at   timestamptz
)
language sql stable security definer set search_path = public as $$
  select v.version, v.build_number, v.apk_url, v.release_notes,
         v.force_update, v.min_supported, v.file_size_mb, v.released_at
  from public.app_versions v
  where v.platform = p_platform
  order by v.build_number desc
  limit 1
$$;

revoke execute on function public.latest_app_version(text) from public;
grant  execute on function public.latest_app_version(text) to anon, authenticated;
