-- =====================================================================
-- Nikash — 11_fix_unpost_and_notices.sql
--
-- ১) 'column "doc_type" does not exist' বাগ — পোস্ট করা চালান
--    সম্পাদনা করতে গেলে আটকে যেত।
-- ২) নোটিশ চালু/বন্ধ, সম্পাদনা ও মুছে ফেলার ব্যবস্থা।
--
-- পুরোটাই idempotent — একাধিকবার চালালেও সমস্যা নেই।
-- =====================================================================


-- ---------------------------------------------------------------------
-- ১) unpost_sale / unpost_purchase — কলামের নাম ও টাকার হিসাব
--
-- payment_allocations টেবিলে কলাম দুটোর নাম invoice_type / invoice_id,
-- কিন্তু ০৬ নম্বর ফাইলে ভুল করে doc_type / doc_id লেখা হয়েছিল। ফলে
-- "✏️ সম্পাদনা করুন" চাপলেই Postgres থামিয়ে দিত।
--
-- সাথে দ্বিতীয় ভুলটাও ঠিক করা হলো: শুধু allocation মুছে দিলে চালানের
-- 'পরিশোধিত' আর 'বাকি' আগের জায়গাতেই থেকে যেত — অর্থাৎ টাকাটা কোথাও
-- হিসাবে থাকত না। এখন আনপোস্ট করলে টাকা চালান থেকে ছেড়ে দিয়ে পার্টির
-- জমা (অ্যাডভান্স) হিসেবে থেকে যায়, আর বাকি পুরো অঙ্কে ফিরে আসে।
-- ---------------------------------------------------------------------

-- একটা চালানের সব allocation ছাড়িয়ে টাকা ফেরত দেয় (ভেতরের কাজ)
create or replace function public.unallocate_document(
  p_invoice_type text, p_invoice uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  for a in
    select * from public.payment_allocations
    where invoice_type = p_invoice_type and invoice_id = p_invoice
  loop
    if a.invoice_type = 'sale' then
      update public.sales
         set paid = greatest(0, paid - a.amount),
             due  = due + a.amount
       where id = a.invoice_id;
    else
      update public.purchases
         set paid = greatest(0, paid - a.amount),
             due  = due + a.amount
       where id = a.invoice_id;
    end if;
  end loop;

  delete from public.payment_allocations
   where invoice_type = p_invoice_type and invoice_id = p_invoice;
end $$;

revoke execute on function public.unallocate_document(text, uuid)
  from public, anon, authenticated;


create or replace function public.unpost_sale(p_sale uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.sales where id = p_sale for update;
  if not found then raise exception 'Sale not found'; end if;
  if s.company_id <> public.current_company_id() then raise exception 'Forbidden'; end if;

  -- শুধু মালিক ও ম্যানেজার — বিক্রয়কর্মী যেন পোস্ট করা বিল আনপোস্ট করে
  -- হিসাব বদলে ফেলতে না পারে। UI-এর গার্ড যথেষ্ট নয়, RPC সরাসরিও ডাকা যায়।
  if not public.has_role(array['owner','manager']::user_role[]) then
    raise exception 'শুধু মালিক বা ম্যানেজার এই কাজটি করতে পারবেন';
  end if;
  if s.status <> 'posted' then raise exception 'Only posted sales can be unposted'; end if;

  if exists (
    select 1 from public.company_settings cs
    where cs.company_id = s.company_id and cs.closed_through is not null
      and s.entry_date <= cs.closed_through
  ) then
    raise exception 'Month is closed for this date';
  end if;

  -- স্টক ফেরত: উল্টো মুভমেন্ট
  insert into public.stock_movements(
    id, company_id, location_id, variant_id, movement_type, qty_base,
    ref_type, ref_id, batch_id, unit_cost, avg_cost_after, entry_date, created_by)
  select
    gen_random_uuid(), m.company_id, m.location_id, m.variant_id, 'adjustment',
    -1 * m.qty_base, 'sale_edit', s.id, m.batch_id, m.unit_cost, m.unit_cost,
    current_date, auth.uid()
  from public.stock_movements m
  where m.ref_type = 'sale' and m.ref_id = s.id;

  -- ✅ ঠিক করা: কলামের নাম invoice_type / invoice_id, আর টাকাটা
  -- চালান থেকে ছেড়ে দিয়ে বাকি পুরো অঙ্কে ফিরিয়ে দেওয়া হয়
  perform public.unallocate_document('sale', p_sale);

  update public.sales
     set status = 'draft',
         posted_at = null,
         edited_at = now(),
         edit_count = edit_count + 1
   where id = p_sale;

  perform public.log_entity_change('sale', p_sale, 'unpost',
    jsonb_build_object('status','posted','total',s.total), null, p_reason);

  perform public.recalc_daily_summaries(s.company_id, s.entry_date);
end $$;


create or replace function public.unpost_purchase(p_purchase uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.purchases where id = p_purchase for update;
  if not found then raise exception 'Purchase not found'; end if;
  if p.company_id <> public.current_company_id() then raise exception 'Forbidden'; end if;

  if not public.has_role(array['owner','manager']::user_role[]) then
    raise exception 'শুধু মালিক বা ম্যানেজার এই কাজটি করতে পারবেন';
  end if;
  if p.status <> 'posted' then raise exception 'Only posted purchases can be unposted'; end if;

  if exists (
    select 1 from public.company_settings cs
    where cs.company_id = p.company_id and cs.closed_through is not null
      and p.entry_date <= cs.closed_through
  ) then
    raise exception 'Month is closed for this date';
  end if;

  insert into public.stock_movements(
    id, company_id, location_id, variant_id, movement_type, qty_base,
    ref_type, ref_id, batch_id, unit_cost, avg_cost_after, entry_date, created_by)
  select
    gen_random_uuid(), m.company_id, m.location_id, m.variant_id, 'adjustment',
    -1 * m.qty_base, 'purchase_edit', p.id, m.batch_id, m.unit_cost, m.unit_cost,
    current_date, auth.uid()
  from public.stock_movements m
  where m.ref_type = 'purchase' and m.ref_id = p.id;

  -- ✅ ঠিক করা (উপরের মতোই)
  perform public.unallocate_document('purchase', p_purchase);

  update public.purchases
     set status = 'draft',
         posted_at = null,
         edited_at = now(),
         edit_count = edit_count + 1
   where id = p_purchase;

  perform public.log_entity_change('purchase', p_purchase, 'unpost',
    jsonb_build_object('status','posted','total',p.total), null, p_reason);

  perform public.recalc_daily_summaries(p.company_id, p.entry_date);
end $$;

revoke execute on function public.unpost_sale(uuid, text) from public, anon;
revoke execute on function public.unpost_purchase(uuid, text) from public, anon;
grant execute on function public.unpost_sale(uuid, text) to authenticated;
grant execute on function public.unpost_purchase(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- ২) নোটিশ — চালু/বন্ধ, সম্পাদনা, মুছে ফেলা
--
-- ভুল নোটিশ পাঠিয়ে ফেললে এখন আর আটকে থাকতে হবে না:
--   • is_active  — এক ক্লিকে বন্ধ/চালু (ডেটা থেকে যায়)
--   • deleted_at — মুছে ফেলা (soft delete; ইতিহাসে থাকে, কোথাও দেখায় না)
-- ---------------------------------------------------------------------
alter table public.notices add column if not exists is_active  boolean not null default true;
alter table public.notices add column if not exists deleted_at timestamptz;

create index if not exists idx_notices_live
  on public.notices(is_active, start_at, end_at)
  where deleted_at is null;

-- অ্যাপ যেন বন্ধ বা মুছে ফেলা নোটিশ আর না দেখায়।
-- বাকি শর্তগুলো ০৬ নম্বর ফাইলের নীতির হুবহু, শুধু উপরে দুটো শর্ত যোগ।
drop policy if exists notices_read on public.notices;
create policy notices_read on public.notices
for select to authenticated
using (
  deleted_at is null
  and is_active
  -- কোম্পানি টার্গেটিং: একক company_id, অথবা তালিকা, অথবা সবাই
  and (
    company_id is null
    and (target_company_ids is null or array_length(target_company_ids, 1) is null)
    or company_id = public.current_company_id()
    or public.current_company_id() = any(coalesce(target_company_ids, array[]::uuid[]))
  )
  -- ব্যবসার ধরন
  and (business_type is null or business_type = (
        select business_type from public.companies where id = public.current_company_id()))
  -- স্ট্যাটাস টার্গেটিং
  and (
    target_statuses is null or array_length(target_statuses, 1) is null
    or (select status::text from public.companies where id = public.current_company_id())
         = any(target_statuses)
  )
  and start_at <= now()
  and (end_at is null or end_at >= now())
);
