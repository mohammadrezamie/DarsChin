import React from 'react';
import { BookOpenText, CheckCircle2 } from 'lucide-react';

export interface SectionHelpContent {
  title: string;
  purpose: string;
  steps: readonly string[];
  note?: string;
}

/** Compact, keyboard-accessible in-context help; never blocks the workspace. */
export const ContextualHelp: React.FC<{ content: SectionHelpContent; audience: 'student' | 'admin' }> = ({ content, audience }) => {
  return (
    <details key={content.title} className="group min-w-0 rounded-2xl border border-blue-200/80 bg-blue-50/60 px-3 py-2 text-right shadow-sm open:bg-white sm:px-4 dark:border-blue-900/70 dark:bg-blue-950/20 dark:open:bg-slate-900">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-1 text-sm font-bold text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-200">
        <span className="flex min-w-0 items-center gap-2"><BookOpenText aria-hidden="true" className="h-5 w-5 shrink-0" /> این بخش چه کاری می‌کند؟</span>
        <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xl font-normal leading-none text-blue-700 transition-transform group-open:rotate-45 dark:bg-blue-900/50 dark:text-blue-200">+</span>
      </summary>
      <div className="border-t border-blue-200/70 pb-3 pt-3 text-sm leading-7 text-slate-700 dark:border-blue-900/70 dark:text-slate-200">
        <h3 className="font-extrabold text-slate-950 dark:text-white">{content.title}</h3>
        <p className="mt-1">{content.purpose}</p>
        <ol className="mt-3 space-y-2" aria-label="مراحل پیشنهادی استفاده">
          {content.steps.map(step => (
            <li key={step} className="flex items-start gap-2">
              <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {content.note && <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-6 text-slate-600 dark:bg-slate-950/50 dark:text-slate-300">{content.note}</p>}
        {audience === 'student' && <a href="/help" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-white px-4 text-xs font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-200">مرکز راهنمای دانشجو و سؤال‌های متداول</a>}
      </div>
    </details>
  );
};
