-- =====================================================================
-- 06_v2_edit_delete_audit.sql
-- Nikash v2 — এডিট/ডিলিট/অডিট, বাকির হিসাব, নোটিশ টার্গেটিং,
-- সাবস্ক্রিপশন মেয়াদ কমানো, প্ল্যাটফর্ম সেটিংস, রোল ব্যবস্থাপনা।
--
-- 05_security_and_feature_fixes.sql চালানোর পর এটা চালাতে হবে।
-- =====================================================================


-- =====================================================================
-- SECTION 1 — অডিট ট্রেইল (কে কখন কী বদলালো)
-- =====================================================================

create table if not exists public.entity_audit_log (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  entity_type  text not null,          -- sale, purchase, party, product, expense...
  entity_id    uuid not null,
  action       text not null,          -- create, update, delete, void, restore
  old_value    jsonb,
  new_value    jsonb,
  reason       text,
  user_id      uuid references public.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists idx_audit_company on public.entity_audit_log(company_id, created_at desc);
create index if not exists idx_audit_entity  on public.entity_audit_log(entity_type, entity_id);

alter table public.entity_audit_log enable row level security;

drop policy if exists entity_audit_select on public.entity_audit_log;
create policy entity_audit_select on public.entity_audit_log
for select to authenticated
using (company_id = public.current_company_id());

drop policy if exists entity_audit_insert on public.entity_audit_log;
create policy entity_audit_insert on public.entity_audit_log
for insert to authenticated
with check (company_id = public.current_company_id());


-- সহায়ক ফাংশন — যেকোনো জায়গা থেকে অডিট লেখা
create or replace function public.log_entity_change(
  p_entity_type text,
  p_entity_id   uuid,
  p_action      text,
  p_old         jsonb default null,
  p_new         jsonb default null,
  p_reason      text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.entity_audit_log(
    company_id, entity_type, entity_id, action, old_value, new_value, reason, user_id)
  values (
    public.current_company_id(), p_entity_type, p_entity_id, p_action, p_old, p_new, p_reason, auth.uid());
end $$;

revoke execute on function public.log_entity_change(text, uuid, text, jsonb, jsonb, text)
  from public, anon;
grant execute on function public.log_entity_change(text, uuid, text, jsonb, jsonb, text)
  to authenticated;


-- =====================================================================
-- SECTION 2 — সফট ডিলিট কলাম
-- =====================================================================

alter table public.parties            add column if not exists deleted_at timestamptz;
alter table public.products           add column if not exists deleted_at timestamptz;
alter table public.product_variants   add column if not exists deleted_at timestamptz;
alter table public.expenses           add column if not exists deleted_at timestamptz;
alter table public.payments           add column if not exists deleted_at timestamptz;
alter table public.vehicles           add column if not exists deleted_at timestamptz;
alter table public.routes             add column if not exists deleted_at timestamptz;

-- এডিট ট্র্যাকিং
alter table public.sales     add column if not exists edited_at timestamptz;
alter table public.sales     add column if not exists edit_count integer not null default 0;
alter table public.purchases add column if not exists edited_at timestamptz;
alter table public.purchases add column if not exists edit_count integer not null default 0;


-- =====================================================================
-- SECTION 3 — পোস্ট করা ডকুমেন্ট এডিট (Tally-স্টাইল: reverse + recreate)
--
-- পোস্ট করা চালান সরাসরি বদলানো যায় না (স্টক ও হিসাব ইতিমধ্যে নড়ে গেছে)।
-- তাই প্রথমে void করে স্টক ফেরত নেওয়া হয়, তারপর একই id-তে নতুন মান বসিয়ে
-- আবার draft-এ নামানো হয় — ক্লায়েন্ট এরপর নতুন লাইন লিখে আবার post করবে।
-- =====================================================================

create or replace function public.unpost_sale(p_sale uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.sales where id = p_sale for update;
  if not found then raise exception 'Sale not found'; end if;
  if s.company_id <> public.current_company_id() then raise exception 'Forbidden'; end if;
  -- শুধু মালিক ও ম্যানেজার — বিক্রয়কর্মী যেন পোস্ট করা বিল বা পার্টি/পণ্য
  -- মুছে বা আনপোস্ট করে হিসাব বদলে ফেলতে না পারে। UI-এর গার্ড যথেষ্ট নয়,
  -- কারণ RPC সরাসরিও ডাকা যায়।
  if not public.has_role(array['owner','manager']::user_role[]) then
    raise exception 'শুধু মালিক বা ম্যানেজার এই কাজটি করতে পারবেন';
  end if;
  if s.status <> 'posted' then raise exception 'Only posted sales can be unposted'; end if;

  -- মাস বন্ধ থাকলে আটকাবে
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

  -- পেমেন্ট allocation ছাড়ানো
  delete from public.payment_allocations where doc_type = 'sale' and doc_id = s.id;

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
  -- শুধু মালিক ও ম্যানেজার — বিক্রয়কর্মী যেন পোস্ট করা বিল বা পার্টি/পণ্য
  -- মুছে বা আনপোস্ট করে হিসাব বদলে ফেলতে না পারে। UI-এর গার্ড যথেষ্ট নয়,
  -- কারণ RPC সরাসরিও ডাকা যায়।
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

  delete from public.payment_allocations where doc_type = 'purchase' and doc_id = p.id;

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


-- =====================================================================
-- SECTION 4 — ড্রাফট ডকুমেন্ট ডিলিট
-- =====================================================================

create or replace function public.delete_draft_document(p_table text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_status text;
begin
  if p_table = 'sale' then
    select company_id, status into v_company, v_status from public.sales where id = p_id;
  elsif p_table = 'purchase' then
    select company_id, status into v_company, v_status from public.purchases where id = p_id;
  else
    raise exception 'Unsupported table';
  end if;

  if v_company is null then raise exception 'Not found'; end if;
  if v_company <> public.current_company_id() then raise exception 'Forbidden'; end if;
  -- শুধু মালিক ও ম্যানেজার — বিক্রয়কর্মী যেন পোস্ট করা বিল বা পার্টি/পণ্য
  -- মুছে বা আনপোস্ট করে হিসাব বদলে ফেলতে না পারে। UI-এর গার্ড যথেষ্ট নয়,
  -- কারণ RPC সরাসরিও ডাকা যায়।
  if not public.has_role(array['owner','manager']::user_role[]) then
    raise exception 'শুধু মালিক বা ম্যানেজার এই কাজটি করতে পারবেন';
  end if;
  if v_status <> 'draft' then raise exception 'Only drafts can be deleted'; end if;

  perform public.log_entity_change(p_table, p_id, 'delete', null, null, 'draft deleted');

  if p_table = 'sale' then
    delete from public.sale_items where sale_id = p_id;
    delete from public.sales where id = p_id;
  else
    delete from public.purchase_items where purchase_id = p_id;
    delete from public.purchases where id = p_id;
  end if;
end $$;

revoke execute on function public.delete_draft_document(text, uuid) from public, anon;
grant execute on function public.delete_draft_document(text, uuid) to authenticated;


-- =====================================================================
-- SECTION 5 — পার্টি/প্রোডাক্ট নিরাপদ ডিলিট
-- বাকি বা লেনদেন থাকলে ডিলিট হবে না — তখন শুধু নিষ্ক্রিয় করা যাবে।
-- =====================================================================

create or replace function public.delete_party(p_party uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_has_txn boolean; v_balance numeric;
begin
  select company_id into v_company from public.parties where id = p_party;
  if v_company is null then raise exception 'Party not found'; end if;
  if v_company <> public.current_company_id() then raise exception 'Forbidden'; end if;
  -- শুধু মালিক ও ম্যানেজার — বিক্রয়কর্মী যেন পোস্ট করা বিল বা পার্টি/পণ্য
  -- মুছে বা আনপোস্ট করে হিসাব বদলে ফেলতে না পারে। UI-এর গার্ড যথেষ্ট নয়,
  -- কারণ RPC সরাসরিও ডাকা যায়।
  if not public.has_role(array['owner','manager']::user_role[]) then
    raise exception 'শুধু মালিক বা ম্যানেজার এই কাজটি করতে পারবেন';
  end if;

  select exists(
    select 1 from public.sales where customer_id = p_party and status <> 'void'
    union all
    select 1 from public.purchases where supplier_id = p_party and status <> 'void'
  ) into v_has_txn;

  select coalesce(public.party_balance(p_party), 0) into v_balance;

  if v_has_txn or v_balance <> 0 then
    update public.parties set status = 'inactive', updated_at = now() where id = p_party;
    perform public.log_entity_change('party', p_party, 'deactivate', null, null,
      'lenden thakay delete kora jayni');
    return 'deactivated';
  end if;

  update public.parties set deleted_at = now(), status = 'deleted', updated_at = now()
   where id = p_party;
  perform public.log_entity_change('party', p_party, 'delete', null, null, null);
  return 'deleted';
end $$;


create or replace function public.delete_product(p_product uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_has_txn boolean;
begin
  select company_id into v_company from public.products where id = p_product;
  if v_company is null then raise exception 'Product not found'; end if;
  if v_company <> public.current_company_id() then raise exception 'Forbidden'; end if;
  -- শুধু মালিক ও ম্যানেজার — বিক্রয়কর্মী যেন পোস্ট করা বিল বা পার্টি/পণ্য
  -- মুছে বা আনপোস্ট করে হিসাব বদলে ফেলতে না পারে। UI-এর গার্ড যথেষ্ট নয়,
  -- কারণ RPC সরাসরিও ডাকা যায়।
  if not public.has_role(array['owner','manager']::user_role[]) then
    raise exception 'শুধু মালিক বা ম্যানেজার এই কাজটি করতে পারবেন';
  end if;

  select exists(
    select 1 from public.stock_movements m
     join public.product_variants v on v.id = m.variant_id
    where v.product_id = p_product
  ) into v_has_txn;

  if v_has_txn then
    update public.products set is_archived = true, is_active = false, updated_at = now()
     where id = p_product;
    update public.product_variants set is_archived = true, is_active = false
     where product_id = p_product;
    perform public.log_entity_change('product', p_product, 'archive', null, null,
      'stock lenden thakay archive kora hoyeche');
    return 'archived';
  end if;

  update public.products set deleted_at = now(), is_active = false where id = p_product;
  update public.product_variants set deleted_at = now(), is_active = false where product_id = p_product;
  perform public.log_entity_change('product', p_product, 'delete', null, null, null);
  return 'deleted';
end $$;

revoke execute on function public.delete_party(uuid) from public, anon;
revoke execute on function public.delete_product(uuid) from public, anon;
grant execute on function public.delete_party(uuid) to authenticated;
grant execute on function public.delete_product(uuid) to authenticated;


-- ডিলিট করা সারি তালিকায় দেখাবে না
drop policy if exists parties_select on public.parties;
create policy parties_select on public.parties
for select to authenticated
using (company_id = public.current_company_id() and deleted_at is null);

drop policy if exists products_select on public.products;
create policy products_select on public.products
for select to authenticated
using (company_id = public.current_company_id() and deleted_at is null);


-- =====================================================================
-- SECTION 6 — বাকির হিসাব (পার্টি-ভিত্তিক সারসংক্ষেপ)
-- v_receivables চালান-ভিত্তিক; ব্যবসায়ী আসলে পার্টি-ভিত্তিক দেখতে চায়।
-- =====================================================================

create or replace function public.party_due_summary(p_type text default 'receivable')
returns table (
  party_id      uuid,
  party_name    text,
  party_phone   text,
  party_area    text,
  total_due     numeric,
  invoice_count bigint,
  oldest_date   date,
  max_age_days  integer
) language sql security invoker set search_path = public as $$
  select
    p.id,
    p.name,
    p.phone,
    p.area,
    sum(v.due)::numeric              as total_due,
    count(*)::bigint                 as invoice_count,
    min(v.entry_date)                as oldest_date,
    max(v.age_days)::integer         as max_age_days
  from (
    select party_id, due, entry_date, age_days, company_id
      from public.v_receivables where p_type = 'receivable'
    union all
    select party_id, due, entry_date, age_days, company_id
      from public.v_payables where p_type = 'payable'
  ) v
  join public.parties p on p.id = v.party_id
  where v.company_id = public.current_company_id()
    and p.deleted_at is null
    and v.due > 0
  group by p.id, p.name, p.phone, p.area
  order by sum(v.due) desc;
$$;

grant execute on function public.party_due_summary(text) to authenticated;


-- =====================================================================
-- SECTION 7 — নোটিশ: একাধিক নির্দিষ্ট কোম্পানিকে টার্গেট করা
-- =====================================================================

alter table public.notices add column if not exists target_company_ids uuid[];
alter table public.notices add column if not exists target_statuses    text[];

drop policy if exists notices_read on public.notices;
create policy notices_read on public.notices
for select to authenticated
using (
  -- কোম্পানি টার্গেটিং: একক company_id, অথবা তালিকা, অথবা সবাই
  (
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


-- =====================================================================
-- SECTION 8 — সাবস্ক্রিপশন মেয়াদ: বাড়ানো ও কমানো দুটোই
-- v1-এ শুধু extend ছিল; ভুল করে বেশি দিলে কমানোর উপায় ছিল না।
-- =====================================================================

create or replace function public.set_subscription_end(
  p_company uuid,
  p_new_end date,
  p_reason  text,
  p_admin   uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_old date;
begin
  select end_date into v_old from public.companies where id = p_company;
  if not found then raise exception 'Company not found'; end if;

  update public.companies
     set end_date = p_new_end,
         status = case
           when p_new_end >= current_date then
             case when status in ('blocked','readonly') then status else 'active' end
           else 'grace'
         end,
         updated_at = now()
   where id = p_company;

  insert into public.subscription_history(company_id, action, old_end, new_end, note, admin_id)
  values (p_company,
          case when p_new_end > coalesce(v_old, current_date) then 'extend' else 'reduce' end,
          v_old, p_new_end, p_reason, p_admin);
end $$;

revoke execute on function public.set_subscription_end(uuid, date, text, uuid) from public, anon, authenticated;
grant execute on function public.set_subscription_end(uuid, date, text, uuid) to service_role;


-- =====================================================================
-- SECTION 9 — প্ল্যাটফর্ম সেটিংস (key-value)
-- সাপোর্ট নম্বর, পেমেন্ট নম্বর, ট্রায়াল দিন — সব ওয়েব থেকে নিয়ন্ত্রণযোগ্য।
-- =====================================================================

create table if not exists public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  uuid references public.platform_admins(id),
  updated_at  timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

-- অ্যাপ শুধু পাবলিক সেটিংস পড়তে পারবে (সাপোর্ট নম্বর, পেমেন্ট নম্বর)
drop policy if exists platform_settings_public_read on public.platform_settings;
create policy platform_settings_public_read on public.platform_settings
for select to authenticated
using (key like 'public.%');

insert into public.platform_settings(key, value) values
  ('public.support', '{"phone":"+8801XXXXXXXXX","whatsapp":"+8801XXXXXXXXX","email":"support@nikash.app","hours":"সকাল ৯টা – রাত ৯টা"}'::jsonb),
  ('public.payment_numbers', '{"bkash":"01XXXXXXXXX","nagad":"01XXXXXXXXX","rocket":"01XXXXXXXXX","bank":""}'::jsonb),
  ('public.app_links', '{"apk_url":"","play_store":"","manual_url":"","version":""}'::jsonb),
  ('billing.trial_days', '15'::jsonb),
  ('billing.grace_days', '7'::jsonb)
on conflict (key) do nothing;


-- =====================================================================
-- SECTION 10 — অ্যাডমিন রোল ও পারমিশন
-- =====================================================================

create table if not exists public.admin_roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name_bn     text not null,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.admin_permissions (
  role_id   uuid not null references public.admin_roles(id) on delete cascade,
  resource  text not null,     -- companies, payments, notices, admins, settings, reports
  can_read   boolean not null default false,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  primary key (role_id, resource)
);

alter table public.platform_admins add column if not exists role_id uuid references public.admin_roles(id);

insert into public.admin_roles(code, name_bn, is_system) values
  ('super_admin',   'সুপার অ্যাডমিন', true),
  ('support_admin', 'সাপোর্ট অ্যাডমিন', true),
  ('finance_admin', 'ফাইন্যান্স অ্যাডমিন', true),
  ('viewer',        'শুধু দেখা', true)
on conflict (code) do nothing;

-- ডিফল্ট পারমিশন
insert into public.admin_permissions(role_id, resource, can_read, can_create, can_update, can_delete)
select r.id, res.resource, true,
       r.code = 'super_admin' or (r.code = 'finance_admin' and res.resource = 'payments')
         or (r.code = 'support_admin' and res.resource = 'notices'),
       r.code = 'super_admin' or (r.code = 'finance_admin' and res.resource = 'payments')
         or (r.code = 'support_admin' and res.resource in ('companies','notices')),
       r.code = 'super_admin'
from public.admin_roles r
cross join (values ('companies'),('payments'),('notices'),('admins'),('settings'),('reports')) as res(resource)
on conflict do nothing;

alter table public.admin_roles enable row level security;
alter table public.admin_permissions enable row level security;
-- শুধু service_role (ওয়েব সার্ভার) পড়বে — কোনো authenticated policy নেই।


-- =====================================================================
-- SECTION 11 — যোগাযোগ ফর্ম ও কোম্পানি নোট
-- =====================================================================

create table if not exists public.contact_submissions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  phone      text,
  subject    text,
  message    text not null,
  status     text not null default 'new',   -- new, read, replied, closed
  created_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;
-- পাবলিক ফর্ম থেকে জমা হয় service_role দিয়ে; কোনো authenticated policy নেই।

create table if not exists public.company_notes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  note        text not null,
  admin_id    uuid references public.platform_admins(id),
  created_at  timestamptz not null default now()
);

alter table public.company_notes enable row level security;
-- অভ্যন্তরীণ নোট — শুধু অ্যাডমিন (service_role) দেখবে, কোম্পানি না।


-- =====================================================================
-- SECTION 12 — অ্যাডমিন ড্যাশবোর্ডের সব সংখ্যা এক কলে
-- =====================================================================

create or replace function public.admin_dashboard_stats()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'total_companies',   (select count(*) from public.companies),
    'active_companies',  (select count(*) from public.companies where status = 'active'),
    'trial_companies',   (select count(*) from public.companies where status = 'trial'),
    'expired_companies', (select count(*) from public.companies where status in ('grace','readonly','blocked')),
    'total_users',       (select count(*) from public.users where is_active),
    'pending_payments',  (select count(*) from public.payment_requests where status = 'pending'),
    'expiring_7d',       (select count(*) from public.companies
                           where end_date between current_date and current_date + 7 and not is_free),
    'month_revenue',     (select coalesce(sum(amount),0) from public.platform_payments
                           where status = 'approved' and created_at >= date_trunc('month', now())),
    'by_type', (select jsonb_object_agg(business_type, c) from (
                  select business_type::text, count(*) c from public.companies group by business_type) t),
    'growth', (select jsonb_agg(jsonb_build_object('month', m, 'count', c) order by m) from (
                 select to_char(date_trunc('month', created_at), 'YYYY-MM') m, count(*) c
                 from public.companies
                 where created_at >= now() - interval '12 months'
                 group by 1) g),
    'revenue_trend', (select jsonb_agg(jsonb_build_object('month', m, 'amount', a) order by m) from (
                 select to_char(date_trunc('month', created_at), 'YYYY-MM') m, sum(amount) a
                 from public.platform_payments
                 where status = 'approved' and created_at >= now() - interval '12 months'
                 group by 1) r)
  );
$$;

revoke execute on function public.admin_dashboard_stats() from public, anon, authenticated;
grant execute on function public.admin_dashboard_stats() to service_role;


-- =====================================================================
-- SECTION 13 — কোম্পানির ব্যবহারের পরিসংখ্যান (অ্যাডমিন প্যানেলের জন্য)
-- =====================================================================

create or replace function public.company_usage_stats(p_company uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'total_sales',    (select coalesce(sum(total),0) from public.sales where company_id = p_company and status = 'posted'),
    'invoice_count',  (select count(*) from public.sales where company_id = p_company and status = 'posted'),
    'party_count',    (select count(*) from public.parties where company_id = p_company and deleted_at is null),
    'product_count',  (select count(*) from public.products where company_id = p_company and deleted_at is null),
    'user_count',     (select count(*) from public.users where company_id = p_company and is_active),
    'last_login',     (select max(created_at) from public.login_history
                        where user_id in (select id from public.users where company_id = p_company) and success),
    'last_30d', (select jsonb_agg(jsonb_build_object('date', summary_date, 'sales', sales_total) order by summary_date)
                   from public.daily_summaries
                  where company_id = p_company and summary_date >= current_date - 30)
  );
$$;

revoke execute on function public.company_usage_stats(uuid) from public, anon, authenticated;
grant execute on function public.company_usage_stats(uuid) to service_role;


-- =====================================================================
-- SECTION 14 — নোটিফিকেশন সিস্টেম (অ্যাপ ও ওয়েব দুই দিকেই)
--
-- দুই ধরনের প্রাপক:
--   audience = 'company'  → কোম্পানির ইউজাররা দেখবে (অ্যাপে bell icon)
--   audience = 'platform' → আমরা/অ্যাডমিনরা দেখব (ওয়েবে bell icon)
-- =====================================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  audience     text not null check (audience in ('company','platform')),
  company_id   uuid references public.companies(id) on delete cascade,  -- company audience-এর জন্য
  user_id      uuid,                                                    -- নির্দিষ্ট ইউজার, null = কোম্পানির সবাই
  admin_id     uuid references public.platform_admins(id),              -- নির্দিষ্ট অ্যাডমিন, null = সব অ্যাডমিন
  type         text not null,       -- payment, subscription, notice, signup, due, system, stock
  severity     text not null default 'info' check (severity in ('info','success','warning','critical')),
  title        text not null,
  body         text,
  link         text,                -- ট্যাপ করলে কোথায় যাবে (যেমন /admin/payments)
  entity_type  text,
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_notif_company  on public.notifications(company_id, created_at desc)
  where audience = 'company';
create index if not exists idx_notif_platform on public.notifications(created_at desc)
  where audience = 'platform';
create index if not exists idx_notif_unread   on public.notifications(read_at) where read_at is null;

alter table public.notifications enable row level security;

-- কোম্পানির ইউজার নিজের কোম্পানির নোটিফিকেশন পড়তে ও read-mark করতে পারবে
drop policy if exists notifications_company_read on public.notifications;
create policy notifications_company_read on public.notifications
for select to authenticated
using (
  audience = 'company'
  and company_id = public.current_company_id()
  and (user_id is null or user_id = auth.uid())
);

drop policy if exists notifications_company_update on public.notifications;
create policy notifications_company_update on public.notifications
for update to authenticated
using (
  audience = 'company'
  and company_id = public.current_company_id()
  and (user_id is null or user_id = auth.uid())
)
with check (audience = 'company' and company_id = public.current_company_id());

-- platform audience-এর কোনো authenticated policy নেই → শুধু service_role (ওয়েব) দেখবে।


-- নোটিফিকেশন তৈরির সহায়ক ফাংশন
create or replace function public.notify(
  p_audience   text,
  p_type       text,
  p_title      text,
  p_body       text default null,
  p_company    uuid default null,
  p_link       text default null,
  p_severity   text default 'info',
  p_entity_type text default null,
  p_entity_id  uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.notifications(
    audience, type, title, body, company_id, link, severity, entity_type, entity_id)
  values (p_audience, p_type, p_title, p_body, p_company, p_link, p_severity, p_entity_type, p_entity_id)
  returning id into v_id;
  return v_id;
end $$;

-- ⚠️ authenticated-কে execute দেওয়া যাবে না: তাহলে যেকোনো কোম্পানির ইউজার
-- 'platform' audience-এ ভুয়া নোটিফিকেশন বানিয়ে আমাদের প্যানেলে পাঠাতে পারত।
-- ট্রিগারগুলো SECURITY DEFINER, তাই ভেতর থেকে ডাকতে এই গ্রান্ট লাগে না।
revoke execute on function public.notify(text,text,text,text,uuid,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.notify(text,text,text,text,uuid,text,text,text,uuid)
  to service_role;


-- ট্রিগার ১: নতুন কোম্পানি সাইনআপ করলে আমরা জানব
create or replace function public.trg_notify_new_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(
    'platform', 'signup',
    'নতুন কোম্পানি সাইনআপ করেছে',
    new.name || ' (' || new.nikash_id || ') — ' || new.business_type::text,
    new.id,
    '/admin/companies/' || new.id::text,
    'success', 'company', new.id);
  return new;
end $$;

drop trigger if exists trg_company_signup_notify on public.companies;
create trigger trg_company_signup_notify
after insert on public.companies
for each row execute function public.trg_notify_new_company();


-- ট্রিগার ২: কোম্পানি পেমেন্ট জমা দিলে আমরা জানব
create or replace function public.trg_notify_payment_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select name into v_name from public.companies where id = new.company_id;
  perform public.notify(
    'platform', 'payment',
    'নতুন পেমেন্ট যাচাইয়ের অপেক্ষায়',
    coalesce(v_name,'') || ' — ৳' || new.amount::text || ' (' || new.method::text || ', TrxID: ' || new.trx_id || ')',
    new.company_id,
    '/admin/payments',
    'warning', 'payment_request', new.id);
  return new;
end $$;

drop trigger if exists trg_payment_request_notify on public.payment_requests;
create trigger trg_payment_request_notify
after insert on public.payment_requests
for each row execute function public.trg_notify_payment_request();


-- ট্রিগার ৩: পেমেন্ট অনুমোদিত/বাতিল হলে কোম্পানি জানবে
create or replace function public.trg_notify_payment_result()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      perform public.notify(
        'company', 'payment',
        'আপনার পেমেন্ট অনুমোদিত হয়েছে',
        '৳' || new.amount::text || ' গ্রহণ করা হয়েছে, সাবস্ক্রিপশন নবায়ন হয়েছে।',
        new.company_id, '/subscription', 'success', 'payment_request', new.id);
    elsif new.status = 'rejected' then
      perform public.notify(
        'company', 'payment',
        'আপনার পেমেন্ট বাতিল হয়েছে',
        coalesce(new.reject_reason, 'বিস্তারিত জানতে যোগাযোগ করুন।'),
        new.company_id, '/subscription', 'critical', 'payment_request', new.id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_payment_result_notify on public.payment_requests;
create trigger trg_payment_result_notify
after update on public.payment_requests
for each row execute function public.trg_notify_payment_result();


-- ট্রিগার ৪: কোম্পানির স্ট্যাটাস/মেয়াদ বদলালে কোম্পানি জানবে
create or replace function public.trg_notify_company_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform public.notify(
      'company', 'subscription',
      'আপনার অ্যাকাউন্টের অবস্থা পরিবর্তন হয়েছে',
      'নতুন অবস্থা: ' || new.status::text ||
        coalesce(' — ' || new.blocked_reason, ''),
      new.id, '/subscription',
      case when new.status in ('blocked','readonly') then 'critical' else 'info' end,
      'company', new.id);
  elsif new.end_date is distinct from old.end_date then
    perform public.notify(
      'company', 'subscription',
      'সাবস্ক্রিপশনের মেয়াদ হালনাগাদ হয়েছে',
      'নতুন মেয়াদ: ' || to_char(new.end_date, 'DD/MM/YYYY'),
      new.id, '/subscription', 'success', 'company', new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_company_change_notify on public.companies;
create trigger trg_company_change_notify
after update on public.companies
for each row execute function public.trg_notify_company_change();


-- ট্রিগার ৫: নোটিশ পাঠালে টার্গেট কোম্পানিগুলোর নোটিফিকেশনেও যাবে
create or replace function public.trg_notify_notice()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.company_id is not null then
    perform public.notify('company', 'notice', new.title_bn, new.body_bn,
      new.company_id, '/notices', new.severity::text, 'notice', new.id);
  elsif new.target_company_ids is not null and array_length(new.target_company_ids, 1) > 0 then
    insert into public.notifications(audience, type, title, body, company_id, link, severity, entity_type, entity_id)
    select 'company', 'notice', new.title_bn, new.body_bn, cid, '/notices',
           new.severity::text, 'notice', new.id
      from unnest(new.target_company_ids) as cid;
  else
    insert into public.notifications(audience, type, title, body, company_id, link, severity, entity_type, entity_id)
    select 'company', 'notice', new.title_bn, new.body_bn, c.id, '/notices',
           new.severity::text, 'notice', new.id
      from public.companies c
     where (new.business_type is null or c.business_type = new.business_type)
       and (new.target_statuses is null or array_length(new.target_statuses,1) is null
            or c.status::text = any(new.target_statuses));
  end if;
  return new;
end $$;

drop trigger if exists trg_notice_notify on public.notices;
create trigger trg_notice_notify
after insert on public.notices
for each row execute function public.trg_notify_notice();


-- অপঠিত সংখ্যা (bell icon-এর ব্যাজ)
create or replace function public.unread_notification_count()
returns integer language sql security invoker set search_path = public as $$
  select count(*)::integer from public.notifications
   where audience = 'company'
     and company_id = public.current_company_id()
     and (user_id is null or user_id = auth.uid())
     and read_at is null;
$$;

grant execute on function public.unread_notification_count() to authenticated;



-- =====================================================================
-- 14.5) payment_method enum-এ 'rocket' ও 'card'
-- অ্যাপের পেমেন্ট ফর্মে রকেট অপশন ছিল, কিন্তু enum-এ ছিল না — ফলে রকেটে
-- পাঠানো পেমেন্ট জমা দিতে গেলে এরর হতো।
-- =====================================================================

alter type payment_method add value if not exists 'rocket';
alter type payment_method add value if not exists 'card';


-- =====================================================================
-- 15) প্ল্যাটফর্ম ইনভয়েস নম্বর + ফিনান্স রিপোর্ট
--     অ্যাডমিন প্যানেল থেকে ম্যানুয়াল পেমেন্ট/ইনভয়েস তুলতে লাগে।
-- =====================================================================

-- বছরভিত্তিক সিরিয়াল কাউন্টার (NK-INV-2026-0042)
create table if not exists public.platform_doc_counters (
  doc_type   text not null,
  year       integer not null,
  last_no    integer not null default 0,
  primary key (doc_type, year)
);

alter table public.platform_doc_counters enable row level security;
-- কোনো authenticated policy নেই → শুধু service_role পড়তে/লিখতে পারবে।

create or replace function public.next_platform_invoice_no()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year integer := extract(year from now())::integer;
  v_no   integer;
begin
  insert into public.platform_doc_counters (doc_type, year, last_no)
  values ('invoice', v_year, 1)
  on conflict (doc_type, year)
  do update set last_no = public.platform_doc_counters.last_no + 1
  returning last_no into v_no;

  return 'NK-INV-' || v_year::text || '-' || lpad(v_no::text, 4, '0');
end $$;

revoke execute on function public.next_platform_invoice_no() from public, anon, authenticated;


-- ম্যানুয়াল পেমেন্ট রেকর্ড: ইনভয়েস (ঐচ্ছিক) + পেমেন্ট + মেয়াদ বাড়ানো
-- এক ট্রানজ্যাকশনে, যাতে অর্ধেক লেখা না থাকে।
create or replace function public.record_manual_payment(
  p_company      uuid,
  p_amount       numeric,
  p_method       payment_method,
  p_trx          text,
  p_plan         uuid default null,
  p_extend_days  integer default 0,
  p_note         text default null,
  p_admin        uuid default null,
  p_make_invoice boolean default true
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_invoice_id uuid;
  v_invoice_no text;
  v_new_end    date;
  v_start      date;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'টাকার পরিমাণ শূন্যের বেশি হতে হবে';
  end if;
  if not exists (select 1 from public.companies where id = p_company) then
    raise exception 'কোম্পানি পাওয়া যায়নি';
  end if;

  if p_extend_days is not null and p_extend_days <> 0 then
    select public.extend_subscription(p_company, p_extend_days, p_amount, p_trx, p_method, p_admin)
      into v_new_end;
  else
    select end_date into v_new_end from public.companies where id = p_company;
  end if;

  if p_make_invoice then
    v_invoice_no := public.next_platform_invoice_no();
    v_start := greatest(current_date, coalesce(
      (select end_date from public.companies where id = p_company) - coalesce(p_extend_days, 0),
      current_date));

    insert into public.platform_invoices (
      company_id, invoice_no, plan_id, period_start, period_end,
      amount, discount, total, status, paid_at
    ) values (
      p_company, v_invoice_no, p_plan, v_start,
      coalesce(v_new_end, current_date + coalesce(p_extend_days, 0)),
      p_amount, 0, p_amount, 'paid', now()
    ) returning id into v_invoice_id;
  end if;

  insert into public.platform_payments (
    company_id, invoice_id, amount, method, trx_id,
    status, verified_by, verified_at
  ) values (
    p_company, v_invoice_id, p_amount, p_method, nullif(p_trx, ''),
    'approved', p_admin, now()
  );

  -- extend_subscription নিজেই 'extend' ইতিহাস লেখে, তাই মেয়াদ না বাড়ালে
  -- শুধু তখনই আলাদা 'manual_payment' এন্ট্রি রাখি — ডাবল এন্ট্রি এড়াতে।
  if coalesce(p_extend_days, 0) = 0 then
    insert into public.subscription_history (
      company_id, action, new_end, amount, trx_id, method, note, admin_id
    ) values (
      p_company, 'manual_payment', v_new_end, p_amount, nullif(p_trx, ''),
      p_method, p_note, p_admin
    );
  elsif p_note is not null then
    update public.subscription_history set note = p_note
     where id = (select id from public.subscription_history
                  where company_id = p_company order by created_at desc limit 1);
  end if;

  return jsonb_build_object(
    'invoice_id', v_invoice_id,
    'invoice_no', v_invoice_no,
    'new_end_date', v_new_end
  );
end $$;

revoke execute on function public.record_manual_payment(uuid, numeric, payment_method, text, uuid, integer, text, uuid, boolean)
  from public, anon, authenticated;


-- ফিনান্স সারাংশ — মাসভিত্তিক আয়, মেথড ভাগ, বকেয়া ইনভয়েস
create or replace function public.finance_summary(p_months integer default 12)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_from date := date_trunc('month', current_date)::date
                 - ((greatest(coalesce(p_months, 12), 1) - 1) || ' months')::interval;
begin
  return jsonb_build_object(
    'monthly', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
               sum(amount)::numeric as amount,
               count(*)::integer    as count
          from public.platform_payments
         where status = 'approved' and created_at >= v_from
         group by 1 order by 1
      ) t
    ), '[]'::jsonb),
    'by_method', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select method::text as method,
               sum(amount)::numeric as amount,
               count(*)::integer    as count
          from public.platform_payments
         where status = 'approved' and created_at >= v_from
         group by 1 order by 2 desc
      ) t
    ), '[]'::jsonb),
    'totals', (
      select jsonb_build_object(
        'lifetime',   coalesce(sum(amount), 0),
        'this_month', coalesce(sum(amount) filter (
                        where created_at >= date_trunc('month', current_date)), 0),
        'last_month', coalesce(sum(amount) filter (
                        where created_at >= date_trunc('month', current_date) - interval '1 month'
                          and created_at <  date_trunc('month', current_date)), 0)
      ) from public.platform_payments where status = 'approved'
    ),
    'unpaid_invoices', (
      select jsonb_build_object(
        'count',  count(*)::integer,
        'amount', coalesce(sum(total), 0)
      ) from public.platform_invoices where status <> 'paid'
    ),
    'pending_requests', (
      select jsonb_build_object(
        'count',  count(*)::integer,
        'amount', coalesce(sum(amount), 0)
      ) from public.payment_requests where status = 'pending'
    )
  );
end $$;

revoke execute on function public.finance_summary(integer) from public, anon, authenticated;


-- =====================================================================
-- END 06_v2_edit_delete_audit.sql
-- =====================================================================
