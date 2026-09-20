-- =====================================================================
-- Nikash — 03_rls_policies.sql
-- Row Level Security. Run after 02_functions_triggers.sql
--
-- Model:
--   * service_role (admin panel server side) bypasses RLS entirely.
--   * App users see only rows where company_id = their own company.
--   * Writes additionally require an active subscription.
-- =====================================================================

-- =====================================================================
-- SECTION 1 — PLATFORM TABLES
-- Deny by default. Only the admin panel (service_role) touches these.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'platform_admins','subscription_history','platform_invoices',
    'platform_payments','admin_logs','admin_access_logs','login_history',
    'notice_reads']
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- Companies: a user may read their own company row only
alter table public.companies enable row level security;

create policy companies_read_own on public.companies
for select to authenticated
using (id = public.current_company_id());

-- Plans and app versions are public reference data
alter table public.plans enable row level security;
create policy plans_read on public.plans
for select to authenticated using (is_active);

alter table public.app_versions enable row level security;
create policy app_versions_read on public.app_versions
for select to authenticated using (true);

-- Notices targeted at this company, this business type, or everyone
alter table public.notices enable row level security;
create policy notices_read on public.notices
for select to authenticated
using (
  (company_id is null or company_id = public.current_company_id())
  and (business_type is null or business_type = (
        select business_type from public.companies where id = public.current_company_id()))
  and start_at <= now()
  and (end_at is null or end_at >= now())
);

-- Notice reads: user may record their own
create policy notice_reads_own on public.notice_reads
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Payment requests: owner may create and read their own company's
alter table public.payment_requests enable row level security;

create policy payreq_read on public.payment_requests
for select to authenticated
using (company_id = public.current_company_id());

create policy payreq_insert on public.payment_requests
for insert to authenticated
with check (company_id = public.current_company_id() and public.is_owner());

-- Platform invoices/payments: owner may read their own company's
create policy plat_inv_read on public.platform_invoices
for select to authenticated
using (company_id = public.current_company_id() and public.is_owner());

create policy plat_pay_read on public.platform_payments
for select to authenticated
using (company_id = public.current_company_id() and public.is_owner());

-- Business connections: either side may see; only owner may act
alter table public.business_connections enable row level security;

create policy conn_read on public.business_connections
for select to authenticated
using (from_company_id = public.current_company_id()
    or to_company_id   = public.current_company_id());

create policy conn_write on public.business_connections
for all to authenticated
using ((from_company_id = public.current_company_id()
     or to_company_id   = public.current_company_id()) and public.is_owner())
with check ((from_company_id = public.current_company_id()
     or to_company_id   = public.current_company_id()) and public.is_owner());

alter table public.inbound_invoices enable row level security;

create policy inbound_read on public.inbound_invoices
for select to authenticated
using (to_company_id   = public.current_company_id()
    or from_company_id = public.current_company_id());

create policy inbound_update on public.inbound_invoices
for update to authenticated
using (to_company_id = public.current_company_id())
with check (to_company_id = public.current_company_id());


-- =====================================================================
-- SECTION 2 — COMPANY TABLES
-- One read policy + one write policy per table, applied in bulk.
-- =====================================================================

do $$
declare
  t text;
  tenant_tables text[] := array[
    'devices','company_settings','categories','products','product_variants',
    'variant_units','price_history','routes','locations','parties',
    'purchases','purchase_items','sales','sale_items',
    'purchase_returns','purchase_return_items','sale_returns','sale_return_items',
    'batches','stock_movements','stock_snapshots','stock_adjustments',
    'stock_counts','stock_count_items','stock_transfers','stock_transfer_items',
    'payments','payment_allocations','expense_categories','expenses',
    'expense_titles','recurring_expenses','vehicles','vehicle_trips',
    'targets','daily_summaries','pos_shifts','sync_queue'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists %1$s_select on public.%1$I;', t);
    execute format($p$
      create policy %1$s_select on public.%1$I
      for select to authenticated
      using (company_id = public.current_company_id());
    $p$, t);

    execute format('drop policy if exists %1$s_insert on public.%1$I;', t);
    execute format($p$
      create policy %1$s_insert on public.%1$I
      for insert to authenticated
      with check (company_id = public.current_company_id()
                  and public.company_can_write());
    $p$, t);

    execute format('drop policy if exists %1$s_update on public.%1$I;', t);
    execute format($p$
      create policy %1$s_update on public.%1$I
      for update to authenticated
      using (company_id = public.current_company_id()
             and public.company_can_write())
      with check (company_id = public.current_company_id());
    $p$, t);
  end loop;
end $$;

-- Note: no DELETE policies are created anywhere on purpose.
-- Nothing is hard deleted. Use status = 'void' or is_archived = true.


-- =====================================================================
-- SECTION 3 — USERS TABLE
-- =====================================================================

alter table public.users enable row level security;

create policy users_select on public.users
for select to authenticated
using (company_id = public.current_company_id());

create policy users_insert on public.users
for insert to authenticated
with check (company_id = public.current_company_id() and public.is_owner());

create policy users_update on public.users
for update to authenticated
using (company_id = public.current_company_id()
       and (public.is_owner() or id = auth.uid()))
with check (company_id = public.current_company_id());


-- =====================================================================
-- SECTION 4 — ROLE RESTRICTIONS ON SENSITIVE TABLES
-- Prices: owner only. Audit log: read-only, owner only.
-- =====================================================================

drop policy if exists variant_units_update on public.variant_units;
create policy variant_units_update on public.variant_units
for update to authenticated
using (company_id = public.current_company_id()
       and public.company_can_write()
       and public.has_role(array['owner','manager']::user_role[]))
with check (company_id = public.current_company_id());

alter table public.audit_logs enable row level security;

create policy audit_read on public.audit_logs
for select to authenticated
using (company_id = public.current_company_id() and public.is_owner());

create policy audit_insert on public.audit_logs
for insert to authenticated
with check (company_id = public.current_company_id());

-- Salesmen see only their own sales
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
for select to authenticated
using (
  company_id = public.current_company_id()
  and (public.current_user_role() <> 'salesman' or salesman_id = auth.uid())
);


-- =====================================================================
-- SECTION 5 — GRANTS
-- =====================================================================

grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update on tables to authenticated;

-- No DELETE grant anywhere.
revoke delete on all tables in schema public from authenticated;

-- =====================================================================
-- END 03_rls_policies.sql
-- =====================================================================
