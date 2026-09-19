-- =====================================================================
-- Nikash — 04_seed.sql
-- Reference data, company provisioning, demo data
-- Run after 03_rls_policies.sql
-- =====================================================================

-- =====================================================================
-- SECTION 1 — PLANS
-- =====================================================================

insert into plans (code, name_bn, name_en, business_type, duration_days, price, max_users, max_devices) values
  ('trial',           'ট্রায়াল',          'Trial',            null,        15,     0, 3, 3),
  ('monthly_shop',    'মাসিক (দোকান)',    'Monthly (Shop)',   'shop',      30,   300, 3, 3),
  ('yearly_shop',     'বার্ষিক (দোকান)',  'Yearly (Shop)',    'shop',     365,  3000, 3, 3),
  ('monthly_wh',      'মাসিক (গুদাম)',    'Monthly (Wh)',     'warehouse',  30,   500, 8, 5),
  ('yearly_wh',       'বার্ষিক (গুদাম)',  'Yearly (Wh)',      'warehouse', 365,  5000, 8, 5),
  ('monthly_vendor',  'মাসিক (সরবরাহ)',   'Monthly (Vendor)', 'vendor',     30,   800, 15, 8),
  ('yearly_vendor',   'বার্ষিক (সরবরাহ)', 'Yearly (Vendor)',  'vendor',    365,  8000, 15, 8)
on conflict (code) do nothing;


-- =====================================================================
-- SECTION 2 — NIKASH ID GENERATOR
-- =====================================================================

create sequence if not exists nikash_id_seq start 1000;

create or replace function public.next_nikash_id()
returns text language sql as $$
  select 'NK-' || nextval('nikash_id_seq')::text;
$$;

alter table companies alter column nikash_id set default public.next_nikash_id();


-- =====================================================================
-- SECTION 3 — DOCUMENT NUMBER GENERATOR
-- Per company, per document type, resets nothing — always increments.
-- =====================================================================

create table if not exists doc_counters (
  company_id  uuid not null references companies(id) on delete cascade,
  doc_type    text not null,
  last_no     bigint not null default 0,
  primary key (company_id, doc_type)
);
alter table doc_counters enable row level security;
create policy doc_counters_all on doc_counters
for all to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create or replace function public.next_doc_no(p_company uuid, p_type text, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare v_no bigint;
begin
  insert into doc_counters(company_id, doc_type, last_no)
  values (p_company, p_type, 1)
  on conflict (company_id, doc_type)
    do update set last_no = doc_counters.last_no + 1
  returning last_no into v_no;

  return p_prefix || '-' || to_char(current_date,'YYMM') || '-' || lpad(v_no::text, 5, '0');
end $$;


-- =====================================================================
-- SECTION 4 — PROVISION A NEW COMPANY
-- Creates settings, default location, expense categories and a 15-day trial.
-- =====================================================================

create or replace function public.provision_company(
  p_name text,
  p_business_type business_type,
  p_owner_name text,
  p_phone text,
  p_owner_auth_id uuid                      -- id from auth.users
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_features jsonb;
begin
  v_features := case p_business_type
    when 'vendor'    then '{"vehicles":false,"routes":false,"pos":false,"batches":true, "multi_location":true}'::jsonb
    when 'warehouse' then '{"vehicles":true, "routes":true, "pos":false,"batches":true, "multi_location":true}'::jsonb
    else                  '{"vehicles":false,"routes":false,"pos":true, "batches":false,"multi_location":false}'::jsonb
  end;

  insert into companies(name, business_type, owner_name, phone,
                        start_date, end_date, status, plan_id)
  values (p_name, p_business_type, p_owner_name, p_phone,
          current_date, current_date + 15, 'trial',
          (select id from plans where code = 'trial'))
  returning id into v_company;

  insert into company_settings(company_id, features) values (v_company, v_features);

  insert into users(id, company_id, name, phone, role)
  values (p_owner_auth_id, v_company, p_owner_name, p_phone, 'owner');

  insert into locations(company_id, name, type, is_default)
  values (v_company,
          case p_business_type when 'shop' then 'মূল দোকান'
                               when 'vendor' then 'মূল গুদাম'
                               else 'প্রধান গুদাম' end,
          case p_business_type when 'shop' then 'shop'::location_type
                               else 'warehouse'::location_type end,
          true);

  insert into expense_categories(company_id, name_bn, name_en, is_direct, is_system, sort_order) values
    (v_company, 'জ্বালানি',           'Fuel',              true,  true, 1),
    (v_company, 'টোল',                'Toll',              true,  true, 2),
    (v_company, 'রোড কস্ট',           'Road cost',         true,  true, 3),
    (v_company, 'গাড়ি মেরামত',       'Vehicle repair',    true,  true, 4),
    (v_company, 'লোডিং/আনলোডিং',      'Loading',           true,  true, 5),
    (v_company, 'ড্রাইভার ভাতা',      'Driver allowance',  true,  true, 6),
    (v_company, 'গুদাম ভাড়া',         'Warehouse rent',    false, true, 7),
    (v_company, 'দোকান ভাড়া',         'Shop rent',         false, true, 8),
    (v_company, 'কর্মচারীর বেতন',     'Salary',            false, true, 9),
    (v_company, 'মোবাইল বিল',         'Mobile bill',       false, true, 10),
    (v_company, 'বিদ্যুৎ বিল',        'Electricity',       false, true, 11),
    (v_company, 'পণ্যের ক্ষতি',       'Stock loss',        false, true, 12),
    (v_company, 'অন্যান্য',           'Others',            false, true, 99);

  return v_company;
end $$;


-- =====================================================================
-- SECTION 5 — STARTER PRODUCT CATALOGUE (optional, for new companies)
-- Demonstrates the multi-level unit model with real grocery examples.
-- =====================================================================

create or replace function public.seed_starter_catalogue(p_company uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c_oil uuid; c_water uuid; c_noodles uuid; c_rice uuid; c_snacks uuid;
  p_id uuid; v_id uuid;
begin
  insert into categories(company_id, name_bn, name_en, sort_order)
  values (p_company,'তেল','Oil',1)      returning id into c_oil;
  insert into categories(company_id, name_bn, name_en, sort_order)
  values (p_company,'পানি','Water',2)    returning id into c_water;
  insert into categories(company_id, name_bn, name_en, sort_order)
  values (p_company,'নুডলস','Noodles',3) returning id into c_noodles;
  insert into categories(company_id, name_bn, name_en, sort_order)
  values (p_company,'চাল','Rice',4)      returning id into c_rice;
  insert into categories(company_id, name_bn, name_en, sort_order)
  values (p_company,'চিপস','Snacks',5)   returning id into c_snacks;

  -- Soyabean oil: 4 variants, each bottle-based with a carton above
  insert into products(company_id, category_id, name)
  values (p_company, c_oil, 'সয়াবিন তেল') returning id into p_id;

  insert into product_variants(company_id, product_id, name, base_unit, sku)
  values (p_company, p_id, '১ লিটার', 'বোতল', 'OIL-1L') returning id into v_id;
  insert into variant_units(company_id, variant_id, unit_name, level, qty_below,
                            purchase_price, sale_price, is_default_sale) values
    (p_company, v_id, 'বোতল',  0, 1,  165, 175, true),
    (p_company, v_id, 'কার্টন', 1, 12, 1900, 2040, false);

  insert into product_variants(company_id, product_id, name, base_unit, sku)
  values (p_company, p_id, '৫ লিটার', 'বোতল', 'OIL-5L') returning id into v_id;
  insert into variant_units(company_id, variant_id, unit_name, level, qty_below,
                            purchase_price, sale_price, is_default_sale) values
    (p_company, v_id, 'বোতল',  0, 1, 810,  850, true),
    (p_company, v_id, 'কার্টন', 1, 4, 3180, 3350, false);

  -- Water: same product, different pack counts per variant
  insert into products(company_id, category_id, name)
  values (p_company, c_water, 'খাবার পানি') returning id into p_id;

  insert into product_variants(company_id, product_id, name, base_unit, sku)
  values (p_company, p_id, '৫০০ মিলি', 'বোতল', 'WTR-500') returning id into v_id;
  insert into variant_units(company_id, variant_id, unit_name, level, qty_below,
                            purchase_price, sale_price, is_default_sale) values
    (p_company, v_id, 'বোতল',  0, 1,  12,  15, true),
    (p_company, v_id, 'কার্টন', 1, 24, 270, 340, false);

  insert into product_variants(company_id, product_id, name, base_unit, sku)
  values (p_company, p_id, '১ লিটার', 'বোতল', 'WTR-1L') returning id into v_id;
  insert into variant_units(company_id, variant_id, unit_name, level, qty_below,
                            purchase_price, sale_price, is_default_sale) values
    (p_company, v_id, 'বোতল',  0, 1,  18,  25, true),
    (p_company, v_id, 'কার্টন', 1, 12, 200, 280, false);

  -- Noodles: carton price 320 as discussed
  insert into products(company_id, category_id, name)
  values (p_company, c_noodles, 'ইনস্ট্যান্ট নুডলস') returning id into p_id;

  insert into product_variants(company_id, product_id, name, base_unit, sku)
  values (p_company, p_id, '৮ প্যাক', 'প্যাকেট', 'NDL-8P') returning id into v_id;
  insert into variant_units(company_id, variant_id, unit_name, level, qty_below,
                            purchase_price, sale_price, is_default_purchase) values
    (p_company, v_id, 'প্যাকেট', 0, 1,  26.67, 35, false),
    (p_company, v_id, 'কার্টন',  1, 12, 320,   360, true);

  -- Rice: weight based, decimal allowed, bosta of 50 kg
  insert into products(company_id, category_id, name)
  values (p_company, c_rice, 'মিনিকেট চাল') returning id into p_id;

  insert into product_variants(company_id, product_id, name, base_unit, sku, allow_decimal)
  values (p_company, p_id, 'মিনিকেট', 'কেজি', 'RIC-MIN', true) returning id into v_id;
  insert into variant_units(company_id, variant_id, unit_name, level, qty_below,
                            purchase_price, sale_price, is_default_purchase) values
    (p_company, v_id, 'কেজি',  0, 1,  68,   75, false),
    (p_company, v_id, 'বস্তা', 1, 50, 3300, 3600, true);

  -- Chips: three levels — piece, pack of 20, bag of 4 packs
  insert into products(company_id, category_id, name)
  values (p_company, c_snacks, 'চিপস') returning id into p_id;

  insert into product_variants(company_id, product_id, name, base_unit, sku)
  values (p_company, p_id, 'রেগুলার', 'পিস', 'CHP-REG') returning id into v_id;
  insert into variant_units(company_id, variant_id, unit_name, level, qty_below,
                            purchase_price, sale_price, is_default_sale) values
    (p_company, v_id, 'পিস',  0, 1,  7,   10, true),
    (p_company, v_id, 'প্যাক', 1, 20, 135, 190, false),
    (p_company, v_id, 'ব্যাগ', 2, 4,  520, 740, false);
end $$;


-- =====================================================================
-- SECTION 6 — SCHEDULED JOBS (Supabase: enable pg_cron first)
-- =====================================================================

-- create extension if not exists pg_cron;
--
-- select cron.schedule('nikash-refresh-status', '0 1 * * *', $$
--   select public.refresh_company_statuses();
-- $$);
--
-- select cron.schedule('nikash-recurring-expenses', '30 1 * * *', $$
--   select public.generate_recurring_expenses(id) from public.companies
--   where status in ('trial','active','grace');
-- $$);
--
-- select cron.schedule('nikash-daily-summaries', '0 2 * * *', $$
--   select public.recalc_daily_summaries(id, current_date - 2) from public.companies
--   where status in ('trial','active','grace');
-- $$);
--
-- select cron.schedule('nikash-expire-inbound', '0 3 * * *', $$
--   update public.inbound_invoices set status = 'expired'
--   where status = 'pending' and expires_at < now();
-- $$);


-- =====================================================================
-- SECTION 7 — USEFUL VIEWS
-- =====================================================================

create or replace view v_current_stock as
select
  m.company_id,
  m.location_id,
  m.variant_id,
  pv.product_id,
  sum(m.qty_base)                          as qty_base,
  public.variant_avg_cost(m.variant_id)    as avg_cost,
  sum(m.qty_base) * public.variant_avg_cost(m.variant_id) as stock_value
from stock_movements m
join product_variants pv on pv.id = m.variant_id
where not m.is_archived
group by m.company_id, m.location_id, m.variant_id, pv.product_id;

create or replace view v_receivables as
select company_id, customer_id as party_id, invoice_no, entry_date, total, paid, due,
       current_date - entry_date as age_days,
       case
         when current_date - entry_date <= 15 then '0-15'
         when current_date - entry_date <= 30 then '16-30'
         when current_date - entry_date <= 60 then '31-60'
         else '60+'
       end as age_bucket
from sales
where status = 'posted' and due > 0 and not is_archived;

create or replace view v_payables as
select company_id, supplier_id as party_id, invoice_no, entry_date, total, paid, due,
       current_date - entry_date as age_days,
       case
         when current_date - entry_date <= 15 then '0-15'
         when current_date - entry_date <= 30 then '16-30'
         when current_date - entry_date <= 60 then '31-60'
         else '60+'
       end as age_bucket
from purchases
where status = 'posted' and due > 0 and not is_archived;

create or replace view v_monthly_summary as
select
  company_id,
  date_trunc('month', summary_date)::date as month,
  sum(sales_total)      as sales_total,
  sum(purchase_total)   as purchase_total,
  sum(collection_total) as collection_total,
  sum(expense_total)    as expense_total,
  sum(cogs_total)       as cogs_total,
  sum(gross_profit)     as gross_profit,
  sum(net_profit)       as net_profit,
  sum(invoice_count)    as invoice_count,
  case when sum(sales_total) > 0
       then round(100 * sum(net_profit) / sum(sales_total), 2) else 0 end as net_margin_pct
from daily_summaries
group by company_id, date_trunc('month', summary_date);

-- Platform revenue for the admin panel
create or replace view v_platform_revenue as
select
  date_trunc('month', created_at)::date as month,
  count(*)                              as payment_count,
  sum(amount)                           as revenue,
  method
from platform_payments
where status = 'approved'
group by date_trunc('month', created_at), method;

-- =====================================================================
-- END 04_seed.sql
-- =====================================================================
