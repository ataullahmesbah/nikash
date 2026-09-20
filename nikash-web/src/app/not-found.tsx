import Link from "next/link";
import type { Metadata } from "next";
import SiteNav from "./(site)/_components/site-nav";
import SiteFooter from "./(site)/_components/site-footer";
import { getAdminSession } from "@/lib/auth/session";

// ৪০৪ — অ্যাপ রাউটারে যে URL কোনো রুটের সাথে মেলে না, সবই এখানে আসে।
// ফাইলটা app/ এর একদম রুটে থাকতে হয়; (site)/ এর ভেতরে রাখলে শুধু ওই
// সেগমেন্টের notFound() ধরত, অচেনা URL ধরত না।
//
// হেডার-ফুটার এখানে নিজে হাতে বসানো হয়েছে, কারণ এই ফাইলটা রুট
// লেআউটের ভেতরে রেন্ডার হয় — (site)/layout.tsx এর ভেতরে নয়।

export const metadata: Metadata = {
    title: "পাতাটি পাওয়া যায়নি — নিকাশ",
    description: "আপনি যে ঠিকানাটি খুঁজছেন সেটি নিকাশে নেই।",
};

const LINKS = [
    { href: "/services", icon: "🧾", label: "সেবা", hint: "নিকাশ কী কী করতে পারে" },
    { href: "/pricing", icon: "💳", label: "প্ল্যান ও দাম", hint: "কোন প্ল্যান আপনার জন্য" },
    { href: "/download", icon: "📱", label: "অ্যাপ ডাউনলোড", hint: "অ্যান্ড্রয়েড অ্যাপ নিন" },
    { href: "/contact", icon: "💬", label: "যোগাযোগ", hint: "আমাদের জানান" },
];

export default async function NotFound() {
    // লগইন করা থাকলে হেডারে "ড্যাশবোর্ড" দেখাবে — বাকি পাতার মতোই।
    // চাবি না থাকলেও ৪০৪ পাতা যেন না ভাঙে, তাই try/catch।
    let adminName: string | null = null;
    try {
        adminName = (await getAdminSession())?.name ?? null;
    } catch {
        adminName = null;
    }

    return (
        <div className="flex min-h-screen flex-col bg-white">
            <SiteNav adminName={adminName} />

            <main className="flex-1">
                <section className="border-b border-slate-200 bg-gradient-to-b from-emerald-50/60 to-white">
                    <div className="mx-auto max-w-3xl px-5 py-16 text-center sm:py-24">
                        <p
                            aria-hidden
                            className="select-none bg-gradient-to-b from-emerald-600 to-emerald-800 bg-clip-text text-7xl font-extrabold leading-none tracking-tight text-transparent sm:text-8xl"
                        >
                            ৪০৪
                        </p>

                        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                            পাতাটি খুঁজে পাওয়া যায়নি
                        </h1>

                        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                            আপনি যে ঠিকানাটি খুঁজছেন সেটি নিকাশে নেই। হয়তো লিংকটি পুরনো, অথবা
                            ঠিকানা লিখতে গিয়ে একটু ভুল হয়ে গেছে।
                        </p>

                        <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                            <Link
                                href="/"
                                className="rounded-xl bg-emerald-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                            >
                                হোম পেজে ফিরে যান
                            </Link>
                            <Link
                                href="/contact"
                                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                                সমস্যাটি আমাদের জানান
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-4xl px-5 py-14">
                    <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">
                        হয়তো এগুলো খুঁজছিলেন
                    </h2>

                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {LINKS.map((l) => (
                            <Link
                                key={l.href}
                                href={l.href}
                                className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-300 hover:bg-emerald-50/40"
                            >
                                <span
                                    aria-hidden
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl transition group-hover:bg-white"
                                >
                                    {l.icon}
                                </span>
                                <span className="min-w-0">
                                    <span className="block font-semibold text-slate-900">{l.label}</span>
                                    <span className="mt-0.5 block text-sm text-slate-500">{l.hint}</span>
                                </span>
                            </Link>
                        ))}
                    </div>

                    <p className="mt-10 text-center text-sm text-slate-500">
                        অ্যাপে হিসাব দেখতে চাইলে{" "}
                        <Link href="/download" className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
                            নিকাশ অ্যাপ
                        </Link>{" "}
                        নামিয়ে নিন — ইন্টারনেট ছাড়াও চলে।
                    </p>
                </section>
            </main>

            <SiteFooter />
        </div>
    );
}
