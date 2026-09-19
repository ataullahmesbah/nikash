# Nikash Web — Landing + Download + Super Admin Panel

Next.js 15 (App Router) + Tailwind + Supabase.

## এখানে যা তৈরি আছে (Phase 1 foundation)

- `/` — পরিচিতি পেজ
- `/signup` + `POST /api/signup` — **স্ব-নিবন্ধন (self-serve signup)**। এটাই একমাত্র জায়গা যেখানে নতুন কোম্পানি তৈরি হয় — সার্ভার-সাইডে auth user বানায় (admin API) তারপর service_role দিয়ে `provision_company()` কল করে। App-এর signup স্ক্রিনও এই একই endpoint কল করে।
- `/download` — APK ডাউনলোড পেজ (`app_versions` টেবিল থেকে সর্বশেষ ভার্সন দেখায়)
- `/admin/login` — Super Admin লগইন (custom bcrypt + JWT session, `platform_admins` টেবিল ব্যবহার করে — Supabase Auth না, কারণ platform admin কোম্পানি-ইউজার থেকে সম্পূর্ণ আলাদা রাখা হয়েছে PRD অনুযায়ী)
- `/admin` — ড্যাশবোর্ড (কোম্পানি সংখ্যা, এ মাসের আয়, অপেক্ষমাণ পেমেন্ট)
- `/admin/companies` — কোম্পানি তালিকা + সার্চ
- `/admin/companies/[id]` — কোম্পানি বিস্তারিত, subscription বাড়ানো, status বদলানো (active/readonly/blocked/lifetime free)
- `/admin/payments` — Payment request approve/reject (approve করলেই `extend_subscription` RPC কল হয় এবং `platform_payments` রেকর্ড হয়)
- `/admin/notices` — নোটিশ তৈরি ও পাঠানো (সবাই/নির্দিষ্ট business_type, severity, banner/popup)
- `/admin/app-versions` — নতুন APK ভার্সন প্রকাশ (version, build number, APK URL, force update flag) — `/download` পেজ এখান থেকেই সর্বশেষ ভার্সন দেখায়
- `/admin/audit` — অ্যাডমিন কার্যক্রম (`admin_logs`) ও লগইন ইতিহাস (`login_history`) দেখার পেজ, দুই ট্যাবে
- `/admin/analytics` — **MRR/ARR রাজস্ব বিশ্লেষণ (PRD ২১.১)**: MRR (পরিশোধকারী কোম্পানিদের প্ল্যান মাসিক-normalized), ARR, প্ল্যান-ভিত্তিক বিভাজন টেবিল, গত ১২ মাসের নগদ-ভিত্তিক আদায়ের বার চার্ট (`recharts`)
- `/admin/settings` — **2FA (TOTP) enrollment (PRD ২১.৩)**: QR কোড দিয়ে Google Authenticator/Authy সেটআপ, কোড দিয়ে নিশ্চিতকরণের পরই চালু হয়, নিষ্ক্রিয় করতেও বর্তমান কোড লাগে। লগইন ফ্লো: পাসওয়ার্ড ঠিক হলে 2FA চালু থাকা অ্যাকাউন্টের জন্য একটা ৫-মিনিটের pending token ফেরত যায় (কুকি না — response body-তে), `/api/admin/login/verify-2fa`-এ কোডসহ পাঠালে তবেই session তৈরি হয়

সব admin action `admin_logs` টেবিলে অটো লগ হয় (`lib/audit.ts`)।

## এখনো যা বাকি (পরের ধাপ)

- Invoice PDF generation

## চালানো

```bash
npm install
cp .env.example .env.local   # নিচের এনভায়রনমেন্ট ভ্যারিয়েবল পূরণ করুন
npm run dev
```

## Environment variables (`.env.local`)

| Variable | কোথা থেকে পাবেন | ব্রাউজারে যায়? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | হ্যাঁ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | হ্যাঁ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | **না, কখনো না** |
| `ADMIN_JWT_SECRET` | নিজে বানান: `openssl rand -base64 32` | না |

## প্রথম Super Admin তৈরি করা

কোনো সাইনআপ ফর্ম ইচ্ছাকৃতভাবে নেই। প্রথম অ্যাডমিন বানাতে:

```bash
node scripts/hash-password.mjs "আপনার-পাসওয়ার্ড"
```

তারপর Supabase SQL Editor-এ:

```sql
insert into platform_admins (name, email, password_hash, role)
values ('আপনার নাম', 'you@example.com', '<উপরের hash>', 'super_admin');
```

## Deploy

Vercel-এ deploy করুন, উপরের ৪টা env var সেট করুন। `nikash.vercel.app` domain PRD-তে উল্লেখ আছে।
