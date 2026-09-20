# GitHub-এ কোড রাখা

তিনটে অংশ (অ্যাপ, ওয়েব, ডেটাবেজ) **একটাই রিপোতে** থাকবে। এটাকে বলে
monorepo — একসাথে বদলানো জিনিস একসাথে থাকলে ভার্সন মেলাতে সুবিধা।

---

## ধাপ ১ — গোপন ফাইল আছে কিনা শেষবার দেখুন

```bash
cd nikash-project
git init
git add -A
git status --short | grep -i "\.env" 
```

**✅ দেখার কথা:** শুধু `.env.example` দুটো। আর কিছু দেখালে **থামুন** —
`.gitignore` ঠিক হয়নি, আমাকে জানান।

---

## ধাপ ২ — প্রথম কমিট

```bash
git config user.name  "আপনার নাম"
git config user.email "your@email.com"

git commit -m "নিকাশ v1.0.0 — অ্যাপ, ওয়েব ও ডেটাবেজ"
```

---

## ধাপ ৩ — GitHub-এ রিপো বানান

[github.com/new](https://github.com/new) →

| ঘর | মান |
|---|---|
| Repository name | `nikash` |
| Visibility | **Private** ⚠️ |
| Add a README | ❌ টিক দেবেন না (আমাদের আছে) |
| .gitignore | ❌ None |

> 🔴 **Private রাখুন।** ব্যবসার কোড, আর ভুল করে কখনো কোনো গোপন জিনিস
> কমিট হয়ে গেলে Public হলে সাথে সাথে বট ধরে ফেলে।

---

## ধাপ ৪ — push করুন

GitHub যে লিংকটা দেখাবে সেটা দিয়ে:

```bash
git remote add origin https://github.com/<আপনার-নাম>/nikash.git
git branch -M main
git push -u origin main
```

প্রথমবার পাসওয়ার্ড চাইবে — GitHub পাসওয়ার্ড নয়, **Personal Access
Token** লাগে:
Settings → Developer settings → Personal access tokens → Tokens (classic)
→ Generate new token → `repo` টিক দিন → কপি করে পেস্ট করুন।

---

## ধাপ ৫ — Vercel যুক্ত করুন

[vercel.com/new](https://vercel.com/new) → GitHub দিয়ে লগইন → `nikash`
রিপো বাছুন →

| ঘর | মান |
|---|---|
| Framework Preset | Next.js |
| **Root Directory** | **`nikash-web`** ⚠️ |
| Build Command | (ফাঁকা রাখুন) |

> ⚠️ **Root Directory** না বদলালে Vercel রিপোর রুটে `package.json` খুঁজে
> পাবে না, বিল্ড ব্যর্থ হবে। এটাই monorepo-র একমাত্র বাড়তি ধাপ।

Environment Variables-এ ৪টা বসান (`docs/GO_LIVE.md` ধাপ ২ দেখুন) →
Deploy।

এরপর থেকে `git push` করলেই Vercel নিজে থেকে ডিপ্লয় করবে।

---

## প্রতিদিনের কাজ

```bash
git add -A
git commit -m "কী বদলালেন, এক লাইনে"
git push
```

কমিট করার আগে সবসময়:

```bash
cd nikash-app && npx tsc --noEmit
cd ../nikash-web && npx tsc --noEmit
```

---

## ভুল করে গোপন জিনিস push হয়ে গেলে

শুধু ফাইল মুছলে হবে না — git-এর ইতিহাসে থেকে যায়।

1. **সাথে সাথে Supabase-এ service_role key রিসেট করুন**
   (Settings → API → Reset)
2. নতুন `ADMIN_JWT_SECRET` বানান, Vercel-এ বদলান
3. তারপর ইতিহাস পরিষ্কার করুন
   ([git-filter-repo](https://github.com/newren/git-filter-repo))

কি রিসেট করাটাই আসল কাজ — ইতিহাস পরিষ্কার করা দ্বিতীয়।
