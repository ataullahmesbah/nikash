-- =====================================================================
-- Nikash — 10_security_hardening.sql
--
-- শেষ নিরাপত্তা রিভিউতে ধরা পড়া জিনিসগুলো। পুরোটাই idempotent —
-- একাধিকবার চালালেও সমস্যা নেই।
--
-- ০৯ নম্বর ফাইল আগে চালিয়ে ফেললেও এটা চালান: ভেতরের
-- recalc_daily_summaries এখানে ঠিক করা আছে।
-- =====================================================================


-- ---------------------------------------------------------------------
-- ১) promote_expense_title — অন্য কোম্পানিতে লেখা ঠেকানো
--
-- ফাংশনটা SECURITY DEFINER, অর্থাৎ RLS পাশ কাটিয়ে চলে, আর p_company
-- বাইরে থেকে আসে। আগে কোনো যাচাই ছিল না — যেকোনো লগইন করা ব্যবহারকারী
-- অন্য কোম্পানির UUID পাঠিয়ে তাদের expense_categories-এ সারি ঢোকাতে ও
-- তাদের খরচের ক্যাটাগরি বদলে দিতে পারত।
-- ---------------------------------------------------------------------
create or replace function public.promote_expense_title(
  p_company uuid, p_title text, p_name_bn text, p_is_direct boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_cat uuid;
begin
  -- নিজের কোম্পানি ছাড়া অন্য কোথাও নয়
  if p_company is distinct from public.current_company_id() then
    raise exception 'Forbidden';
  end if;

  -- খরচের ক্যাটাগরি তৈরি করা মালিক/ম্যানেজারের কাজ
  if not public.has_role(array['owner','manager']::user_role[]) then
    raise exception 'শুধু মালিক বা ম্যানেজার এই কাজটি করতে পারবেন';
  end if;

  insert into public.expense_categories(company_id, name_bn, name_en, is_direct)
  values (p_company, p_name_bn, p_name_bn, p_is_direct)
  returning id into v_cat;

  update public.expenses
     set category_id = v_cat
   where company_id = p_company and trim(title) = trim(p_title) and category_id is null;

  update public.expense_titles
     set promoted_category_id = v_cat
   where company_id = p_company and title = trim(p_title);

  return v_cat;
end $$;

revoke execute on function public.promote_expense_title(uuid, text, text, boolean)
  from public, anon;
grant  execute on function public.promote_expense_title(uuid, text, text, boolean)
  to authenticated;


-- ---------------------------------------------------------------------
-- ২) recalc_daily_summaries — টেন্যান্ট যাচাই ও স্টক/বাকির হিসাব ফেরত
--
-- ০৯ নম্বর ফাইলের প্রথম সংস্করণে soft-delete ফিল্টার যোগ করতে গিয়ে
-- 'Forbidden' চেক আর stock_value / receivable / payable / cash_in_hand
-- বাদ পড়ে গিয়েছিল। এখানে দুটোই একসাথে আছে।
-- ---------------------------------------------------------------------
create or replace function public.recalc_daily_summaries(
  p_company uuid, p_from date default current_date)
returns void language plpgsql security definer set search_path = public as $$
declare d date; v record; v_stock numeric; v_recv numeric; v_pay numeric;
begin
  if p_company is distinct from public.current_company_id()
     and public.current_company_id() is not null then
    raise exception 'Forbidden';
  end if;

  select coalesce(sum(qty_base * public.variant_avg_cost(variant_id)), 0)
    into v_stock
  from public.stock_movements
  where company_id = p_company and not is_archived;

  select coalesce(sum(due), 0) into v_recv
  from public.sales where company_id = p_company and status = 'posted' and not is_archived;

  select coalesce(sum(due), 0) into v_pay
  from public.purchases where company_id = p_company and status = 'posted' and not is_archived;

  for d in select generate_series(p_from, current_date, interval '1 day')::date loop
    select
      coalesce((select sum(total) from public.sales
                where company_id=p_company and entry_date=d and status='posted'),0)      as sales_total,
      coalesce((select sum(cogs_total) from public.sales
                where company_id=p_company and entry_date=d and status='posted'),0)      as cogs_total,
      coalesce((select count(*) from public.sales
                where company_id=p_company and entry_date=d and status='posted'),0)      as invoice_count,
      coalesce((select sum(total) from public.purchases
                where company_id=p_company and entry_date=d and status='posted'),0)      as purchase_total,
      -- বাতিল (void) করা পেমেন্ট আর গোনা হবে না
      coalesce((select sum(amount) from public.payments
                where company_id=p_company and entry_date=d and status='posted'
                  and deleted_at is null
                  and type='customer_collection'),0)                                     as collection_total,
      coalesce((select sum(amount) from public.payments
                where company_id=p_company and entry_date=d and status='posted'
                  and deleted_at is null
                  and type='supplier_payment'),0)                                        as payment_total,
      -- মুছে ফেলা খরচ নিট লাভ কমাবে না
      coalesce((select sum(amount) from public.expenses
                where company_id=p_company and entry_date=d and status='approved'
                  and deleted_at is null),0)                                             as expense_total
    into v;

    insert into public.daily_summaries(
      company_id, summary_date, sales_total, purchase_total, collection_total,
      payment_total, expense_total, cogs_total, gross_profit, net_profit,
      stock_value, receivable, payable, cash_in_hand,
      invoice_count, computed_at)
    values(
      p_company, d, v.sales_total, v.purchase_total, v.collection_total,
      v.payment_total, v.expense_total, v.cogs_total,
      v.sales_total - v.cogs_total,
      v.sales_total - v.cogs_total - v.expense_total,
      case when d = current_date then v_stock else 0 end,
      case when d = current_date then v_recv  else 0 end,
      case when d = current_date then v_pay   else 0 end,
      v.collection_total - v.payment_total - v.expense_total,
      v.invoice_count, now())
    on conflict (company_id, summary_date) do update set
      sales_total      = excluded.sales_total,
      purchase_total   = excluded.purchase_total,
      collection_total = excluded.collection_total,
      payment_total    = excluded.payment_total,
      expense_total    = excluded.expense_total,
      cogs_total       = excluded.cogs_total,
      gross_profit     = excluded.gross_profit,
      net_profit       = excluded.net_profit,
      stock_value  = case when d = current_date then excluded.stock_value else public.daily_summaries.stock_value end,
      receivable   = case when d = current_date then excluded.receivable  else public.daily_summaries.receivable  end,
      payable      = case when d = current_date then excluded.payable    else public.daily_summaries.payable     end,
      cash_in_hand     = excluded.cash_in_hand,
      invoice_count    = excluded.invoice_count,
      computed_at      = now();
  end loop;
end $$;

revoke execute on function public.recalc_daily_summaries(uuid, date) from public, anon;
grant  execute on function public.recalc_daily_summaries(uuid, date) to authenticated;


-- ---------------------------------------------------------------------
-- ৩) anon রোলের হাত থেকে সব টেন্যান্ট টেবিল সরিয়ে রাখা
--
-- anon কী হলো: অ্যাপের পাবলিক (anon) API key দিয়ে কেউ লগইন না করেই
-- যে রোলে কথা বলে। RLS তো আছেই, কিন্তু RLS নীতিতে একটা ভুল হলে যাতে
-- সরাসরি টেবিল পড়া না যায় — তাই টেবিল-লেভেলেও দরজা বন্ধ করি।
-- signup রুট service_role দিয়ে চলে, তাই এতে কিছু ভাঙবে না।
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      -- লগইনের আগে অ্যাপ/সাইটের যে টেবিলগুলো পড়া লাগে
      and tablename not in ('plans', 'platform_settings', 'app_versions')
  loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- এই তিনটে শুধু পড়া যাবে, লেখা নয়
grant select on public.plans             to anon;
grant select on public.platform_settings to anon;
grant select on public.app_versions      to anon;


-- ---------------------------------------------------------------------
-- ৪) যাচাই — চালানোর পরে এগুলো দেখে নিন
-- ---------------------------------------------------------------------
-- RLS ছাড়া কোনো টেবিল আছে কিনা (ফলাফল খালি আসা উচিত):
--
--   select tablename from pg_tables t
--   where schemaname = 'public'
--     and not exists (
--       select 1 from pg_class c
--       join pg_namespace n on n.oid = c.relnamespace
--       where n.nspname = 'public' and c.relname = t.tablename and c.relrowsecurity
--     );
--
-- anon এখনো কোন টেবিলে হাত দিতে পারে (৩টি সারি আসা উচিত):
--
--   select table_name, privilege_type from information_schema.role_table_grants
--   where grantee = 'anon' and table_schema = 'public'
--   order by table_name;
