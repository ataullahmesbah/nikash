-- =====================================================================
-- 07_v2_edit_delete_more.sql
--
-- "আরও" মেনুর বাকি জিনিসগুলোতেও (খরচ, গাড়ি, রুট, ট্রিপ) এডিট ও ডিলিট।
-- 06 নম্বর ফাইলে deleted_at কলামগুলো যোগ হয়েছিল, কিন্তু তালিকা এখনো
-- মুছে ফেলা সারিও দেখাত — এখানে সেটাই ঠিক করা হচ্ছে।
--
-- বারবার চালালেও কিছু নষ্ট হবে না।
-- =====================================================================

-- ট্রিপেও সফট ডিলিট দরকার (06-এ বাদ পড়েছিল)
alter table public.vehicle_trips add column if not exists deleted_at timestamptz;


-- =====================================================================
-- ১) মুছে ফেলা সারি আর তালিকায় আসবে না
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['vehicles', 'routes', 'expenses', 'vehicle_trips'] loop
    execute format('drop policy if exists %1$s_select on public.%1$I;', t);
    execute format($p$
      create policy %1$s_select on public.%1$I
      for select to authenticated
      using (company_id = public.current_company_id() and deleted_at is null);
    $p$, t);
  end loop;
end $$;


-- =====================================================================
-- ২) এক ফাংশনেই সফট ডিলিট — টেবিলের নাম হোয়াইটলিস্ট করা
--
-- কেন হোয়াইটলিস্ট: p_table সরাসরি SQL-এ বসালে যেকোনো টেবিল মুছে ফেলা
-- যেত। তাই শুধু এই চারটার বাইরে কিছু এলে সাথে সাথে থেমে যায়।
-- =====================================================================

create or replace function public.soft_delete_row(p_table text, p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_count integer;
begin
  if p_table not in ('vehicles', 'routes', 'expenses', 'vehicle_trips') then
    raise exception 'এই ধরনের তথ্য এভাবে মোছা যায় না';
  end if;

  -- শুধু মালিক ও ম্যানেজার (UI-এর গার্ড যথেষ্ট নয়, RPC সরাসরিও ডাকা যায়)
  if not public.has_role(array['owner','manager']::user_role[]) then
    raise exception 'শুধু মালিক বা ম্যানেজার এই কাজটি করতে পারবেন';
  end if;

  execute format('select company_id from public.%I where id = $1', p_table)
    into v_company using p_id;

  if v_company is null then raise exception 'তথ্যটি পাওয়া যায়নি'; end if;
  if v_company <> public.current_company_id() then raise exception 'Forbidden'; end if;

  -- ট্রিপের খরচ ইতিমধ্যে খরচের খাতায় গেছে — সেটাও একসাথে সরাতে হবে,
  -- নইলে লাভ-ক্ষতির হিসাবে ভুতুড়ে খরচ থেকে যাবে।
  if p_table = 'vehicle_trips' then
    update public.expenses set deleted_at = now()
     where trip_id = p_id and deleted_at is null;
  end if;

  execute format('update public.%I set deleted_at = now() where id = $1 and deleted_at is null', p_table)
    using p_id;
  get diagnostics v_count = row_count;

  if v_count = 0 then return 'already_deleted'; end if;

  perform public.log_entity_change(p_table, p_id, 'delete', null, null, null);
  return 'deleted';
end $$;

revoke execute on function public.soft_delete_row(text, uuid) from public, anon;
grant  execute on function public.soft_delete_row(text, uuid) to authenticated;


-- =====================================================================
-- ৩) খরচ মুছলে দৈনিক সারাংশ আবার হিসাব হবে
-- =====================================================================

create or replace function public.trg_expense_soft_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    perform public.recalc_daily_summaries(new.company_id, new.entry_date);
  end if;
  return new;
end $$;

drop trigger if exists trg_expense_soft_delete on public.expenses;
create trigger trg_expense_soft_delete
after update of deleted_at on public.expenses
for each row execute function public.trg_expense_soft_delete();


-- =====================================================================
-- ৪) পার্টির সাথে কাজ বন্ধ / আবার চালু
--
-- যে দোকান বা সরবরাহকারীর সাথে আপাতত লেনদেন নেই, তাকে মুছে ফেলা ঠিক নয় —
-- পুরনো বিল, বাকি ও খাতা থেকে যেতে হবে। তাই 'closed' করে রাখি: তালিকায়
-- লাল দেখাবে, নতুন বিক্রয়/ক্রয়ের পিকারে আসবে না। আবার কাজ শুরু করলে
-- 'active' করলেই সবুজ হয়ে ফিরে আসবে।
-- =====================================================================

create or replace function public.set_party_status(
  p_party  uuid,
  p_status text,
  p_reason text default null
) returns text language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_old text; v_due numeric;
begin
  if p_status not in ('active', 'inactive', 'closed') then
    raise exception 'স্ট্যাটাস সঠিক নয়';
  end if;

  if not public.has_role(array['owner','manager']::user_role[]) then
    raise exception 'শুধু মালিক বা ম্যানেজার এই কাজটি করতে পারবেন';
  end if;

  select company_id, status into v_company, v_old
    from public.parties where id = p_party and deleted_at is null;

  if v_company is null then raise exception 'পার্টি পাওয়া যায়নি'; end if;
  if v_company <> public.current_company_id() then raise exception 'Forbidden'; end if;
  if v_old = p_status then return 'unchanged'; end if;

  update public.parties
     set status = p_status, updated_at = now(),
         business_end_date = case when p_status = 'closed' then current_date else null end
   where id = p_party;

  perform public.log_entity_change(
    'party', p_party, 'status_change',
    jsonb_build_object('status', v_old),
    jsonb_build_object('status', p_status),
    p_reason);

  -- বাকি থেকে গেলে ব্যবহারকারীকে জানিয়ে দিই — বন্ধ করলেই টাকা মাফ নয়
  if p_status <> 'active' then
    select coalesce(sum(due), 0) into v_due
      from public.sales where customer_id = p_party and status = 'posted';
    if v_due > 0 then
      return 'closed_with_due:' || v_due::text;
    end if;
  end if;

  return p_status;
end $$;

revoke execute on function public.set_party_status(uuid, text, text) from public, anon;
grant  execute on function public.set_party_status(uuid, text, text) to authenticated;


-- =====================================================================
-- END 07_v2_edit_delete_more.sql
-- =====================================================================
