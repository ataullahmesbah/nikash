import type { ReactNode } from "react";

// আইনি পেজগুলোর একই বিন্যাস — শিরোনাম, হালনাগাদের তারিখ, তারপর ধারা।

export function LegalPage({
  title,
  updated,
  intro,
  sections,
  footer,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: ReactNode }[];
  footer?: ReactNode;
}) {
  return (
    <>
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-5 py-14">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">সর্বশেষ হালনাগাদ: {updated}</p>
          <p className="mt-5 leading-relaxed text-slate-600">{intro}</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-14">
        <div className="space-y-9">
          {sections.map((s, i) => (
            <div key={s.heading}>
              <h2 className="text-lg font-bold text-slate-900">
                {i + 1}. {s.heading}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">{s.body}</div>
            </div>
          ))}
        </div>
        {footer && <div className="mt-12 rounded-2xl bg-slate-50 p-6 text-sm text-slate-600">{footer}</div>}
      </section>
    </>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((x) => (
        <li key={x} className="flex gap-2">
          <span className="text-slate-400">•</span> {x}
        </li>
      ))}
    </ul>
  );
}
