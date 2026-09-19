# Nikash — PRD v3 Final Addendum

**সংযুক্ত থাকবে:** `Nikash_PRD_v2.md` (মূল PRD, অপরিবর্তিত) + `01_schema.sql` → `05_security_and_feature_fixes.sql`
**এই ডকুমেন্ট কী:** v2.3-এর "অমীমাংসিত প্রশ্ন" (সেকশন ৩১)-এর চূড়ান্ত সিদ্ধান্ত + রিভিউতে পাওয়া টেকনিক্যাল সমস্যার সমাধান-সারাংশ। Development শুরুর আগে এই ফাইলটাই শেষ কথা।

---

## ১. চালানোর ক্রম (আপডেটেড)

```
01_schema.sql
02_functions_triggers.sql
03_rls_policies.sql
04_seed.sql
05_security_and_feature_fixes.sql   ← নতুন, বাধ্যতামূলক
```

`05` ছাড়া সিস্টেম চালু হবে ঠিকই, কিন্তু নিচের গুরুতর সমস্যাগুলো থেকে যাবে — তাই এটা optional না, must-run।

---

## ২. সেকশন ৩১-এর প্রশ্নের চূড়ান্ত উত্তর

| # | প্রশ্ন | চূড়ান্ত সিদ্ধান্ত |
|---|---|---|
| ১ | প্যাকেজের দাম ব্যবসার ধরন অনুযায়ী আলাদা হবে কিনা | **হ্যাঁ, কিন্তু কোডে hardcode না।** `plans` টেবিল থেকে Super Admin প্যানেল যেকোনো সময় দাম/মেয়াদ/লিমিট বদলাতে পারবে (schema আগে থেকেই এটা সাপোর্ট করে)। প্রাথমিক মান হিসেবে `04_seed.sql`-এর মানগুলোই থাকবে (Shop ৳৩০০, Warehouse ৳৫০০, Vendor ৳৮০০/মাস) — Admin প্যানেল থেকে ইচ্ছেমতো বদলানো যাবে |
| ২ | সংযুক্ত অ্যাকাউন্টে নিচের পক্ষকে ছাড় | **না, স্বয়ংক্রিয় ছাড় থাকবে না।** কারণ কেউ নিজের দুটো অ্যাকাউন্ট বানিয়ে সংযুক্ত করে ছাড় নিতে পারতো (abuse vector)। ইচ্ছে করলে ভবিষ্যতে Admin ম্যানুয়ালি নির্দিষ্ট কোম্পানিকে প্রোমো/ফ্রি ডে দিতে পারবে (`extend_subscription`, service_role-only) |
| ৩ | একাধিক গুদাম v1-এ লাগবে কিনা | **হ্যাঁ, v1 (ধাপ ২)-এই থাকবে।** `locations`, `stock_transfers` টেবিল ও posting logic (`post_stock_transfer`, `receive_stock_transfer` — `05` ফাইলে যোগ হয়েছে) ইতিমধ্যে সম্পূর্ণ রেডি, বাদ দেওয়ার কারণ নেই |
| ৪ | থার্মাল প্রিন্টার মডেল | **Xprinter XP-P323B** (58mm, Bluetooth, ESC/POS) — বাংলাদেশে সহজলভ্য (~৳২৫০০-৩৫০০), raster/bitmap printing সাপোর্ট করে (বাংলা ফন্টের জন্য বাধ্যতামূলক, কারণ ESC/POS টেক্সট মোড বাংলা প্রিন্ট করতে পারে না)। App-এ receipt ক্যানভাসে এঁকে বিটম্যাপ হিসেবে পাঠাতে হবে — `react-native-esc-pos-printer` লাইব্রেরি ব্যবহার করুন |
| ৫ | চেক ক্লিয়ারিং ট্র্যাক করতে হবে কিনা | **হ্যাঁ।** `payments.cheque_status` (pending → cleared/bounced) যোগ হয়েছে (`05` ফাইল, সেকশন ১৪)। Bounce হলে `mark_cheque_bounced()` কল করলেই payment স্বয়ংক্রিয়ভাবে reverse হয়ে যাবে (ক্রেতার বাকি আবার ফিরে আসবে) |

---

## ৩. `05_security_and_feature_fixes.sql`-এ কী কী ঠিক হলো — সারাংশ

**🔴 Critical (launch-blocking ছিল):**
- `extend_subscription` / `provision_company` / `refresh_company_statuses` / `generate_recurring_expenses` — আগে যেকোনো app user (কিছু ক্ষেত্রে অ্যানোনিমাসও) কল করতে পারতো। এখন শুধু `service_role` (Admin Panel সার্ভার সাইড)
- `post_purchase` / `post_sale` / `void_document` / `allocate_payment` — এখন caller-এর company যাচাই করে; অন্য কোম্পানির ডেটায় হাত দেওয়া যাবে না

**🟡 ফাংশনাল গ্যাপ (ফিচার আছে বলে মনে হলেও কাজ করত না):**
- Stock adjustment/count approve করলে এখন সত্যিই স্টক বদলায় (আগে বদলাত না)
- Purchase/Sale return posting ফাংশন যোগ হলো
- Stock transfer সম্পূর্ণ করার ফাংশন যোগ হলো
- Payment reversal ফাংশন যোগ হলো
- Dashboard-এর হাতে ক্যাশ/পাওনা/দেনা/স্টকমূল্য কার্ড এখন আসল সংখ্যা দেখাবে (আগে সবসময় ০)
- `max_users` / `max_devices` প্ল্যান-লিমিট এখন সত্যিই আটকায়
- Batch remaining quantity এখন স্বয়ংক্রিয়ভাবে আপডেট হয় (FEFO সাজেশনের জন্য দরকার)
- Month-close ফিচার (`closed_through`) যোগ হলো — বন্ধ মাসে এন্ট্রি আটকাবে
- Push notification token রাখার কলাম যোগ হলো
- চেক ক্লিয়ারিং স্ট্যাটাস ট্র্যাকিং যোগ হলো

**🟢 RBAC — permission matrix (PRD সেকশন ৫.২) DB-লেভেলে enforce:**
- দাম বদলানো এখন শুধু Owner পারবে (আগে Manager-ও পারত)
- Product/Category/Party/Purchase/Sale/Expense/Stock-adjustment/Payment — কে insert করতে পারবে তা এখন RLS policy-তে role অনুযায়ী আটকানো, শুধু app UI-নির্ভর না

---

## ৪. এখন থেকে development-এ যাওয়ার আগে চেকলিস্ট

- [ ] Supabase প্রজেক্টে ৫টা SQL ফাইল ক্রমানুসারে রান করুন
- [ ] pg_cron extension enable করে `04_seed.sql`-এর শেষের ৪টা cron job uncomment করুন (status refresh, recurring expense, daily summary, inbound invoice expiry)
- [ ] Service role key শুধু Next.js admin panel-এর সার্ভার সাইড env var-এ রাখুন, কখনো client bundle-এ না
- [ ] প্রথম test company `provision_company()` দিয়ে service_role থেকে বানিয়ে end-to-end flow (purchase → post → sale → post → payment → dashboard) verify করুন

---

*সংস্করণ ৩.০ — চূড়ান্ত। এখান থেকে Development ধাপ ১ শুরু করা যাবে।*
