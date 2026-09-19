-- =====================================================================
-- Nikash — 05_security_and_feature_fixes.sql
-- Run AFTER 04_seed.sql. Patches critical security holes and closes
-- functional gaps found during review of 01-04.
-- =====================================================================

-- =====================================================================
-- SECTION 1 — LOCK DOWN PLATFORM-ONLY FUNCTIONS
-- These must only ever run from the admin panel's server side
-- (service_role key), never from the phone app / browser client.
-- =====================================================================

alter default privileges in schema public revoke execute on functions from public;

revoke execute on function public.provision_company(text, business_type, text, text, uuid)
  from public, authenticated, anon;
grant  execute on function public.provision_company(text, business_type, text, text, uuid)
  to service_role;

revoke execute on function public.extend_subscription(uuid, integer, numeric, text, payment_method, uuid)
  from public, authenticated, anon;
grant  execute on function public.extend_subscription(uuid, integer, numeric, text, payment_method, uuid)
  to service_role;

revoke execute on function public.refresh_company_statuses()
  from public, authenticated, anon;
grant  execute on function public.refresh_company_statuses()
  to service_role;

revoke execute on function public.generate_recurring_expenses(uuid)
  from public, authenticated, anon;
grant  execute on function public.generate_recurring_expenses(uuid)
  to service_role;

revoke execute on function public.seed_starter_catalogue(uuid)
  from public, authenticated, anon;
grant  execute on function public.seed_starter_catalogue(uuid)
  to service_role;


-- =====================================================================
-- SECTION 2 — TENANT-OWNERSHIP CHECKS INSIDE SECURITY DEFINER FUNCTIONS
-- Without these, any logged-in user of ANY company could act on another
-- company's rows by id, because these functions bypass RLS by design.
-- =====================================================================

create or replace function public.post_purchase(p_purchase uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p record; it record; v_avg numeric; v_unit_cost numeric;
begin
  select * into p from public.purchases where id = p_purchase for update;
  if not found then raise exception 'Purchase not found'; end if;
  if p.company_id <> public.current_company_id() then
    raise exception 'Forbidden: purchase belongs to another company';
  end if;
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
  if s.company_id <> public.current_company_id() then
    raise exception 'Forbidden: sale belongs to another company';
  end if;
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

create or replace function public.void_document(
  p_table text, p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare m record; v_doc_company uuid; v_date date;
begin
  if p_table not in ('purchase','sale') then
    raise exception 'Unsupported document type: %', p_table;
  end if;

  if p_table = 'purchase' then
    select company_id, entry_date into v_doc_company, v_date from public.purchases where id = p_id;
  else
    select company_id, entry_date into v_doc_company, v_date from public.sales where id = p_id;
  end if;

  if v_doc_company is null then raise exception 'Document not found'; end if;
  if v_doc_company <> public.current_company_id() then
    raise exception 'Forbidden: document belongs to another company';
  end if;

  for m in select * from public.stock_movements
           where ref_type = p_table and ref_id = p_id loop
    insert into public.stock_movements(
      id, company_id, location_id, variant_id, movement_type, qty_base,
      ref_type, ref_id, unit_cost, avg_cost_after, entry_date, created_by)
    values(
      gen_random_uuid(), m.company_id, m.location_id, m.variant_id, 'adjustment',
      -1 * m.qty_base, p_table || '_void', p_id, m.unit_cost, m.avg_cost_after,
      current_date, auth.uid());
  end loop;

  if p_table = 'purchase' then
    update public.purchases set status='void', void_reason=p_reason, voided_by=auth.uid()
     where id = p_id;
  else
    update public.sales set status='void', void_reason=p_reason, voided_by=auth.uid()
     where id = p_id;
  end if;

  perform public.recalc_daily_summaries(v_doc_company, v_date);
end $$;

create or replace function public.allocate_payment(p_payment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pay record; inv record; remaining numeric; apply numeric;
begin
  select * into pay from public.payments where id = p_payment;
  if not found then raise exception 'Payment not found'; end if;
  if pay.company_id <> public.current_company_id() then
    raise exception 'Forbidden: payment belongs to another company';
  end if;
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
-- SECTION 3 — PRICE-CHANGE PERMISSION: OWNER ONLY (PRD 5.2)
-- =====================================================================

drop policy if exists variant_units_update on public.variant_units;
create policy variant_units_update on public.variant_units
for update to authenticated
using (company_id = public.current_company_id()
       and public.company_can_write()
       and public.is_owner())
with check (company_id = public.current_company_id());


-- =====================================================================
-- SECTION 4 — ROLE-BASED WRITE POLICIES (PRD 5.2 permission matrix)
-- Overrides the generic "any role can write" policies from 03 on the
-- tables where the PRD names specific roles.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['categories','products','product_variants'] loop
    execute format('drop policy if exists %1$s_insert on public.%1$I;', t);
    execute format($p$
      create policy %1$s_insert on public.%1$I
      for insert to authenticated
      with check (company_id = public.current_company_id()
                  and public.company_can_write()
                  and public.has_role(array['owner','manager']::user_role[]));
    $p$, t);

    execute format('drop policy if exists %1$s_update on public.%1$I;', t);
    execute format($p$
      create policy %1$s_update on public.%1$I
      for update to authenticated
      using (company_id = public.current_company_id()
             and public.company_can_write()
             and public.has_role(array['owner','manager']::user_role[]))
      with check (company_id = public.current_company_id());
    $p$, t);
  end loop;
end $$;

drop policy if exists parties_insert on public.parties;
create policy parties_insert on public.parties
for insert to authenticated
with check (company_id = public.current_company_id()
            and public.company_can_write()
            and public.has_role(array['owner','manager','salesman','cashier']::user_role[]));

drop policy if exists purchases_insert on public.purchases;
create policy purchases_insert on public.purchases
for insert to authenticated
with check (company_id = public.current_company_id()
            and public.company_can_write()
            and public.has_role(array['owner','manager','storekeeper']::user_role[]));

drop policy if exists sales_insert on public.sales;
create policy sales_insert on public.sales
for insert to authenticated
with check (company_id = public.current_company_id()
            and public.company_can_write()
            and public.has_role(array['owner','manager','salesman','cashier']::user_role[]));

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
for insert to authenticated
with check (company_id = public.current_company_id()
            and public.company_can_write()
            and public.has_role(array['owner','manager','accountant','salesman','cashier']::user_role[]));

drop policy if exists stock_adjustments_insert on public.stock_adjustments;
create policy stock_adjustments_insert on public.stock_adjustments
for insert to authenticated
with check (company_id = public.current_company_id()
            and public.company_can_write()
            and public.has_role(array['owner','manager']::user_role[]));

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
for insert to authenticated
with check (
  company_id = public.current_company_id()
  and public.company_can_write()
  and (
    (type = 'customer_collection' and public.has_role(array['owner','manager','salesman','cashier','accountant']::user_role[]))
    or
    (type = 'supplier_payment' and public.has_role(array['owner','accountant']::user_role[]))
  )
);


-- =====================================================================
-- SECTION 5 — STOCK ADJUSTMENT / COUNT APPROVAL ACTUALLY MOVES STOCK
-- Previously: approving an adjustment or count changed nothing in
-- stock_movements, so current stock (= sum of stock_movements) never
-- reflected the correction.
-- =====================================================================

create or replace function public.trg_stock_adjustment_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then

    insert into public.stock_movements(
      id, company_id, location_id, variant_id, movement_type, qty_base,
      ref_type, ref_id, unit_cost, avg_cost_after, entry_date, created_by)
    values (
      gen_random_uuid(), new.company_id, new.location_id, new.variant_id, 'adjustment',
      new.qty_base, 'stock_adjustment', new.id,
      public.variant_avg_cost(new.variant_id), public.variant_avg_cost(new.variant_id),
      new.entry_date, new.created_by);

    if coalesce(new.value_loss, 0) > 0 then
      insert into public.expenses(
        id, company_id, title, amount, entry_date, status, created_by, note)
      values (
        gen_random_uuid(), new.company_id,
        'স্টক সমন্বয় ক্ষতি (' || new.reason::text || ')', new.value_loss, new.entry_date,
        'approved', new.created_by, 'Auto-generated from stock_adjustments ' || new.id);
    end if;

    perform public.recalc_daily_summaries(new.company_id, new.entry_date);
  end if;
  return new;
end $$;

drop trigger if exists trg_stock_adj_post on public.stock_adjustments;
create trigger trg_stock_adj_post
after insert or update of status on public.stock_adjustments
for each row execute function public.trg_stock_adjustment_post();

-- Approve a stock count: turns every counted difference into an
-- approved stock_adjustment (which the trigger above then posts).
create or replace function public.approve_stock_count(p_count uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare c record; it record; n integer := 0;
begin
  select * into c from public.stock_counts where id = p_count for update;
  if not found then raise exception 'Stock count not found'; end if;
  if c.company_id <> public.current_company_id() then raise exception 'Forbidden'; end if;
  if c.status = 'approved' then raise exception 'Already approved'; end if;

  for it in
    select * from public.stock_count_items
    where count_id = p_count and coalesce(counted_qty,0) <> system_qty
  loop
    insert into public.stock_adjustments(
      id, company_id, location_id, variant_id, qty_base, reason, note,
      created_by, approved_by, approved_at, status)
    values (
      gen_random_uuid(), c.company_id, c.location_id, it.variant_id,
      it.difference, 'count_error', 'From stock count ' || p_count,
      c.started_by, auth.uid(), now(), 'approved');
    n := n + 1;
  end loop;

  update public.stock_counts
     set status = 'approved', approved_by = auth.uid(), approved_at = now()
   where id = p_count;

  return n;
end $$;


-- =====================================================================
-- SECTION 6 — RETURN POSTING (was missing entirely)
-- =====================================================================

create or replace function public.post_purchase_return(p_return uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record; it record;
begin
  select * into r from public.purchase_returns where id = p_return for update;
  if not found then raise exception 'Purchase return not found'; end if;
  if r.company_id <> public.current_company_id() then raise exception 'Forbidden'; end if;
  if r.status <> 'draft' then raise exception 'Already posted or void'; end if;

  for it in select * from public.purchase_return_items where purchase_return_id = p_return loop
    insert into public.stock_movements(
      id, company_id, location_id, variant_id, movement_type, qty_base,
      ref_type, ref_id, unit_cost, avg_cost_after, entry_date, created_by)
    values (
      gen_random_uuid(), r.company_id, r.location_id, it.variant_id, 'purchase_return',
      -1 * it.qty_base, 'purchase_return', r.id, it.unit_price,
      public.variant_avg_cost(it.variant_id), r.entry_date, r.created_by);
  end loop;

  update public.purchase_returns set status = 'posted' where id = p_return;
  perform public.recalc_daily_summaries(r.company_id, r.entry_date);
end $$;

create or replace function public.post_sale_return(p_return uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record; it record;
begin
  select * into r from public.sale_returns where id = p_return for update;
  if not found then raise exception 'Sale return not found'; end if;
  if r.company_id <> public.current_company_id() then raise exception 'Forbidden'; end if;
  if r.status <> 'draft' then raise exception 'Already posted or void'; end if;

  for it in select * from public.sale_return_items where sale_return_id = p_return loop
    insert into public.stock_movements(
      id, company_id, location_id, variant_id, movement_type, qty_base,
      ref_type, ref_id, unit_cost, avg_cost_after, entry_date, created_by)
    values (
      gen_random_uuid(), r.company_id, r.location_id, it.variant_id, 'sale_return',
      it.qty_base, 'sale_return', r.id, it.unit_price,
      public.variant_avg_cost(it.variant_id), r.entry_date, r.created_by);
  end loop;

  update public.sale_returns set status = 'posted' where id = p_return;
  perform public.recalc_daily_summaries(r.company_id, r.entry_date);
end $$;


-- =====================================================================
-- SECTION 7 — STOCK TRANSFER COMPLETION (was missing entirely)
-- =====================================================================

create or replace function public.post_stock_transfer(p_transfer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t record; it record;
begin
  select * into t from public.stock_transfers where id = p_transfer for update;
  if not found then raise exception 'Transfer not found'; end if;
  if t.company_id <> public.current_company_id() then raise exception 'Forbidden'; end if;
  if t.status <> 'draft' then raise exception 'Already sent or received'; end if;

  for it in select * from public.stock_transfer_items where transfer_id = p_transfer loop
    insert into public.stock_movements(
      id, company_id, location_id, variant_id, movement_type, qty_base,
      ref_type, ref_id, entry_date, created_by)
    values (
      gen_random_uuid(), t.company_id, t.from_location_id, it.variant_id, 'transfer_out',
      -1 * it.qty_base, 'transfer', t.id, t.entry_date, t.sent_by);
  end loop;

  update public.stock_transfers set status = 'in_transit' where id = p_transfer;
end $$;

create or replace function public.receive_stock_transfer(p_transfer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t record; it record;
begin
  select * into t from public.stock_transfers where id = p_transfer for update;
  if not found then raise exception 'Transfer not found'; end if;
  if t.company_id <> public.current_company_id() then raise exception 'Forbidden'; end if;
  if t.status <> 'in_transit' then raise exception 'Not in transit'; end if;

  for it in select * from public.stock_transfer_items where transfer_id = p_transfer loop
    insert into public.stock_movements(
      id, company_id, location_id, variant_id, movement_type, qty_base,
      ref_type, ref_id, entry_date, created_by)
    values (
      gen_random_uuid(), t.company_id, t.to_location_id, it.variant_id, 'transfer_in',
      it.qty_base, 'transfer', t.id, current_date, auth.uid());
  end loop;

  update public.stock_transfers
     set status = 'received', received_by = auth.uid(), received_at = now()
   where id = p_transfer;
end $$;


-- =====================================================================
-- SECTION 8 — PAYMENT REVERSAL (was missing entirely)
-- =====================================================================

create or replace function public.reverse_payment(p_payment uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare pay record; a record;
begin
  select * into pay from public.payments where id = p_payment for update;
  if not found then raise exception 'Payment not found'; end if;
  if pay.company_id <> public.current_company_id() then raise exception 'Forbidden'; end if;
  if pay.status = 'void' then raise exception 'Already reversed'; end if;

  for a in select * from public.payment_allocations where payment_id = p_payment loop
    if a.invoice_type = 'sale' then
      update public.sales set paid = paid - a.amount, due = due + a.amount where id = a.invoice_id;
    else
      update public.purchases set paid = paid - a.amount, due = due + a.amount where id = a.invoice_id;
    end if;
  end loop;

  delete from public.payment_allocations where payment_id = p_payment;

  update public.payments
     set status = 'void', voided_by = auth.uid(), void_reason = p_reason
   where id = p_payment;

  perform public.recalc_daily_summaries(pay.company_id, pay.entry_date);
end $$;


-- =====================================================================
-- SECTION 9 — daily_summaries: actually fill stock_value / receivable /
-- payable / cash_in_hand (previously always 0).
-- NOTE: receivable/payable/stock_value are point-in-time balances, not
-- daily deltas, so they are computed accurately only for "today" (the
-- last day of the loop) and left unchanged for past days being
-- recalculated after a back-dated entry. cash_in_hand is a true daily
-- delta (today's collection - payment - expense) so it recomputes
-- correctly for every day in range.
-- =====================================================================

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

grant execute on function public.recalc_daily_summaries(uuid, date) to authenticated;


-- =====================================================================
-- SECTION 10 — PLAN LIMITS: max_users / max_devices actually enforced
-- =====================================================================

create or replace function public.trg_check_user_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max integer; v_count integer;
begin
  select max_users into v_max from public.companies where id = new.company_id;
  select count(*) into v_count from public.users where company_id = new.company_id and is_active;
  if v_max is not null and v_count >= v_max then
    raise exception 'User limit reached for this plan (max %)', v_max;
  end if;
  return new;
end $$;

drop trigger if exists trg_users_limit on public.users;
create trigger trg_users_limit
before insert on public.users
for each row execute function public.trg_check_user_limit();

create or replace function public.trg_check_device_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max integer; v_count integer;
begin
  select max_devices into v_max from public.companies where id = new.company_id;
  select count(*) into v_count from public.devices where company_id = new.company_id;
  if v_max is not null and v_count >= v_max then
    raise exception 'Device limit reached for this plan (max %)', v_max;
  end if;
  return new;
end $$;

drop trigger if exists trg_devices_limit on public.devices;
create trigger trg_devices_limit
before insert on public.devices
for each row execute function public.trg_check_device_limit();


-- =====================================================================
-- SECTION 11 — PUSH NOTIFICATION TOKEN (needed for Expo Push)
-- =====================================================================

alter table public.devices add column if not exists push_token text;


-- =====================================================================
-- SECTION 12 — BATCH REMAINING QTY AUTO-MAINTAINED (was always 0)
-- =====================================================================

create or replace function public.trg_batch_qty_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.batch_id is not null then
    update public.batches
       set qty_base_remaining = qty_base_remaining + new.qty_base,
           updated_at = now()
     where id = new.batch_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_moves_batch on public.stock_movements;
create trigger trg_moves_batch
after insert on public.stock_movements
for each row execute function public.trg_batch_qty_update();


-- =====================================================================
-- SECTION 13 — MONTH CLOSE (PRD 16.7 / 16.8: "মাস বন্ধ করার সুবিধা")
-- =====================================================================

alter table public.company_settings add column if not exists closed_through date;

create or replace function public.trg_check_month_open()
returns trigger language plpgsql as $$
declare v_closed date;
begin
  select closed_through into v_closed
  from public.company_settings where company_id = new.company_id;

  if v_closed is not null and new.entry_date <= v_closed then
    raise exception 'This period is closed for editing. Ask the Owner to reopen the month first.';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['purchases','sales','expenses','payments','stock_adjustments'] loop
    execute format(
      'drop trigger if exists trg_%1$s_month_check on public.%1$I;
       create trigger trg_%1$s_month_check before insert or update of entry_date on public.%1$I
       for each row execute function public.trg_check_month_open();', t);
  end loop;
end $$;

-- Only the Owner may open/close a month
create or replace function public.set_month_closed(p_through date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'Only the Owner can close/reopen a month';
  end if;
  update public.company_settings
     set closed_through = p_through
   where company_id = public.current_company_id();
end $$;

-- =====================================================================
-- SECTION 14 — CHEQUE CLEARING TRACKING (decided: yes, track it)
-- payments.cheque_date already existed; adds a clearing state machine.
-- Bounced cheque auto-reverses the payment via reverse_payment().
-- =====================================================================

alter table public.payments add column if not exists cheque_status text
  check (cheque_status in ('pending','cleared','bounced'));

update public.payments
   set cheque_status = 'pending'
 where method = 'cheque' and cheque_status is null and status = 'posted';

create index if not exists idx_payments_cheque_pending
  on public.payments(company_id, cheque_date)
  where method = 'cheque' and cheque_status = 'pending';

create or replace function public.mark_cheque_cleared(p_payment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pay record;
begin
  select * into pay from public.payments where id = p_payment;
  if not found then raise exception 'Payment not found'; end if;
  if pay.company_id <> public.current_company_id() then raise exception 'Forbidden'; end if;
  if pay.method <> 'cheque' then raise exception 'Not a cheque payment'; end if;

  update public.payments set cheque_status = 'cleared' where id = p_payment;
end $$;

create or replace function public.mark_cheque_bounced(p_payment uuid, p_reason text default 'Cheque bounced')
returns void language plpgsql security definer set search_path = public as $$
declare pay record;
begin
  select * into pay from public.payments where id = p_payment;
  if not found then raise exception 'Payment not found'; end if;
  if pay.company_id <> public.current_company_id() then raise exception 'Forbidden'; end if;
  if pay.method <> 'cheque' then raise exception 'Not a cheque payment'; end if;

  update public.payments set cheque_status = 'bounced' where id = p_payment;
  perform public.reverse_payment(p_payment, p_reason);
end $$;

-- =====================================================================
-- SECTION 15 — CRITICAL: views were leaking data across tenants.
-- By default a Postgres view runs with the privileges of its OWNER when
-- checking the underlying tables, not the querying user — so RLS on
-- sales/purchases/stock_movements was silently bypassed for anyone
-- querying these views (v_receivables, v_payables, v_current_stock,
-- v_monthly_summary), letting any company see every other company's
-- dues and stock. security_invoker (PG 15+) makes the view respect the
-- caller's own RLS instead of the owner's.
-- =====================================================================

alter view public.v_current_stock   set (security_invoker = true);
alter view public.v_receivables     set (security_invoker = true);
alter view public.v_payables        set (security_invoker = true);
alter view public.v_monthly_summary set (security_invoker = true);
-- v_platform_revenue is intentionally platform-wide (admin panel only,
-- queried exclusively via service_role) — left as-is on purpose.

-- =====================================================================
-- SECTION 16 — next_doc_no() also missed the tenant-ownership check
-- (same pattern as section 2): any user could pass another company's id
-- and consume/write to that company's doc_counters row.
-- =====================================================================

create or replace function public.next_doc_no(p_company uuid, p_type text, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare v_no bigint;
begin
  if p_company <> public.current_company_id() then
    raise exception 'Forbidden';
  end if;

  insert into doc_counters(company_id, doc_type, last_no)
  values (p_company, p_type, 1)
  on conflict (company_id, doc_type)
    do update set last_no = doc_counters.last_no + 1
  returning last_no into v_no;

  return p_prefix || '-' || to_char(current_date,'YYMM') || '-' || lpad(v_no::text, 5, '0');
end $$;

grant execute on function public.next_doc_no(uuid, text, text) to authenticated;

-- =====================================================================
-- SECTION 17 — TARGETS: OWNER ONLY (PRD 9.2 #3 goal-progress ring)
-- Section 4 restricted the other sensitive tables to their PRD-named
-- roles but missed `targets`, which was still writable by any tenant
-- role under the generic 03 policy. Setting the monthly sales goal is
-- an owner decision, not a floor-staff one.
-- =====================================================================

drop policy if exists targets_insert on public.targets;
create policy targets_insert on public.targets
for insert to authenticated
with check (company_id = public.current_company_id()
            and public.company_can_write()
            and public.is_owner());

drop policy if exists targets_update on public.targets;
create policy targets_update on public.targets
for update to authenticated
using (company_id = public.current_company_id()
       and public.company_can_write()
       and public.is_owner())
with check (company_id = public.current_company_id());

-- =====================================================================
-- END 05_security_and_feature_fixes.sql
-- =====================================================================
