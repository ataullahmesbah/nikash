# Nikash App — Mobile (Expo / React Native)

Expo SDK 57, TypeScript, expo-router, Supabase.

## এখানে যা তৈরি আছে

- ফোন নম্বর + পাসওয়ার্ড লগইন (synthetic email, README-DB-Setup অনুযায়ী)
- **সাইনআপ (স্ব-নিবন্ধন):** ব্যবসার ধরন বাছাই + নাম/ফোন/পাসওয়ার্ড দিয়ে সরাসরি ১৫ দিনের ট্রায়াল কোম্পানি তৈরি — `nikash-web`-এর `/api/signup` কল করে (নিচে "Environment variables" দেখুন, `EXPO_PUBLIC_API_URL` লাগবে)
- ড্যাশবোর্ড — আজকের `daily_summaries` KPI + quick-action বাটন
- **পার্টি:** তালিকা + নতুন যোগ করা + **বিস্তারিত পেজে পূর্ণ লেজার** (চালান+পেমেন্ট মিলিয়ে চলমান ব্যালেন্স) ও PDF স্টেটমেন্ট শেয়ার + **GPS লোকেশন** (`expo-location` দিয়ে "বর্তমান অবস্থান নিন", বিস্তারিত পেজ থেকে `geo:` লিংকে "ম্যাপে দেখুন" — PRD ৪-এর "বর্তমান অবস্থান নিন" বাটনের বাস্তবায়ন, `parties.latitude/longitude` কলাম আগে থেকেই ছিল কিন্তু কোনো UI ছিল না। **এই ডেভেলপমেন্ট এনভায়রনমেন্টে GPS/ডিভাইস নেই, তাই permission-prompt ও প্রকৃত coordinate capture হাতে-কলমে টেস্ট করা যায়নি** — কোড `.d.ts` অনুযায়ী সঠিক API ব্যবহার করে ও bundle সফল হয়েছে, কিন্তু প্রথম রানেই একবার আসল ডিভাইসে চেক করে নিও।)
- **প্রোডাক্ট:** তালিকা + নতুন যোগ করা + **বিস্তারিত পেজে একাধিক ইউনিট স্তর যোগ করা** (যেমন বোতল থেকে কার্টন — প্রতিটার আলাদা দাম, `factor_to_base` স্বয়ংক্রিয়ভাবে সার্ভার-ট্রিগার হিসেব করে)
- **বিক্রয়:** তালিকা (status badge সহ) + নতুন বিক্রয় এন্ট্রি (কার্ট, ছাড়, নগদ ক্রেতা/ক্রেতা বাছাই, draft বা draft+post) + বিস্তারিত পেজ থেকে Post/Void
- **ক্রয়:** ঠিক একই রকম, সরবরাহকারীর জন্য
- **পেমেন্ট:** নতুন এন্ট্রি (আদায়/পরিশোধ, নগদ/bKash/Nagad/ব্যাংক/চেক), `allocate_payment` RPC দিয়ে FIFO ভিত্তিতে ইনভয়েসে বসে
- **বাকি:** পাওনা ও দেনা তালিকা, aging bucket রঙ সহ (`v_receivables`/`v_payables` — এখন RLS-নিরাপদ, `05_security_and_feature_fixes.sql` দেখুন)
- Draft → Post → (প্রয়োজনে) Void — পুরো flow কাজ করে, `post_sale`/`post_purchase`/`void_document` RPC কল করে
- **খরচ (Expense):** নাম-টাকা এন্ট্রি, autocomplete suggestion, ক্যাটাগরি চিপ, approval-limit অনুযায়ী স্বয়ংক্রিয় pending/approved
- **ইনভেন্টরি:** বর্তমান স্টক তালিকা (মূল্যসহ, কম-স্টক সতর্কতা), স্টক সমন্বয় (damage/expiry/theft/count_error/other, ক্ষতির টাকা অটো-খরচে যোগ), গুদাম-থেকে-গুদাম স্থানান্তর (পাঠানো + গ্রহণ করা)
- **স্টক গণনা (Physical count):** গণনা শুরু (সিস্টেম-qty snapshot নেয়) → প্রতিটা প্রোডাক্টে আসল পরিমাণ এন্ট্রি (গরমিল লাল রঙে হাইলাইট) → পর্যালোচনার জন্য পাঠানো → Owner/Manager অনুমোদন → স্বয়ংক্রিয়ভাবে প্রতিটা গরমিলের জন্য `stock_adjustments` তৈরি (যেটা আবার নিজে থেকেই `stock_movements`-এ পোস্ট হয়ে যায়)
- **Offline sync foundation** (`lib/offline/`) — local SQLite outbox (`sync_queue`), auto-sync অ্যাপ খোলা/ইন্টারনেট ফেরা/প্রতি ৫ মিনিটে, সব স্ক্রিনে persistent sync badge, pending থাকলে logout confirmation
- **গাড়ি ও ট্রিপ:** গাড়ি যোগ, ট্রিপ এন্ট্রি (জ্বালানি/টোল/ড্রাইভার ভাতা/অন্যান্য) — প্রতিটা খরচ স্বয়ংক্রিয়ভাবে vehicle_id/trip_id লিংক সহ `expenses`-এও যোগ হয় (তাই P&L-এ যোগ হয়), `vehicle_trips.total_cost` রুট-প্রফিটেবিলিটি রিপোর্টের জন্য আলাদা থাকে
- **PDF ইনভয়েস:** Sale/Purchase বিস্তারিত পেজ থেকে "PDF শেয়ার করুন" — `expo-print` দিয়ে PDF বানিয়ে `expo-sharing` দিয়ে WhatsApp/Drive-এ শেয়ার করা যায় (PRD 13.2)
- **Batch ও মেয়াদ:** প্রোডাক্ট তৈরির সময় "মেয়াদ ট্র্যাক করুন" চালু করা যায় — চালু থাকলে ক্রয় এন্ট্রিতে ব্যাচ নম্বর ও মেয়াদ চাইবে, `batches` রো তৈরি হবে ও পরে trigger দিয়ে remaining qty স্বয়ংক্রিয় হালনাগাদ হবে; ইনভেন্টরি থেকে "মেয়াদ রেজিস্টার" — মেয়াদ অনুযায়ী সাজানো, কতদিন বাকি রঙ দিয়ে দেখানো
- **POS mode (Shop-only):** শিফট শুরু (opening cash) → বড় বাটনের প্রোডাক্ট গ্রিড, ট্যাপেই কার্টে যোগ, qty stepper → নগদ কত দিয়েছে লিখলেই ফেরত স্বয়ংক্রিয় হিসাব → এক ট্যাপে বিক্রয় post হয়ে যায় (walk-in, cash, due=0) → শিফট শেষে প্রকৃত ড্রয়ারের টাকা মিলিয়ে `pos_shifts.difference` রেকর্ড হয়
- **Toast system** (PRD 20.3) — success/error/warning/info/offline, রঙ ও duration PRD অনুযায়ী, max ৩টা একসাথে, reversible action-এ Undo বাটন — পুরো অ্যাপ জুড়ে সব এন্ট্রি ফর্মে ব্যবহৃত (আগে যেগুলো native Alert popup ছিল)
- **Analytics (গ্রাফ) — PRD 9.2-র ১০টা গ্রাফই আছে:** বিক্রয়ের ধারা (লাইন চার্ট), মাসিক তুলনা (গ্রুপড বার), **মাসের লক্ষ্য পূরণ progress ring** (owner কোম্পানি-স্তর ও প্রতি সেলসম্যানের জন্য আলাদা মাসিক টার্গেট বসাতে পারেন, দিন-ভিত্তিক পেসের তুলনায় এগিয়ে/পিছিয়ে সবুজ/লাল দেখায়; সেলসম্যান নিজের অ্যাকাউন্টে শুধু নিজের লক্ষ্য দেখেন), **লাভের ধারা** (৬ মাস, গ্রস vs নিট area chart), **সেরা ৫ পণ্য** ও **সেরা ৫ ক্রেতা** (বাকিসহ, horizontal bar), বাকির aging ডোনাট, খরচের ক্যাটাগরি-ভিত্তিক ডোনাট, **সাপ্তাহিক নগদ প্রবাহ** (grouped bar), **স্টকের মূল্যের ধারা** (লাইন চার্ট) — সব `react-native-gifted-charts` দিয়ে, colorblind-safe validated palette সহ

## Offline sync — কতটুকু হয়েছে, কতটুকু বাকি (গুরুত্বপূর্ণ, পড়ুন)

`lib/offline/db.ts` + `lib/offline/sync-queue.ts` একটা কাজ-করা **local-first outbox** — যেকোনো ফর্ম `enqueueWrite(table, "insert", payload)` কল করলেই সেটা তাৎক্ষণিক local SQLite-এ সেভ হয় (network লাগে না), তারপর ব্যাকগ্রাউন্ডে Supabase-এ push হয়। এখন পর্যন্ত এই প্যাটার্নে চলে:

- ✅ **Expense entry** — পুরোপুরি offline-first
- ✅ **Party যোগ করা**
- ✅ **Product যোগ করা** (নতুন প্রোডাক্ট — category→product→variant→unit ৪টা সারিই সঠিক ক্রমে queue হয়ে সিঙ্ক হয়)
- ✅ **Stock adjustment** — single-table insert, কোনো RPC নির্ভরতা নেই, তাই নিরাপদে queue করা গেছে; এর প্রোডাক্ট ও গুদাম picker-ও এখন offline কাজ করে (`lib/catalog.ts`/`lib/locations.ts`-এ read-through cache — অনলাইনে থাকলে সবসময় তাজা ডেটা, অফলাইনে শেষ সফল fetch থেকে দেখায়)

**যা এখনো সরাসরি Supabase কল করে (ইন্টারনেট ছাড়া কাজ করবে না) — এবং কেন:**
- Purchase/Sale draft তৈরি + Post করা — invoice number `next_doc_no()` RPC থেকে আসে (duplicate এড়াতে সার্ভার-সাইড counter), আর Post আরেকটা RPC (`post_sale`/`post_purchase`, weighted-average cost গণনা করে) — দুটোই client-এ নিরাপদে replicate করা যায় না
- Payment entry — `allocate_payment` RPC-নির্ভর (FIFO allocation সার্ভারে হয়)
- Stock transfer/count, multi-level unit যোগ করা — এগুলো বা তো RPC-নির্ভর, বা dependency-chain এত জটিল যে অফলাইনে queue করলে ভুল হওয়ার ঝুঁকি বেশি

**তালিকা পেজগুলো** (Sales/Purchases/Expenses ইত্যাদি) এখনো সরাসরি Supabase থেকে পড়ে, local cache থেকে না। ব্যতিক্রম: **product catalog ও locations** (Stock Adjustment-এর picker) — এই দুটোর read-through cache আছে যেহেতু সেই ফর্মটাই offline-first। সম্পূর্ণ offline reading (সব তালিকায় local cache) পরের ধাপ।

**যাচাই করা হয়েছে:** `expo-sqlite@57` এর `openDatabaseSync`/`execSync`/`runAsync`/`getAllAsync` API সিগনেচার সরাসরি package-এর `.d.ts` ফাইলের সাথে মিলিয়ে দেখা হয়েছে, আর পুরো bundle (1332 modules) সফলভাবে তৈরি হয়েছে। তবে **আসল ডিভাইসে/এমুলেটরে রান করে টেস্ট করা হয়নি** (এই ডেভেলপমেন্ট এনভায়রনমেন্টে ফোন/এমুলেটর নেই) — প্রথম রানেই SQLite table তৈরি ও sync ঠিকমতো হচ্ছে কিনা একবার হাতে-কলমে চেক করে নিও।

## সীমাবদ্ধতা (Phase 1/2 — এখনো বাকি)

- **৩-স্লাইড onboarding পরিচিতি আছে** (`app/onboarding.tsx`) — প্রথমবার অ্যাপ খুললে দেখাবে (`lib/onboarding.ts`-এ AsyncStorage ফ্ল্যাগ দিয়ে ট্র্যাক করা, দ্বিতীয়বার থেকে সরাসরি লগইন), "এড়িয়ে যান" আছে
- **Demo mode আছে** — লগইন স্ক্রিনে "👀 ডেমো দেখুন" বাটন, কিন্তু ঐচ্ছিক ও env var-নির্ভর: `EXPO_PUBLIC_DEMO_PHONE`/`EXPO_PUBLIC_DEMO_PASSWORD` সেট না থাকলে বাটনটাই দেখা যায় না। **এটা sandbox করা কোনো fake ডেটা না** — মালিককে নিজে একটা real ডেমো কোম্পানি বানিয়ে (সাধারণ `/signup` দিয়ে) তার লগইন এখানে বসাতে হবে; দায়িত্ব মালিকের, কোনো ভুয়া ডেটা এই কোডে হার্ডকোড করা হয়নি
- POS-এর cash drawer "expected cash" হিসাব একটা approximation (shift শুরুর পর থেকে cash collection/expense যোগ-বিয়োগ করে) — পুরোপুরি ledger-নির্ভুল না, বড় হলে ঠিক করা লাগতে পারে
- **Sales/Purchases/Expenses/Products/Parties তালিকা এখন local-read cache থেকে পড়ে** (`lib/list-cache.ts` — নেটওয়ার্ক আগে চেষ্টা করে, ব্যর্থ হলে শেষ সফল ফলাফল AsyncStorage থেকে দেখায়, "অফলাইন" ব্যানারসহ)
- মাসিক তুলনায় শুধু **এই মাস বনাম গত মাস** — "গত বছরের একই মাস" বাদ দেওয়া হয়েছে যেহেতু নতুন কোম্পানির ১ বছরের ডেটা থাকবে না
- লক্ষ্য (targets) এখন PRD-র **তিন স্তরেই** আছে — কোম্পানি, সেলসম্যান, রুট (Warehouse-only)
- **নতুন: রুট ব্যবস্থাপনা** (`app/routes/index.tsx`, `app/routes/new.tsx`) — এতদিন `app/trips/new.tsx`-এ রুট পিকার ছিল এবং schema-তে `parties.route_id`/`routes` টেবিল ছিল, কিন্তু রুট *বানানোর* কোনো স্ক্রিনই ছিল না, তাই `routes` টেবিল কখনো পূরণ হতো না। এখন "আরও → রুট ব্যবস্থাপনা" (শুধু Warehouse business_type-এ দেখা যায়, PRD 5.1-এর টেবিল অনুযায়ী) থেকে রুট বানানো যায়, এবং পার্টি ফর্মেও এখন ঐচ্ছিক রুট-পিকার আছে। রুট-ভিত্তিক লক্ষ্যের achievement হিসাব হয় sales→customer_id→parties.route_id জয়েন করে (sales টেবিলে সরাসরি route_id নেই, রুট পার্টির একটা property)
- **ফিক্স:** `sales.salesman_id` আগে কখনো সেট হতো না (কলাম ছিল কিন্তু insert-এ বাদ পড়েছিল) — এখন প্রতিটা বিক্রয় যে ইউজার এন্ট্রি করেছে তার সাথে যুক্ত হয়, সেলসম্যান-লক্ষ্য হিসাবের জন্য এটা দরকার ছিল
- **ফিক্স:** `setMonthlyGoal`-এর আগের সংস্করণ `.upsert(..., {onConflict})` ব্যবহার করত company-scope (scope_id = null) টার্গেটের জন্য, কিন্তু Postgres-এ NULL কখনো NULL-এর সমান গণ্য হয় না — ফলে বারবার লক্ষ্য আপডেট করলে প্রতিবার নতুন duplicate রো তৈরি হতো এবং দ্বিতীয়বার থেকে Goal Progress কার্ডটাই ভেঙে যেত (`.maybeSingle()` একাধিক রো পেলে error দেয়)। এখন explicit select-then-update/insert দিয়ে ফিক্স করা হয়েছে
- বাংলা/ইংরেজি টগল, Dark mode নেই; PDF হয়ে গেছে কিন্তু **thermal printer সাপোর্ট (58mm bitmap)** এখনো নেই — শুধু PDF শেয়ার, সরাসরি প্রিন্টার-এ পাঠানো যায় না
- **বিক্রয়ে FEFO ব্যাচ deduction এখন আছে** (`lib/batches.ts` — `loadFefoBatches` + `allocateFefo`, `app/sales/new.tsx`-এ ব্যবহৃত): `track_expiry` চালু থাকা ভ্যারিয়েন্টের জন্য সেভ করার সময় স্বয়ংক্রিয়ভাবে সবচেয়ে আগে মেয়াদ শেষ হওয়া ব্যাচ থেকে কাটে; একটা কার্ট-লাইনের পরিমাণ এক ব্যাচে না মিটলে একাধিক ব্যাচে ভাগ হয়ে একাধিক `sale_items` রো তৈরি হয়। কোনো ট্র্যাক করা ব্যাচে পর্যাপ্ত স্টক না থাকলে বাকি অংশ `batch_id = null` দিয়ে সেভ হয় (এই ফিচার আসার আগের আচরণের মতোই — বিক্রয় আটকায় না)। **সীমাবদ্ধতা:** কোন ব্যাচ থেকে কাটবে তা সেভ করার আগে UI-তে প্রিভিউ দেখায় না, সেভ করার সময়ই সিদ্ধান্ত হয়
- **দৈনিক লোকাল ব্যাকআপ (PRD 18 rule #6) আছে** (`lib/backup.ts`) — অ্যাপ খুললে দিনে একবার (AsyncStorage-এ শেষ তারিখ ট্র্যাক করে) Supabase থেকে শেষ ৯০ দিনের পার্টি/প্রোডাক্ট/বিক্রয়/ক্রয়/খরচ/পেমেন্ট টেনে একটা JSON ফাইল ডিভাইসে (`Paths.document/backups/`) লেখে `expo-file-system`-এর নতুন `File`/`Directory` ক্লাস API দিয়ে, আর "আরও" ট্যাব থেকে `expo-sharing` দিয়ে যেকোনো সময় শেয়ার করা যায়। **স্কোপ নোট:** এই অ্যাপের লোকাল SQLite (`lib/offline`) শুধু write-outbox — সার্ভার ডেটার পূর্ণ mirror না — তাই এই ব্যাকআপ প্রতিবার Supabase থেকে টাটকা টেনে বানানো একটা snapshot export, সার্ভারের নিজস্ব রাতের `pg_dump`-এর বিকল্প না।

## চালানো

```bash
npm install
cp .env.example .env
npx expo start
```

মোবাইলে **Expo Go** অ্যাপ দিয়ে QR কোড স্ক্যান করুন, অথবা `npx expo run:android` দিয়ে native build।

## Environment variables (`.env`)

| Variable | কোথা থেকে পাবেন |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API (web app-এর সাথে একই প্রজেক্ট) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `EXPO_PUBLIC_API_URL` | `nikash-web` যেখানে deploy করেছেন সেই URL (যেমন `https://nikash.vercel.app`) — শুধু সাইনআপের জন্য লাগে |

**কখনো `SUPABASE_SERVICE_ROLE_KEY` এখানে দেবেন না** — এই কোড APK-এর ভেতরে যায়, এটা public।

## টেস্ট করার জন্য প্রথম কোম্পানি + ইউজার বানানো

**সহজ পথ:** অ্যাপ খুলে লগইন স্ক্রিন থেকে "নতুন অ্যাকাউন্ট — ১৫ দিন ফ্রি ট্রায়াল"-এ ট্যাপ করুন, ফর্ম পূরণ করুন — এটাই এখন আসল সাইনআপ, সরাসরি ট্রায়াল কোম্পানি তৈরি করে ও লগইন করিয়ে দেয়। (`nikash-web` চালু ও `EXPO_PUBLIC_API_URL` সেট থাকতে হবে।)

**ম্যানুয়াল পথ (fallback, ডেভেলপার-শুধু):**
1. Supabase Dashboard → Authentication → Add user (email: `01700000000@nikash.app`, password ঠিক করুন)
2. SQL Editor-এ:
   ```sql
   select provision_company(
     'টেস্ট দোকান', 'shop', 'টেস্ট মালিক', '01700000000',
     '<উপরে তৈরি হওয়া auth user-এর id>'
   );
   ```
3. অ্যাপে `01700000000` + পাসওয়ার্ড দিয়ে লগইন করুন

তারপর: প্রথমে পার্টি ট্যাব থেকে ২-১টা সরবরাহকারী/ক্রেতা, প্রোডাক্ট ট্যাব থেকে ২-১টা প্রোডাক্ট যোগ করুন, তারপর ক্রয় → বিক্রয় → পেমেন্ট এন্ট্রি দিয়ে পুরো flow টেস্ট করুন।
