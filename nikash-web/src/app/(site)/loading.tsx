import { RouteProgress, Skeleton } from "@/components/ui";

// পাবলিক সাইটের পেজ বদলের সময় — উপরে চলন্ত বার, নিচে হালকা কঙ্কাল।
export default function SiteLoading() {
    return (
        <div aria-busy="true" aria-live="polite" className="mx-auto max-w-5xl px-4 py-16">
            <RouteProgress />
            <span className="sr-only">লোড হচ্ছে…</span>

            <Skeleton className="mx-auto h-9 w-2/3" />
            <Skeleton className="mx-auto mt-4 h-4 w-1/2" />
            <Skeleton className="mx-auto mt-2 h-4 w-2/5" />

            <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
            </div>
        </div>
    );
}
