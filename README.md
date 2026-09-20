# নিকাশ (Nikash)

বাংলাদেশের মুদি সাপ্লাই চেইনের জন্য হিসাবের সফটওয়্যার।
সরবরাহকারী · গুদাম · দোকান — তিন স্তরের ব্যবসার ক্রয়, বিক্রয়, বাকি,
স্টক ও লাভের হিসাব এক জায়গায়।

## এক রিপোতে তিনটে অংশ

```
nikash-project/
├── nikash-app/     মোবাইল অ্যাপ      — Expo SDK 57 · React Native · TypeScript
├── nikash-web/     ওয়েব             — Next.js 16 · অ্যাডমিন প্যানেল + পাবলিক সাইট
├── database/       ডেটাবেজ          — Supabase (Postgres) মাইগ্রেশন, ক্রম অনুযায়ী
└── docs/           কাগজপত্র         — PRD, টেস্ট গাইড, নিরাপত্তা রিভিউ, লাইভ গাইড
```

তিনটেই একই Supabase প্রজেক্টে কথা বলে।

---

## প্রথমবার চালানো

### ১. ডেটাবেজ

Supabase → SQL Editor → `database/` ফোল্ডারের ফাইলগুলো **নম্বরের ক্রমে**
একটার পর একটা চালান:

```
01_schema.sql  →  02_functions_triggers.sql  →  03_rls_policies.sql
→ 04_seed.sql  →  05 … 13 পর্যন্ত
```

> `99_reset_company_data.sql` মাইগ্রেশন নয় — ওটা টেস্ট ডেটা মোছার
> স্ক্রিপ্ট। নিয়মিত চালানোর জিনিস নয় (তাই রিপোতে রাখা হয় না)।

### ২. ওয়েব

```bash
cd nikash-web
cp .env.example .env.local     # মান বসান
npm install
npm run dev                    # http://localhost:3000
```

### ৩. অ্যাপ

```bash
cd nikash-app
cp .env.example .env           # মান বসান
npm install --legacy-peer-deps
npx expo start -c
```

Expo Go অ্যাপ দিয়ে QR স্ক্যান করুন।

---

## পরিবেশের মান (environment)

দুটো `.env.example` ফাইলে কী কী লাগে সব লেখা আছে।

> 🔴 `SUPABASE_SERVICE_ROLE_KEY` আর `ADMIN_JWT_SECRET` কখনো কমিট করবেন না,
> ব্রাউজারে পাঠাবেন না, অ্যাপে রাখবেন না। `.gitignore` এগুলো আটকায় —
> কিন্তু `git add -f` দিয়ে জোর করবেন না।

---

## কাগজপত্র

| ফাইল | কী আছে |
|---|---|
| `docs/GO_LIVE.md` | লাইভে যাওয়ার ধাপে ধাপে গাইড |
| `docs/FINAL_TEST_GUIDE.md` | ২৬ ধাপের পরীক্ষা |
| `docs/SECURITY_REVIEW.md` | নিরাপত্তা রিভিউয়ের ফলাফল |
| `docs/PRD_APP_v2.md` · `PRD_WEB_v2.md` | পুরো স্পেসিফিকেশন |

---

## যাচাই (কিছু বদলানোর পরে)

```bash
cd nikash-app  && npx tsc --noEmit && npx expo export --platform android
cd nikash-web  && npx tsc --noEmit && npm run build
```

দুটোই ০ এরর দিলে তবেই কমিট করবেন।
