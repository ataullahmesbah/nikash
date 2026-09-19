# Nikash — Database Setup

ডেভেলপারদের জন্য নির্দেশনা। PRD-র সাথে এই ফোল্ডারটি দিন।

## চালানোর ক্রম

Supabase SQL Editor-এ ঠিক এই ক্রমে চালান:

```
01_schema.sql            টেবিল, enum, ইনডেক্স
02_functions_triggers.sql ফাংশন, ট্রিগার, ব্যবসায়িক যুক্তি
03_rls_policies.sql      Row Level Security
04_seed.sql              প্ল্যান, কোম্পানি প্রভিশনিং, ভিউ
```

প্রতিটি ফাইল চালানোর পর ত্রুটি আছে কিনা দেখে নিন, তারপর পরেরটায় যান।

## Auth সেটআপ

Supabase Auth ব্যবহার হবে **email + password** দিয়ে। ফোন নম্বরকে সিন্থেটিক ইমেইলে রূপান্তর করুন:

```
01712345678  →  01712345678@nikash.app
```

কারণ Supabase-এর phone auth-এ SMS provider লাগে, যার খরচ আছে। ব্যবহারকারী শুধু ফোন নম্বর দেখবে, রূপান্তরটা অ্যাপ নিজে করবে।

`public.users.id` অবশ্যই `auth.users.id`-র সমান হতে হবে — RLS এর উপরেই দাঁড়িয়ে আছে।

## নতুন কোম্পানি তৈরি

অ্যাডমিন প্যানেল থেকে (service_role দিয়ে):

```sql
-- ১. আগে auth.users-এ owner তৈরি করুন (Supabase Admin API)
-- ২. তারপর:
select provision_company(
  'রহমান ট্রেডার্স',      -- ব্যবসার নাম
  'warehouse',            -- vendor | warehouse | shop
  'আব্দুর রহমান',         -- মালিকের নাম
  '01712345678',          -- ফোন
  '<auth_user_uuid>'      -- auth.users থেকে পাওয়া id
);
```

এতে কোম্পানি, সেটিংস, ডিফল্ট লোকেশন, ১৩টি খরচ ক্যাটাগরি আর ১৫ দিনের ট্রায়াল তৈরি হয়ে যাবে।

নমুনা পণ্য চাইলে: `select seed_starter_catalogue('<company_id>');`

## মূল নিয়ম (ভাঙবেন না)

**১. স্টক কখনো সরাসরি update নয়।** `stock_movements`-এ নতুন সারি লিখুন। বর্তমান স্টক = `variant_stock(variant_id)` বা `v_current_stock` ভিউ।

**২. কোনো DELETE নেই।** `authenticated` রোলে DELETE grant দেওয়াই হয়নি। বাতিল করতে `status = 'void'`, লুকাতে `is_archived = true`।

**৩. পরিমাণ সবসময় base unit-এ।** `qty_base` কলামে। ইউজারের দেওয়া পরিমাণকে `to_base_qty(unit_id, qty)` দিয়ে রূপান্তর করুন।

**৪. `id` ক্লায়েন্ট তৈরি করবে** — `purchases`, `sales`, `payments`, `expenses`, `stock_movements`, `purchase_returns`, `sale_returns`, `stock_adjustments` টেবিলে। অফলাইনে ফোনেই UUID বানান, sync-এ `on conflict (id) do nothing` দিলে ডুপ্লিকেট হবে না।

**৫. Draft → Post।** ইনভয়েস প্রথমে draft, তারপর `post_purchase(id)` বা `post_sale(id)` কল করলে স্টক ও লেজারে প্রভাব পড়বে।

**৬. ড্যাশবোর্ড `daily_summaries` থেকে পড়বে**, কাঁচা লেনদেন থেকে নয়। পিছনের তারিখে এন্ট্রি দিলে `recalc_daily_summaries()` নিজে থেকেই চলে।

**৭. service_role key কখনো ক্লায়েন্টে নয়।** শুধু Next.js-এর সার্ভার সাইডে।

## গুরুত্বপূর্ণ ফাংশন

| ফাংশন | কাজ |
|---|---|
| `provision_company(...)` | নতুন কোম্পানি সেটআপ |
| `post_purchase(id)` / `post_sale(id)` | ড্রাফট পোস্ট করা, স্টক ও লেজার লেখা |
| `void_document('sale', id, reason)` | বাতিল করা (reverse movement লিখবে) |
| `allocate_payment(id)` | FIFO ভিত্তিতে পেমেন্ট ইনভয়েসে বসানো |
| `variant_stock(variant, location, as_of)` | বর্তমান বা নির্দিষ্ট তারিখের স্টক |
| `variant_avg_cost(variant)` | weighted average cost |
| `format_stock(variant, qty)` | "৩ ব্যাগ ১০ পিস" |
| `to_base_qty(unit_id, qty)` | ইউনিট রূপান্তর |
| `party_balance(party)` | পার্টির বর্তমান বাকি |
| `recalc_daily_summaries(company, from)` | ড্যাশবোর্ডের হিসাব পুনর্গণনা |
| `promote_expense_title(...)` | বারবার ব্যবহৃত খরচের নামকে ক্যাটাগরি বানানো |
| `generate_recurring_expenses(company)` | মাসিক নিয়মিত খরচ তৈরি |
| `extend_subscription(company, days, ...)` | মেয়াদ বাড়ানো |
| `refresh_company_statuses()` | trial/grace/readonly/blocked হালনাগাদ |
| `next_doc_no(company, type, prefix)` | ইনভয়েস নম্বর |

## ভিউ

`v_current_stock`, `v_receivables`, `v_payables`, `v_monthly_summary`, `v_platform_revenue`

## Cron

`04_seed.sql`-এর শেষে pg_cron-এর কোড মন্তব্য করে রাখা আছে। Supabase-এ `pg_cron` এক্সটেনশন চালু করে মন্তব্য তুলে দিন। চারটি কাজ: স্ট্যাটাস হালনাগাদ, নিয়মিত খরচ, দৈনিক সারসংক্ষেপ, পুরনো inbound invoice বাতিল।

## ব্যাকআপ

ফ্রি টিয়ারে অটো ব্যাকআপ নেই। **প্রথম দিন থেকেই** GitHub Actions দিয়ে রোজ রাতে `pg_dump` চালিয়ে প্রাইভেট রিপোতে রাখুন। টাকার হিসাব যেখানে, ব্যাকআপ ছাড়া চালাবেন না।

## পারফরম্যান্স নোট

`v_current_stock` ভিউ প্রতিটি সারিতে `variant_avg_cost()` কল করে — প্রোডাক্ট বেশি হলে ধীর হবে। ৫০০+ ভ্যারিয়েন্ট হলে `stock_snapshots` টেবিলে রাতে snapshot লিখে সেখান থেকে পড়ুন।
