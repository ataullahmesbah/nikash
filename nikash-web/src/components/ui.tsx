import Link from "next/link";
import type { ReactNode } from "react";

// ওয়েব অ্যাডমিনের শেয়ার্ড UI — সব পেজে একই কার্ড, ব্যাজ, টেবিল, খালি অবস্থা।

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  href,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  href?: string;
  icon?: string;
}) {
  const toneClass = {
    default: "text-slate-900",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-red-600",
    info: "text-sky-600",
  }[tone];

  const body = (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-500">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

export const BADGE_TONES = {
  default: "bg-slate-100 text-slate-600",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-sky-50 text-sky-700",
} as const;

export function Badge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_TONES[tone]}`}>
      {label}
    </span>
  );
}

export const COMPANY_STATUS: Record<string, { label: string; tone: keyof typeof BADGE_TONES }> = {
  trial: { label: "ট্রায়াল", tone: "info" },
  active: { label: "সক্রিয়", tone: "success" },
  grace: { label: "গ্রেস", tone: "warning" },
  readonly: { label: "শুধু-দেখা", tone: "warning" },
  blocked: { label: "ব্লক", tone: "danger" },
};

export function EmptyState({
  icon = "📭",
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-4xl">{icon}</div>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** স্পিনারের বদলে স্কেলিটন — পেজ দ্রুত মনে হয় */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? "w-1/3" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}

/** বোতামে লোডিং স্পিনার */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

/** পেজ বদলানোর সময় উপরে সরু নীল বার */
export function RouteProgress() {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-transparent">
      <div className="nk-progress-bar h-full w-full bg-sky-500" />
    </div>
  );
}

/**
 * অ্যাডমিন পেজ লোড হওয়ার সময়ের কঙ্কাল।
 *
 * পেজগুলো force-dynamic সার্ভার কম্পোনেন্ট, তাই সার্ভার উত্তর দেওয়ার
 * আগ পর্যন্ত আগে পর্দা ফাঁকা পড়ে থাকত। এখন loading.tsx এটা দেখায় —
 * উপরে চলন্ত বার, নিচে পেজের আকারে ধূসর ব্লক।
 */
export function PageLoading({
  cards = 4,
  rows = 6,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div aria-busy="true" aria-live="polite">
      <RouteProgress />
      <span className="sr-only">লোড হচ্ছে…</span>

      <div className="mb-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      {cards > 0 && (
        <div className="mb-6">
          <SkeletonCards count={cards} />
        </div>
      )}

      <Card>
        <SkeletonTable rows={rows} cols={5} />
      </Card>
    </div>
  );
}
