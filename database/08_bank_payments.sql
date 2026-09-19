-- =====================================================================
-- 08_bank_payments.sql
--
-- ব্যাংকে টাকা দেওয়া-নেওয়ার পূর্ণ রেকর্ড। অনেক ক্রেতা ব্যাংকে টাকা
-- জমা দেয় — শুধু "ব্যাংক" লিখে রাখলে পরে মেলানো যায় না। ব্যাংকের নাম,
-- শাখা, জমা স্লিপ নম্বর, কী বাবদ — সব থাকলে হিসাব মেলানো সহজ।
--
-- সব ঘরই ঐচ্ছিক, তাই পুরনো এন্ট্রি অক্ষত থাকে। বারবার চালালেও ক্ষতি নেই।
-- =====================================================================

alter table public.payments add column if not exists bank_name     text;
alter table public.payments add column if not exists bank_branch   text;
alter table public.payments add column if not exists slip_no       text;   -- জমা স্লিপ / রসিদ নম্বর
alter table public.payments add column if not exists account_no    text;
alter table public.payments add column if not exists purpose       text;   -- due | advance | other
alter table public.payments add column if not exists purpose_note  text;   -- কী বাবদ, কোন পণ্যের জন্য
alter table public.payments add column if not exists variant_id    uuid references public.product_variants(id);

alter table public.payments drop constraint if exists payments_purpose_check;
alter table public.payments add constraint payments_purpose_check
  check (purpose is null or purpose in ('due', 'advance', 'other'));

-- ব্যাংকের নামে খোঁজার জন্য
create index if not exists idx_payments_bank
  on public.payments(company_id, bank_name) where bank_name is not null;


-- =====================================================================
-- ব্যাংক লেনদেনের সারাংশ — ড্যাশবোর্ডের কার্ডের জন্য
-- =====================================================================

create or replace function public.bank_payment_summary(
  p_from date default null,
  p_to   date default null
) returns jsonb language sql security invoker set search_path = public as $$
  with scoped as (
    select * from public.payments
     where company_id = public.current_company_id()
       and status = 'posted'
       and deleted_at is null
       and method in ('bank', 'cheque')
       and (p_from is null or entry_date >= p_from)
       and (p_to   is null or entry_date <= p_to)
  )
  select jsonb_build_object(
    'received', coalesce((select sum(amount) from scoped
                           where type = 'customer_collection'), 0),
    'paid',     coalesce((select sum(amount) from scoped
                           where type = 'supplier_payment'), 0),
    'count',    (select count(*)::integer from scoped),
    'by_bank',  coalesce((
      select jsonb_agg(row_to_json(t))
      from (
        select coalesce(bank_name, 'নাম লেখা নেই') as bank,
               sum(amount) filter (where type = 'customer_collection') as received,
               sum(amount) filter (where type = 'supplier_payment')    as paid,
               count(*)::integer as count
          from scoped
         group by 1
         order by 4 desc
         limit 8
      ) t
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.bank_payment_summary(date, date) to authenticated;


-- =====================================================================
-- END 08_bank_payments.sql
-- =====================================================================
