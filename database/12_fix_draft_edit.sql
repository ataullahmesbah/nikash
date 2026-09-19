-- =====================================================================
-- Nikash — 12_fix_draft_edit.sql
--
-- "সংরক্ষণ ব্যর্থ হয়েছে" দেখায়, অথচ পিছনে গেলে সেভ হয়ে আছে — এই
-- গোলমালের আসল কারণ।
--
-- ০৩ নম্বর ফাইলে ইচ্ছে করেই কোনো DELETE নীতি রাখা হয়নি ("কিছুই হার্ড
-- ডিলিট হয় না")। কিন্তু চালান সম্পাদনার কোড সরাসরি
-- `delete from sale_items` চালাত। RLS-এ DELETE নীতি না থাকলে Postgres
-- এরর দেয় না — চুপচাপ শূন্যটা সারি মোছে। ফলে:
--
--   ১. হেডার (মোট, জমা, বাকি) আপডেট হয়ে যেত → "সেভ হয়েছে" মনে হতো
--   ২. পুরনো লাইনগুলো থেকে যেত, উপরে নতুন লাইন যোগ হতো → লাইন দ্বিগুণ
--   ৩. আবার Post করলে স্টক দ্বিগুণ কাটতে গিয়ে ব্যর্থ → "সংরক্ষণ ব্যর্থ"
--
-- সমাধান: লাইন মোছার জন্য একটা নিয়ন্ত্রিত ফাংশন, যেটা নিজের কোম্পানির
-- ড্রাফট চালান ছাড়া কিছুতেই হাত দেয় না।
-- =====================================================================

create or replace function public.clear_document_lines(p_type text, p_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
  v_status  text;
  v_deleted integer := 0;
  v_n       integer;
begin
  if p_type not in ('sale', 'purchase') then
    raise exception 'Invalid document type: %', p_type;
  end if;

  -- মালিক ও ম্যানেজার ছাড়াও বিক্রয়কর্মী নিজের ড্রাফট ঠিক করতে পারবে,
  -- কারণ ড্রাফটে হিসাবের কোনো প্রভাব নেই (পোস্ট করলে তবেই স্টক নড়ে)।
  if not public.has_role(
       array['owner','manager','salesman','cashier','storekeeper']::user_role[]) then
    raise exception 'এই কাজটি করার অনুমতি নেই';
  end if;

  if p_type = 'sale' then
    select company_id, status into v_company, v_status
      from public.sales where id = p_id for update;
  else
    select company_id, status into v_company, v_status
      from public.purchases where id = p_id for update;
  end if;

  if v_company is null then raise exception 'চালানটি পাওয়া যায়নি'; end if;
  if v_company <> public.current_company_id() then raise exception 'Forbidden'; end if;

  -- ⚠️ সবচেয়ে জরুরি শর্ত: শুধু ড্রাফট। পোস্ট করা চালানের লাইন মুছলে
  -- স্টক ও লাভের হিসাব ভেঙে যাবে — সেটার জন্য আগে unpost করতে হয়।
  if v_status <> 'draft' then
    raise exception 'শুধু ড্রাফট চালানের লাইন বদলানো যায় (আগে সম্পাদনার জন্য খুলুন)';
  end if;

  if p_type = 'sale' then
    delete from public.sale_items where sale_id = p_id and company_id = v_company;
    get diagnostics v_deleted = row_count;
  else
    delete from public.purchase_items where purchase_id = p_id and company_id = v_company;
    get diagnostics v_deleted = row_count;

    -- ক্রয় সম্পাদনায় ওই চালানের ব্যাচগুলোও যায়, নইলে পুরনো ব্যাচ
    -- পড়ে থেকে FEFO-র হিসাব গুলিয়ে দেবে। যে ব্যাচ থেকে ইতিমধ্যে মাল
    -- বেরিয়ে গেছে সেটায় হাত দিই না — তাহলে বিক্রির হিসাব নষ্ট হতো।
    delete from public.batches b
     where b.purchase_id = p_id
       and b.company_id = v_company
       and not exists (
         select 1 from public.stock_movements m
          where m.batch_id = b.id and m.ref_type <> 'purchase'
       );
    get diagnostics v_n = row_count;
    v_deleted := v_deleted + v_n;
  end if;

  return v_deleted;
end $$;

revoke execute on function public.clear_document_lines(text, uuid) from public, anon;
grant  execute on function public.clear_document_lines(text, uuid) to authenticated;
