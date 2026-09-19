-- =====================================================================
-- 09_payment_ledger.sql
--
-- ১) লেনদেন খাতা — পেমেন্ট সম্পাদনা ও মুছে ফেলা (বাকি ফেরতসহ)
-- ২) মুছে ফেলা খরচ আর লাভের হিসাবে গুনবে না (07-এর ফাঁক)
-- ৩) খরচের ক্যাটাগরি-ভিত্তিক বিশ্লেষণ
--
-- বারবার চালালেও কিছু নষ্ট হবে না।
-- =====================================================================


-- =====================================================================
-- ১) দৈনিক সারাংশে মুছে ফেলা সারি বাদ
--
-- 06/07-এ deleted_at কলাম যোগ হয়েছিল, কিন্তু এই ফাংশনটা তখন বদলানো
-- হয়নি। ফলে খরচ মুছলেও লাভের হিসাব থেকে বাদ যেত না — ভুতুড়ে খরচ।
-- =====================================================================

create or replace function public.recalc_daily_summaries(
  p_company uuid, p_from date default current_date)
returns void language plpgsql security definer set search_path = public as $$
declare d date; v record; v_stock numeric; v_recv numeric; v_pay numeric;
begin
  -- নিজের কোম্পানি ছাড়া অন্য কারো হিসাব কষা যাবে না
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


-- =====================================================================
-- ২) পেমেন্টের বরাদ্দ ফেরত নেওয়া
--
-- পেমেন্ট মুছলে বা টাকার অঙ্ক বদলালে চালানের "জমা/বাকি" আগের অবস্থায়
-- ফিরিয়ে আনতে হয় — নইলে বাকির হিসাব চিরতরে ভুল হয়ে থাকবে।
-- =====================================================================

create or replace function public.unallocate_payment(p_payment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  for a in select * from public.payment_allocations where payment_id = p_payment loop
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

  delete from public.payment_allocations where payment_id = p_payment;
end $$;

revoke execute on function public.unallocate_payment(uuid) from public, anon, authenticated;


-- =====================================================================
-- ৩) পেমেন্ট বাতিল (মুছে ফেলা)
-- =====================================================================

create or replace function public.void_payment(p_payment uuid, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if not public.has_role(array['owner','manager']::user_role[]) then
    raise exception 'শুধু মালিক বা ম্যানেজার এই কাজটি করতে পারবেন';
  end if;

  select * into p from public.payments where id = p_payment for update;
  if not found then raise exception 'পেমেন্ট পাওয়া যায়নি'; end if;
  if p.company_id <> public.current_company_id() then raise exception 'Forbidden'; end if;
  if p.deleted_at is not null or p.status = 'void' then return 'already_void'; end if;

  perform public.unallocate_payment(p_payment);

  update public.payments
     set status = 'void', deleted_at = now(), void_reason = p_reason, updated_at = now()
   where id = p_payment;

  perform public.log_entity_change('payment', p_payment, 'void',
    jsonb_build_object('amount', p.amount, 'method', p.method), null, p_reason);

  perform public.recalc_daily_summaries(p.company_id, p.entry_date);
  return 'voided';
end $$;

revoke execute on function public.void_payment(uuid, text) from public, anon;
grant  execute on function public.void_payment(uuid, text) to authenticated;


-- =====================================================================
-- ৪) পেমেন্ট সম্পাদনা
--
-- অঙ্ক বদলালে আগের বরাদ্দ ফিরিয়ে নিয়ে নতুন করে বসানো হয়, তাই চালানের
-- জমা/বাকি সবসময় ঠিক থাকে।
-- =====================================================================

create or replace function public.update_payment(
  p_payment     uuid,
  p_amount      numeric,
  p_method      payment_method,
  p_entry_date  date,
  p_bank_name   text default null,
  p_bank_branch text default null,
  p_account_no  text default null,
  p_slip_no     text default null,
  p_purpose     text default null,
  p_note        text default null,
  p_cheque_date date default null
) returns text language plpgsql security definer set search_path = public as $$
declare p record; v_old_date date;
begin
  if not public.has_role(array['owner','manager']::user_role[]) then
    raise exception 'শুধু মালিক বা ম্যানেজার এই কাজটি করতে পারবেন';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'টাকার পরিমাণ শূন্যের বেশি হতে হবে';
  end if;

  select * into p from public.payments where id = p_payment for update;
  if not found then raise exception 'পেমেন্ট পাওয়া যায়নি'; end if;
  if p.company_id <> public.current_company_id() then raise exception 'Forbidden'; end if;
  if p.deleted_at is not null or p.status = 'void' then
    raise exception 'বাতিল করা পেমেন্ট সম্পাদনা করা যায় না';
  end if;

  v_old_date := p.entry_date;

  -- আগের বরাদ্দ ফেরত → নতুন মান বসাই → আবার বরাদ্দ
  perform public.unallocate_payment(p_payment);

  update public.payments
     set amount      = p_amount,
         method      = p_method,
         entry_date  = p_entry_date,
         cheque_date = case when p_method = 'cheque' then p_cheque_date else null end,
         bank_name   = case when p_method in ('bank','cheque') then p_bank_name   else null end,
         bank_branch = case when p_method in ('bank','cheque') then p_bank_branch else null end,
         account_no  = case when p_method in ('bank','cheque') then p_account_no  else null end,
         slip_no     = p_slip_no,
         purpose     = p_purpose,
         purpose_note = p_note,
         updated_at  = now()
   where id = p_payment;

  perform public.allocate_payment(p_payment);

  perform public.log_entity_change('payment', p_payment, 'update',
    jsonb_build_object('amount', p.amount, 'method', p.method, 'entry_date', p.entry_date),
    jsonb_build_object('amount', p_amount, 'method', p_method, 'entry_date', p_entry_date),
    null);

  -- পুরনো ও নতুন — দুই তারিখের হিসাবই আবার মেলাতে হবে
  perform public.recalc_daily_summaries(p.company_id, least(v_old_date, p_entry_date));
  return 'updated';
end $$;

revoke execute on function public.update_payment(uuid, numeric, payment_method, date, text, text, text, text, text, text, date)
  from public, anon;
grant execute on function public.update_payment(uuid, numeric, payment_method, date, text, text, text, text, text, text, date)
  to authenticated;


-- =====================================================================
-- ৫) খরচের ক্যাটাগরি-ভিত্তিক বিশ্লেষণ
-- =====================================================================

create or replace function public.expense_breakdown(
  p_from date,
  p_to   date
) returns jsonb language sql security invoker set search_path = public as $$
  with scoped as (
    select e.*, coalesce(c.name_bn, 'অন্যান্য') as category_name
      from public.expenses e
      left join public.expense_categories c on c.id = e.category_id
     where e.company_id = public.current_company_id()
       and e.status = 'approved'
       and e.deleted_at is null
       and e.entry_date between p_from and p_to
  )
  select jsonb_build_object(
    'total', coalesce((select sum(amount) from scoped), 0),
    'count', (select count(*)::integer from scoped),
    'by_category', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select category_name as name,
               sum(amount)::numeric as amount,
               count(*)::integer    as count
          from scoped group by 1 order by 2 desc
      ) t
    ), '[]'::jsonb),
    'by_day', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select entry_date::text as day, sum(amount)::numeric as amount
          from scoped group by 1 order by 1
      ) t
    ), '[]'::jsonb),
    'by_method', coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select paid_from::text as method, sum(amount)::numeric as amount
          from scoped group by 1 order by 2 desc
      ) t
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.expense_breakdown(date, date) to authenticated;


-- =====================================================================
-- END 09_payment_ledger.sql
-- =====================================================================
