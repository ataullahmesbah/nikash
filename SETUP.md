# Nikash — সম্পূর্ণ সেটআপ গাইড

তিনটা অংশ: **Database (Supabase)** → **Web (Next.js)** → **App (Expo)**। এই ক্রমেই সেটআপ করুন, কারণ web ও app দুটোই database-এর উপর নির্ভর করে।

---

## ধাপ ১ — Supabase Project

1. https://supabase.com → New Project বানান (region: Singapore, বাংলাদেশের সবচেয়ে কাছে)
2. Project তৈরি হলে **Project Settings → API** পেজে গিয়ে ৩টা জিনিস কপি করে রাখুন:
   - `Project URL`
   - `anon public` key
   - `service_role` key (⚠️ এটা গোপন, কখনো ব্রাউজার/অ্যাপে যাবে না)
3. **SQL Editor**-এ গিয়ে নিচের ফাইলগুলো **এই ক্রমে** এক এক করে চালান (আগে পাঠানো হয়েছে, `database/` ফোল্ডারে আছে):
   ```
   01_schema.sql
   02_functions_triggers.sql
   03_rls_policies.sql
   04_seed.sql
   05_security_and_feature_fixes.sql
   06_v2_edit_delete_audit.sql      ← v2 (এডিট/ডিলিট/অডিট/নোটিফিকেশন/ফিনান্স)
   ```
   > `06_...sql` একবারই চালালেই হয়, আর বারবার চালালেও কিছু নষ্ট হয় না
   > (সব `create ... if not exists` / `create or replace`)।
4. **Database → Extensions**-এ গিয়ে `pg_cron` enable করুন, তারপর `04_seed.sql`-এর একদম শেষের ৪টা `cron.schedule(...)` লাইনের কমেন্ট (`--`) তুলে আবার রান করুন
5. **Database → Replication**-এ গিয়ে নিচের টেবিলগুলোর জন্য **Realtime চালু** করুন —
   নইলে অ্যাডমিন প্যানেল থেকে নোটিশ বা স্ট্যাটাস বদলালে অ্যাপে সাথে সাথে পৌঁছাবে না:
   ```
   notices        companies       users        notifications
   ```
6. **অ্যাডমিন প্যানেলে ঢুকে প্রথমেই সেটিংস ভরুন** (`/admin/settings`):
   | ট্যাব | কী দেবেন | কোথায় দেখা যাবে |
   |---|---|---|
   | সাপোর্ট তথ্য | ফোন, হোয়াটসঅ্যাপ, ইমেইল, সময় | অ্যাপের "সাহায্য", ওয়েবের ফুটার ও যোগাযোগ পেজ |
   | পেমেন্ট নম্বর | বিকাশ/নগদ/রকেট/ব্যাংক | অ্যাপের সাবস্ক্রিপশন স্ক্রিন, ওয়েবের দাম পেজ |
   | অ্যাপ লিংক | APK লিংক, ম্যানুয়াল | ডাউনলোড পেজের বাটন ও **QR কোড** |
   | প্ল্যান ও দাম | প্যাকেজ তৈরি করুন | সাইনআপ, দাম পেজ, ম্যানুয়াল পেমেন্ট |

---

## ধাপ ২ — Web Admin Panel (`nikash-web/`)

```bash
cd nikash-web
npm install
cp .env.example .env.local
```

`.env.local`-এ যা লাগবে:

| Variable | মান | ব্রাউজারে যায়? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ধাপ ১-এর Project URL | হ্যাঁ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ধাপ ১-এর anon key | হ্যাঁ |
| `SUPABASE_SERVICE_ROLE_KEY` | ধাপ ১-এর service_role key | **না** |
| `ADMIN_JWT_SECRET` | `openssl rand -base64 32` দিয়ে বানান | না |

প্রথম Super Admin বানান:
```bash
node scripts/hash-password.mjs "আপনার-শক্তিশালী-পাসওয়ার্ড"
```
তারপর Supabase SQL Editor-এ:
```sql
insert into platform_admins (name, email, password_hash, role)
values ('আপনার নাম', 'you@example.com', '<hash এখানে বসান>', 'super_admin');
```

চালু করুন:
```bash
npm run dev        # http://localhost:3000
```

**Deploy:** Vercel-এ পুশ করে উপরের ৪টা env var Project Settings → Environment Variables-এ বসিয়ে দিন।

---

## ধাপ ৩ — Mobile App (`nikash-app/`)

```bash
cd nikash-app
npm install
cp .env.example .env
```

`.env`-এ যা লাগবে:

| Variable | মান |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | ধাপ ১-এর Project URL (web-এর সাথে একই) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ধাপ ১-এর anon key |
| `EXPO_PUBLIC_API_URL` | ধাপ ২-এ যেখানে `nikash-web` deploy করেছেন সেই URL (স্থানীয়ভাবে টেস্ট করলে `http://localhost:3000`, তবে ফোন থেকে `localhost` অ্যাক্সেস করা যাবে না — বাস্তব ডিভাইসে টেস্ট করতে হলে আগে Vercel-এ deploy করুন) |
| `EXPO_PUBLIC_DEMO_PHONE` / `EXPO_PUBLIC_DEMO_PASSWORD` | **ঐচ্ছিক** — লগইন স্ক্রিনে "ডেমো দেখুন" বাটন দেখাতে চাইলে একটা ডেমো কোম্পানি বানিয়ে তার ফোন+পাসওয়ার্ড এখানে বসান। দুটো খালি রাখলে বাটনটাই দেখা যাবে না। |

চালু করুন:
```bash
npx expo start
```
ফোনে **Expo Go** অ্যাপ ইনস্টল করে QR কোড স্ক্যান করুন। লগইন স্ক্রিন থেকে "নতুন অ্যাকাউন্ট" চেপে সরাসরি সাইনআপ করা যাবে — ম্যানুয়াল টেস্ট ইউজার বানানোর ধাপ (fallback হিসেবে) `nikash-app/README.md`-এ আছে।

---

## পুরো env var-এর তালিকা (এক নজরে)

| # | Variable | কোথায় | Secret? |
|---|---|---|---|
| ১ | `NEXT_PUBLIC_SUPABASE_URL` | Web | না |
| ২ | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web | না |
| ৩ | `SUPABASE_SERVICE_ROLE_KEY` | Web (server only) | **হ্যাঁ** |
| ৪ | `ADMIN_JWT_SECRET` | Web (server only) | **হ্যাঁ** |
| ৫ | `EXPO_PUBLIC_SUPABASE_URL` | App | না |
| ৬ | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | App | না |
| ৭ | `EXPO_PUBLIC_API_URL` | App | না |

মোট **৭টা env var**, তার মধ্যে ২টা secret (কখনো Git-এ কমিট করবেন না — দুই প্রজেক্টেই `.gitignore`-এ `.env*` আগে থেকেই আছে)।

---

## এই ডেলিভারিতে কী আছে, কী নেই (সততার সাথে)

**আছে ও কাজ করে (verified — build/bundle পাস করেছে):**
- Web + App: **`/signup` — স্ব-নিবন্ধন**। এটাই এখন বাস্তব "নতুন গ্রাহক নেওয়ার" পথ — ব্যবসার ধরন বেছে, ফোন+পাসওয়ার্ড দিয়ে সরাসরি ১৫ দিনের ট্রায়াল কোম্পানি তৈরি হয় ও লগইন হয়ে যায়। এর আগে এটা শুধু ডেভেলপার SQL দিয়ে করতে পারত।
- Web: landing, download page, super admin login+session, companies list/detail, subscription extend, block/readonly/lifetime-free, payment approve/reject, admin audit log
- App: phone login, session persistence, dashboard KPI (আসল daily_summaries থেকে) + quick actions
- App: পার্টি (তালিকা + যোগ), প্রোডাক্ট (তালিকা + যোগ — একক ইউনিট লেভেল)
- App: **পূর্ণ Purchase/Sale entry flow** — cart, ছাড়, নগদ ক্রেতা/ক্রেতা বাছাই, draft/post, বিস্তারিত পেজ থেকে Post/Void
- App: **Payment entry** — আদায়/পরিশোধ, `allocate_payment` দিয়ে FIFO allocation, চেক ক্লিয়ারিং স্ট্যাটাসসহ
- App: **বাকি (Due) স্ক্রিন** — পাওনা/দেনা, aging bucket
- App: **Expense entry** — autocomplete, ক্যাটাগরি, approval-limit ভিত্তিক pending/approved, **offline-first** (নিচে দেখুন)
- App: **Inventory** — বর্তমান স্টক (মূল্য+কম-স্টক সতর্কতা), stock adjustment, stock transfer (পাঠানো+গ্রহণ), **stock count** (গণনা→পর্যালোচনা→অনুমোদন→স্বয়ংক্রিয় সমন্বয়)
- App: **Offline sync foundation** — local SQLite outbox, auto-sync (app open/reconnect/৫ মিনিট পরপর), sync badge, pending-sync logout confirmation
- App: **Analytics — PRD-র ১০টা গ্রাফই এখন আছে** — বিক্রয়ের ধারা, মাসিক তুলনা, লক্ষ্য পূরণ (Progress Ring — কোম্পানি, সেলসম্যান ও রুট — PRD-র বলা তিন স্তরেই এখন নির্ধারণ করা যায়; owner সেট করেন, সেলসম্যান নিজের অ্যাকাউন্টে নিজের লক্ষ্য দেখেন), লাভের ধারা (গ্রস vs নিট), সেরা ৫ পণ্য, সেরা ৫ ক্রেতা (বাকিসহ), বাকির aging, খরচের বিভাজন, সাপ্তাহিক নগদ প্রবাহ, স্টকমূল্যের ধারা — সব আসল ডেটা থেকে, validated colorblind-safe palette
- App: **গাড়ি ও ট্রিপ** — trip cost স্বয়ংক্রিয়ভাবে expenses-এ লিংক হয়ে P&L-এ যোগ হয়
- App: **রুট ব্যবস্থাপনা** (Warehouse-এর জন্য, "আরও" মেনুতে) — রুট বানানো, পার্টি ও ট্রিপে রুট ট্যাগ করা যায় (ট্রিপ-ফর্মে আগে থেকেই রুট পিকার ছিল, কিন্তু রুট বানানোর কোনো স্ক্রিন ছিল না — এখন যোগ হয়েছে)
- App: **৩-স্লাইড onboarding পরিচিতি** (প্রথমবার অ্যাপ খুললে দেখাবে, "এড়িয়ে যান" আছে) ও **ডেমো মোড** (লগইন স্ক্রিনে "ডেমো দেখুন" বাটন — ঐচ্ছিক, env var সেট করলে তবেই দেখা যাবে)
- App: **Multi-level unit UI** (কার্টন/বস্তা)
- App: **Toast system** (success/error/warning/info/offline, PRD 20.3 অনুযায়ী রঙ ও সময়) — পুরো অ্যাপে native Alert popup-এর বদলে ব্যবহৃত
- App: **POS mode** (Shop-only) — শিফট open/close, দ্রুত প্রোডাক্ট গ্রিড, cash-in-hand reconciliation
- App: **Batch/expiry tracking** — ক্রয়ে ব্যাচ ক্যাপচার, মেয়াদ রেজিস্টার স্ক্রিন, **এবং এখন বিক্রয়ে স্বয়ংক্রিয় FEFO deduction** (যে ব্যাচের মেয়াদ আগে শেষ হবে সেটা থেকেই স্টক কাটবে, প্রয়োজনে একটা লাইন একাধিক ব্যাচ থেকে ভাগ হয়ে কাটবে)
- App: **Local-read cache** (product catalog + locations, এবং Sales/Purchases/Expenses/Products/Parties তালিকা) — Stock Adjustment পুরোপুরি offline কাজ করে (entry+picker), আর তালিকা স্ক্রিনগুলো অফলাইনে শেষবার লোড হওয়া ডেটা দেখায় ("অফলাইন" ব্যানারসহ)
- App: **PDF ইনভয়েস শেয়ার** (Sale/Purchase থেকে) ও **পার্টি লেজার স্টেটমেন্ট PDF** (WhatsApp/Drive ইত্যাদিতে)
- App: **পার্টির GPS লোকেশন** — নতুন পার্টি ফর্মে "📍 বর্তমান অবস্থান নিন" বাটন (`expo-location`), বিস্তারিত পেজ থেকে "🗺️ ম্যাপে দেখুন" ফোনের Maps অ্যাপে খোলে (`geo:` লিংক)
- App: **দৈনিক লোকাল ব্যাকআপ** — অ্যাপ খুললে দিনে একবার স্বয়ংক্রিয়ভাবে JSON ব্যাকআপ ফাইল তৈরি হয় (শেষ ৯০ দিনের পার্টি/প্রোডাক্ট/বিক্রয়/ক্রয়/খরচ/পেমেন্ট), এবং "আরও" মেনু থেকে যেকোনো সময় ম্যানুয়ালি শেয়ার করা যায়
- Web: **নোটিশ সিস্টেম** (`/admin/notices`), **অ্যাপ ভার্সন পাবলিশিং** (`/admin/app-versions`), **অডিট রিপোর্ট** (`/admin/audit`), **MRR/ARR রাজস্ব বিশ্লেষণ** (`/admin/analytics` — MRR, ARR, প্ল্যান-ভিত্তিক বিভাজন, ১২ মাসের আদায় গ্রাফ), **2FA (TOTP)** (`/admin/settings` — QR enrollment, লগইনে অপশনাল দ্বিতীয় ধাপ)
- Database: view cross-tenant leak ফিক্স (`security_invoker`), `next_doc_no()` tenant-check ফিক্স, `targets` টেবিলে owner-only write policy

**Offline sync-এর অবস্থা:** Expense, Party, Product (নতুন), Stock adjustment — এই ৪টা এখন সত্যিকারের offline-first। Purchase/Sale/Payment/Stock transfer/count এখনো সরাসরি Supabase কল করে কারণ এগুলো server-side RPC-নির্ভর (invoice numbering, weighted-avg cost, FIFO allocation) যা client-এ নিরাপদে replicate করা যায় না — এটা bug না, architectural সিদ্ধান্ত। বিস্তারিত `nikash-app/README.md`-তে।

**Multi-level unit UI এখন আছে** — প্রোডাক্ট বিস্তারিত পেজ থেকে দ্বিতীয়/তৃতীয় ইউনিট স্তর (কার্টন/বস্তা) যোগ করা যায়, প্রতিটার আলাদা দাম।

**এখনো নেই (PRD-র বাকি অংশ, পরের ধাপে যোগ হবে):**
- বাংলা/ইংরেজি টগল, Dark mode, thermal print (PDF শেয়ার আছে, বিটম্যাপ প্রিন্ট নেই) নেই

এটা এখন PRD-র **ধাপ ১, ২ সম্পূর্ণ + স্ব-নিবন্ধন (signup) + ধাপ ৩-এর analytics সম্পূর্ণ (১০/১০ গ্রাফ) + ধাপ ৪-এর offline sync-এর ভিত্তি + ধাপ ৫-এর notices/app-version অংশ**। পরের যুক্তিসঙ্গত ধাপ: **বাকি ফর্মে offline queue ছড়ানো + local-read cache → POS mode হার্ডওয়্যার প্রিন্ট → ভাষা/থিম**।

---

# 🆕 v2-তে নতুন কী (এই সংস্করণ)

বিস্তারিত দুটি আলাদা PRD-তে: `docs/PRD_APP_v2.md` ও `docs/PRD_WEB_v2.md`।

### ডাটাবেস
- নতুন মাইগ্রেশন **`06_v2_edit_delete_audit.sql`** — চালানোর পর:
  - `entity_audit_log` — কে কখন কী বদলাল
  - সফট-ডিলিট কলাম (`deleted_at`) ও এডিট-কাউন্ট
  - `unpost_sale` / `unpost_purchase` / `delete_draft_document` / `delete_party` / `delete_product`
  - `party_due_summary()` — পার্টিভিত্তিক বাকি
  - নোটিশ টার্গেটিং (`target_company_ids`, `target_statuses`)
  - `set_subscription_end()` — মেয়াদ **কমানোও** যায়
  - `platform_settings` — সাপোর্ট/পেমেন্ট নম্বর/অ্যাপ লিংক/বিলিং নিয়ম
  - `notifications` + ৫টি ট্রিগার + `unread_notification_count()`
  - `contact_submissions`, `company_notes`, `admin_roles`
  - `record_manual_payment()`, `finance_summary()`, ইনভয়েস নম্বর জেনারেটর
  - `payment_method` enum-এ `rocket` ও `card` যোগ

### অ্যাপ
এডিট/ডিলিট · তারিখ ও ক্যালেন্ডার সব জায়গায় · বাকির হিসাব মেনু · সাবস্ক্রিপশন ও পেমেন্ট
রেকর্ড · হেল্পলাইন · নোটিফিকেশন ও নোটিশ ব্যানার · খোঁজা · স্কেলিটন লোডার ·
PDF ঠিক করা (বাংলা ফন্ট) · রিয়েল-টাইম · দ্রুত সিঙ্ক

### ওয়েব
নতুন ড্যাশবোর্ড (গ্রাফসহ) · নোটিফিকেশন ঘণ্টা ও পেজ · ব্যবহারকারী ও রোল ·
নোটিশ টার্গেটিং · কোম্পানি তালিকা ও ডিটেইল নতুন করে · ম্যানুয়াল পেমেন্ট ও ইনভয়েস ·
**ফিনান্স পেজ** · ৬-ট্যাব সেটিংস · যোগাযোগ বার্তা ·
পাবলিক সাইট: হোম, সেবা, দাম, ডাউনলোড (**QR**), আমাদের কথা, যোগাযোগ, আইনি পেজ

### যাচাই
```bash
cd nikash-web && npm run build      # ✅ পাস
cd nikash-app && npx tsc --noEmit   # ✅ ০ এরর
cd nikash-app && npx expo export --platform android   # ✅ বান্ডল হয়
```

---

# 🔧 v2.1 — বাগ ফিক্স ও নতুন ফিচার

## নতুন SQL (ক্রমে চালাতে হবে)

আগে `06_v2_edit_delete_audit.sql` চালানো থাকলে এখন শুধু দুটো নতুন:

```
07_v2_edit_delete_more.sql    ← খরচ/গাড়ি/রুটে ডিলিট + পার্টি বন্ধ/চালু
08_bank_payments.sql          ← ব্যাংক লেনদেনের তথ্য
```

## যেসব বাগ সারানো হয়েছে

| বাগ | আসল কারণ |
|---|---|
| আংশিক পেমেন্টে **বাকি ০** দেখাত | হেডারে paid/due লেখা হতো, তারপর allocate_payment আবার একই টাকা বসাত — দুইবার গোনা হতো |
| ড্রাফট/পোস্টেড এডিটে **ফাঁকা ফর্ম** | ক্রয় লোডের query-তে কলামের নাম ভুল ছিল (`unit_cost` → `unit_price`), এরর চুপচাপ গিলে ফেলত |
| **"সংরক্ষণ ব্যর্থ" দেখাত কিন্তু সেভ হতো** | পেমেন্ট ও allocation-এর এরর চেক করা হতো না |
| পার্টিতে **এডিট/ডিলিট "নেই"** | বাটন ছিলই, কিন্তু তথ্য ট্যাব স্ক্রল করত না — নিচে চাপা পড়ে যেত |
| **"নিশ্চিত করুন" কাজ করত না** | কিবোর্ড খুলে বাটনটাই ঢেকে ফেলত |
| **নোটিশ অ্যাপে আসত না** | নোটিশ লোড হতো শুধু একবার, লগইনের পর |
| অ্যাপ **ক্র্যাশ** করত লগইনের পর | একই নামের realtime চ্যানেল দুইবার বানানোয় |
| **রকেটে পেমেন্ট** জমা দেওয়া যেত না | `payment_method` enum-এ 'rocket' ছিল না |

## প্যাকের হিসাব (কেস / কার্টন / বস্তা)

স্টক সবসময় **ছোট এককে** জমা থাকে, দেখানোর সময় **প্যাক + ভাগশেষ**:

```
১ কেস = ২৪ বোতল
৫০০ কেস কেনা      → স্টকে ১২,০০০ বোতল
৫১ কেস ৬ বোতল বিক্রি → কমল ১,২৩০ বোতল
বাকি ১০,৭৭০ বোতল   → দেখাবে "৪৪৮ কেস ১৮ বোতল"
```

দশমিক (৪৪৮.৭৫ কেস) কখনো দেখায় না। `lib/format.ts` → `formatPackQty()`।
