-- =====================================================================
-- Nikash — 02_functions_triggers.sql
-- Helper functions, business logic, triggers
-- Run after 01_schema.sql
-- =====================================================================

-- =====================================================================
-- SECTION 1 — TENANT CONTEXT HELPERS
-- SECURITY DEFINER so RLS on users does not recurse.
-- =====================================================================

create or replace function public.current_company_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from public.users where id = auth.uid() and is_active;
$$;

create or replace function public.current_user_role()
returns user_role
language sql stable security definer set search_path = public
as $$
  select role from public.users where id = auth.uid() and is_active;
$$;

create or replace function public.is_owner()
returns boolean
language sql stable
as $$ select public.current_user_role() = 'owner'; $$;

create or replace function public.has_role(roles user_role[])
returns boolean
language sql stable
as $$ select public.current_user_role() = any(roles); $$;

-- Subscription gate. Writes are blocked once the company is readonly/blocked.
create or replace function public.company_can_write(p_company uuid default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select c.status in ('trial','active','grace')
  from public.companies c
  where c.id = coalesce(p_company, public.current_company_id());
$$;


-- =====================================================================
-- SECTION 2 — GENERIC TRIGGERS
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Attach updated_at trigger to every table that has the column
do $$
declare t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'updated_at'
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on public.%1$I;
       create trigger trg_%1$s_updated before update on public.%1$I
       for each row execute function public.set_updated_at();', t.table_name);
  end loop;
end $$;


-- =====================================================================
-- SECTION 3 — UNIT CONVERSION
-- factor_to_base is derived from the chain of qty_below values.
-- level 0 -> 1, level 1 -> qty_below(1), level 2 -> qty_below(2) * factor(1) ...
-- =====================================================================

create or replace function public.recalc_variant_unit_factors(p_variant uuid)
returns void language plpgsql as $$
declare
  r record;
  running numeric(14,3) := 1;
begin
  for r in
    select id, level, qty_below
    from public.variant_units
    where variant_id = p_variant
    order by level asc
  loop
    if r.level = 0 then
      running := 1;
    else
      running := running * r.qty_below;
    end if;
    update public.variant_units set factor_to_base = running where id = r.id;
  end loop;
end $$;

create or replace function public.trg_variant_unit_factor()
returns trigger language plpgsql as $$
begin
  perform public.recalc_variant_unit_factors(coalesce(new.variant_id, old.variant_id));
  return null;
end $$;

drop trigger if exists trg_units_factor on public.variant_units;
create trigger trg_units_factor
after insert or update of level, qty_below or delete on public.variant_units
for each row execute function public.trg_variant_unit_factor();

-- Convert a quantity expressed in any unit to base units
create or replace function public.to_base_qty(p_unit_id uuid, p_qty numeric)
returns numeric language sql stable as $$
  select p_qty * factor_to_base from public.variant_units where id = p_unit_id;
$$;

-- Human readable stock: 250 pieces -> "3 bag 10 piece"
create or replace function public.format_stock(p_variant uuid, p_qty_base numeric)
returns text language plpgsql stable as $$
declare
  r record; rem numeric := p_qty_base; whole numeric; parts text[] := '{}';
begin
  for r in
    select unit_name, factor_to_base
    from public.variant_units
    where variant_id = p_variant and is_active
    order by level desc
  loop
    if r.factor_to_base <= 0 then continue; end if;
    whole := trunc(rem / r.factor_to_base);
    if whole > 0 then
      parts := parts || format('%s %s', whole::text, r.unit_name);
      rem := rem - (whole * r.factor_to_base);
    end if;
  end loop;
  if array_length(parts,1) is null then return '0'; end if;
  return array_to_string(parts, ' ');
end $$;


-- =====================================================================
-- SECTION 4 — STOCK
-- Current stock is always the sum of the ledger, never a stored column.
-- =====================================================================

create or replace function public.variant_stock(
  p_variant uuid, p_location uuid default null, p_as_of date default null)
returns numeric language sql stable as $$
  select coalesce(sum(qty_base), 0)
  from public.stock_movements
  where variant_id = p_variant
    and (p_location is null or location_id = p_location)
    and (p_as_of is null or entry_date <= p_as_of);
$$;

-- Weighted average cost after the latest movement
create or replace function public.variant_avg_cost(p_variant uuid)
returns numeric language sql stable as $$
  select coalesce((
    select avg_cost_after
    from public.stock_movements
    where variant_id = p_variant and avg_cost_after is not null
    order by entry_date desc, created_at desc
    limit 1
  ), 0);
$$;

-- Recompute weighted average cost when stock comes in
create or replace function public.apply_weighted_avg(
  p_variant uuid, p_qty_in numeric, p_unit_cost numeric)
returns numeric language plpgsql as $$
declare old_qty numeric; old_avg numeric; new_avg numeric;
begin
  old_qty := public.variant_stock(p_variant);
  old_avg := public.variant_avg_cost(p_variant);
  if (old_qty + p_qty_in) <= 0 then
    return coalesce(p_unit_cost, old_avg);
  end if;
  new_avg := ((old_qty * old_avg) + (p_qty_in * p_unit_cost)) / (old_qty + p_qty_in);
  return round(new_avg, 4);
end $$;


-- =====================================================================
-- SECTION 5 — POSTING
-- Draft documents affect nothing. Posting writes the ledger.
-- =====================================================================

create or replace function public.post_purchase(p_purchase uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p record; it record; v_avg numeric; v_unit_cost numeric;
begin
  select * into p from public.purchases where id = p_purchase for update;
  if not found then raise exception 'Purchase not found'; end if;
  if p.status <> 'draft' then raise exception 'Purchase already posted or void'; end if;

  for it in select * from public.purchase_items where purchase_id = p_purchase loop
    v_unit_cost := case when it.qty_base + it.free_qty > 0
                        then it.total / (it.qty_base + it.free_qty) else 0 end;
    v_avg := public.apply_weighted_avg(it.variant_id, it.qty_base + it.free_qty, v_unit_cost);

    insert into public.stock_movements(
      id, company_id, location_id, variant_id, movement_type, qty_base,
      ref_type, ref_id, batch_id, unit_cost, avg_cost_after, entry_date, created_by)
    values(
      gen_random_uuid(), p.company_id, p.location_id, it.variant_id, 'purchase_in',
      it.qty_base + it.free_qty, 'purchase', p.id, it.batch_id,
      v_unit_cost, v_avg, p.entry_date, p.created_by);
  end loop;

  update public.purchases
     set status = 'posted', posted_at = now(),
         due = total - paid
   where id = p_purchase;

  perform public.recalc_daily_summaries(p.company_id, p.entry_date);
end $$;

create or replace function public.post_sale(p_sale uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; it record; v_cogs numeric; v_total_cogs numeric := 0;
begin
  select * into s from public.sales where id = p_sale for update;
  if not found then raise exception 'Sale not found'; end if;
  if s.status <> 'draft' then raise exception 'Sale already posted or void'; end if;

  for it in select * from public.sale_items where sale_id = p_sale loop
    v_cogs := public.variant_avg_cost(it.variant_id);

    update public.sale_items set cogs_per_base = v_cogs where id = it.id;
    v_total_cogs := v_total_cogs + (v_cogs * (it.qty_base + it.free_qty));

    insert into public.stock_movements(
      id, company_id, location_id, variant_id, movement_type, qty_base,
      ref_type, ref_id, batch_id, unit_cost, avg_cost_after, entry_date, created_by)
    values(
      gen_random_uuid(), s.company_id, s.location_id, it.variant_id, 'sale_out',
      -1 * (it.qty_base + it.free_qty), 'sale', s.id, it.batch_id,
      v_cogs, v_cogs, s.entry_date, s.created_by);
  end loop;

  update public.sales
     set status = 'posted', posted_at = now(),
         cogs_total = v_total_cogs,
         due = total - paid
   where id = p_sale;

  perform public.recalc_daily_summaries(s.company_id, s.entry_date);
end $$;

-- Voiding never deletes. It writes reversing movements.
create or replace function public.void_document(
  p_table text, p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare m record; v_company uuid; v_date date;
begin
  for m in select * from public.stock_movements
           where ref_type = p_table and ref_id = p_id loop
    insert into public.stock_movements(
      id, company_id, location_id, variant_id, movement_type, qty_base,
      ref_type, ref_id, unit_cost, avg_cost_after, entry_date, created_by)
    values(
      gen_random_uuid(), m.company_id, m.location_id, m.variant_id, 'adjustment',
      -1 * m.qty_base, p_table || '_void', p_id, m.unit_cost, m.avg_cost_after,
      current_date, auth.uid());
    v_company := m.company_id;
    v_date := m.entry_date;
  end loop;

  if p_table = 'purchase' then
    update public.purchases set status='void', void_reason=p_reason, voided_by=auth.uid()
     where id = p_id returning company_id, entry_date into v_company, v_date;
  elsif p_table = 'sale' then
    update public.sales set status='void', void_reason=p_reason, voided_by=auth.uid()
     where id = p_id returning company_id, entry_date into v_company, v_date;
  end if;

  if v_company is not null then
    perform public.recalc_daily_summaries(v_company, v_date);
  end if;
end $$;


-- =====================================================================
-- SECTION 6 — PARTY BALANCE
-- =====================================================================

create or replace function public.party_balance(p_party uuid)
returns numeric language plpgsql stable as $$
declare p record; v_inv numeric := 0; v_pay numeric := 0; v_ret numeric := 0;
begin
  select * into p from public.parties where id = p_party;
  if not found then return 0; end if;

  if p.type = 'customer' then
    select coalesce(sum(total),0) into v_inv from public.sales
      where customer_id = p_party and status = 'posted';
    select coalesce(sum(amount),0) into v_pay from public.payments
      where party_id = p_party and status = 'posted' and type = 'customer_collection';
    select coalesce(sum(total),0) into v_ret from public.sale_returns
      where customer_id = p_party and status = 'posted';
  else
    select coalesce(sum(total),0) into v_inv from public.purchases
      where supplier_id = p_party and status = 'posted';
    select coalesce(sum(amount),0) into v_pay from public.payments
      where party_id = p_party and status = 'posted' and type = 'supplier_payment';
    select coalesce(sum(total),0) into v_ret from public.purchase_returns
      where supplier_id = p_party and status = 'posted';
  end if;

  return p.opening_balance + v_inv - v_pay - v_ret;
end $$;

-- FIFO allocation of a payment across open invoices
create or replace function public.allocate_payment(p_payment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pay record; inv record; remaining numeric; apply numeric;
begin
  select * into pay from public.payments where id = p_payment;
  if not found then raise exception 'Payment not found'; end if;
  remaining := pay.amount;

  if pay.type = 'customer_collection' then
    for inv in select id, due from public.sales
      where customer_id = pay.party_id and status = 'posted' and due > 0
      order by entry_date asc, created_at asc
    loop
      exit when remaining <= 0;
      apply := least(remaining, inv.due);
      insert into public.payment_allocations(company_id, payment_id, invoice_type, invoice_id, amount)
        values (pay.company_id, pay.id, 'sale', inv.id, apply);
      update public.sales set paid = paid + apply, due = due - apply where id = inv.id;
      remaining := remaining - apply;
    end loop;
  else
    for inv in select id, due from public.purchases
      where supplier_id = pay.party_id and status = 'posted' and due > 0
      order by entry_date asc, created_at asc
    loop
      exit when remaining <= 0;
      apply := least(remaining, inv.due);
      insert into public.payment_allocations(company_id, payment_id, invoice_type, invoice_id, amount)
        values (pay.company_id, pay.id, 'purchase', inv.id, apply);
      update public.purchases set paid = paid + apply, due = due - apply where id = inv.id;
      remaining := remaining - apply;
    end loop;
  end if;

  perform public.recalc_daily_summaries(pay.company_id, pay.entry_date);
end $$;


-- =====================================================================
-- SECTION 7 — EXPENSES
-- =====================================================================

-- Remember free-text titles so the app can autocomplete next time
create or replace function public.trg_expense_title()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.expense_titles(company_id, title, use_count, last_used_at)
  values (new.company_id, trim(new.title), 1, now())
  on conflict (company_id, title) do update
    set use_count = public.expense_titles.use_count + 1,
        last_used_at = now();
  return new;
end $$;

drop trigger if exists trg_expenses_title on public.expenses;
create trigger trg_expenses_title
after insert on public.expenses
for each row execute function public.trg_expense_title();

-- Promote a repeated title into a real category and re-link past entries
create or replace function public.promote_expense_title(
  p_company uuid, p_title text, p_name_bn text, p_is_direct boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_cat uuid;
begin
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

-- Mark an entry as back-dated automatically
create or replace function public.trg_mark_backdated()
returns trigger language plpgsql as $$
begin
  new.is_backdated := (new.entry_date < current_date);
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['expenses','purchases','sales','payments'] loop
    execute format(
      'drop trigger if exists trg_%1$s_backdate on public.%1$I;
       create trigger trg_%1$s_backdate before insert or update of entry_date on public.%1$I
       for each row execute function public.trg_mark_backdated();', t);
  end loop;
end $$;

-- Generate this month's recurring expenses as drafts
create or replace function public.generate_recurring_expenses(p_company uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_date date; n integer := 0;
begin
  for r in select * from public.recurring_expenses
           where company_id = p_company and is_active and auto_create
  loop
    v_date := date_trunc('month', current_date)::date + (r.day_of_month - 1);
    continue when v_date > current_date;
    continue when r.last_generated_at is not null
              and date_trunc('month', r.last_generated_at) = date_trunc('month', current_date);
    continue when r.end_date is not null and v_date > r.end_date;

    insert into public.expenses(
      id, company_id, category_id, title, amount, entry_date,
      status, recurring_id)
    values (gen_random_uuid(), p_company, r.category_id, r.title, r.amount, v_date,
            'pending', r.id);

    update public.recurring_expenses set last_generated_at = current_date where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;


-- =====================================================================
-- SECTION 8 — DAILY SUMMARIES (dashboard source)
-- Back-dated entries trigger a rebuild from that date forward.
-- =====================================================================

create or replace function public.recalc_daily_summaries(
  p_company uuid, p_from date default current_date)
returns void language plpgsql security definer set search_path = public as $$
declare d date; v record;
begin
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
      coalesce((select sum(amount) from public.payments
                where company_id=p_company and entry_date=d and status='posted'
                  and type='customer_collection'),0)                                     as collection_total,
      coalesce((select sum(amount) from public.payments
                where company_id=p_company and entry_date=d and status='posted'
                  and type='supplier_payment'),0)                                        as payment_total,
      coalesce((select sum(amount) from public.expenses
                where company_id=p_company and entry_date=d and status='approved'),0)    as expense_total
    into v;

    insert into public.daily_summaries(
      company_id, summary_date, sales_total, purchase_total, collection_total,
      payment_total, expense_total, cogs_total, gross_profit, net_profit,
      invoice_count, computed_at)
    values(
      p_company, d, v.sales_total, v.purchase_total, v.collection_total,
      v.payment_total, v.expense_total, v.cogs_total,
      v.sales_total - v.cogs_total,
      v.sales_total - v.cogs_total - v.expense_total,
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
      invoice_count    = excluded.invoice_count,
      computed_at      = now();
  end loop;
end $$;

create or replace function public.trg_expense_recalc()
returns trigger language plpgsql security definer set search_path = public as $$
declare d date;
begin
  d := least(coalesce(new.entry_date, current_date), coalesce(old.entry_date, current_date));
  perform public.recalc_daily_summaries(coalesce(new.company_id, old.company_id), d);
  return null;
end $$;

drop trigger if exists trg_expenses_recalc on public.expenses;
create trigger trg_expenses_recalc
after insert or update or delete on public.expenses
for each row execute function public.trg_expense_recalc();


-- =====================================================================
-- SECTION 9 — AUDIT
-- =====================================================================

create or replace function public.trg_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  v_company := coalesce(
    (to_jsonb(new) ->> 'company_id')::uuid,
    (to_jsonb(old) ->> 'company_id')::uuid);

  insert into public.audit_logs(company_id, user_id, action, table_name, record_id,
                                old_value, new_value)
  values(
    v_company, auth.uid(), lower(tg_op), tg_table_name,
    coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return null;
end $$;

-- Attach audit only to money/stock tables
do $$
declare t text;
begin
  foreach t in array array[
    'purchases','sales','payments','expenses','stock_adjustments',
    'variant_units','parties','product_variants','stock_counts']
  loop
    execute format(
      'drop trigger if exists trg_%1$s_audit on public.%1$I;
       create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
       for each row execute function public.trg_audit();', t);
  end loop;
end $$;


-- =====================================================================
-- SECTION 10 — SUBSCRIPTION MAINTENANCE (run daily via pg_cron)
-- =====================================================================

create or replace function public.refresh_company_statuses()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0;
begin
  update public.companies set status = 'active'
   where not is_free and end_date >= current_date
     and status in ('trial','grace','readonly');
  get diagnostics n = row_count;

  update public.companies set status = 'grace'
   where not is_free and end_date < current_date
     and end_date >= current_date - 3 and status <> 'blocked';

  update public.companies set status = 'readonly'
   where not is_free and end_date < current_date - 3
     and end_date >= current_date - 60 and status <> 'blocked';

  update public.companies set status = 'blocked'
   where not is_free and end_date < current_date - 60 and status <> 'blocked';

  update public.companies set status = 'active' where is_free;
  return n;
end $$;

create or replace function public.extend_subscription(
  p_company uuid, p_days integer, p_amount numeric default null,
  p_trx text default null, p_method payment_method default null,
  p_admin uuid default null)
returns date language plpgsql security definer set search_path = public as $$
declare v_old date; v_new date;
begin
  select end_date into v_old from public.companies where id = p_company for update;
  v_new := greatest(coalesce(v_old, current_date), current_date) + p_days;

  update public.companies
     set end_date = v_new, status = 'active'
   where id = p_company;

  insert into public.subscription_history(
    company_id, action, old_end, new_end, amount, trx_id, method, admin_id)
  values (p_company, 'extend', v_old, v_new, p_amount, p_trx, p_method, p_admin);

  return v_new;
end $$;

-- =====================================================================
-- END 02_functions_triggers.sql
-- =====================================================================
