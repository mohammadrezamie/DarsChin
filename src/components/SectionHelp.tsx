import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpenText, ChevronDown, Lightbulb, ShieldAlert } from 'lucide-react';
import { helpTopicById } from '../help/topics';

type Props = { topicId: string; demo?: boolean };

/** Inline guidance stays collapsed to keep dense mobile workspaces compact. */
export const SectionHelp: React.FC<Props> = ({ topicId, demo = false }) => {
  const topic = helpTopicById(topicId);
  if (!topic) return null;

  return (
    <aside dir="rtl" aria-label={`راهنمای بخش ${topic.title}`}
      className="min-w-0 rounded-2xl border border-sky-200/80 bg-sky-50/70 shadow-sm dark:border-sky-900/70 dark:bg-sky-950/20">
      <details className="group min-w-0">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 rounded-2xl px-3 py-2.5 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:px-4">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">
            <Lightbulb aria-hidden="true" className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-extrabold leading-5 text-sky-950 dark:text-sky-100 sm:text-sm">این بخش چطور کار می‌کند؟</span>
            <span className="mt-0.5 block text-[11px] leading-5 text-slate-600 dark:text-slate-300 sm:text-xs">{topic.summary}</span>
          </span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-sky-700 transition-transform group-open:rotate-180 dark:text-sky-300" />
        </summary>
        <div className="min-w-0 border-t border-sky-200/70 px-4 pb-4 pt-3 dark:border-sky-900/70">
          <ol className="space-y-2">
            {topic.steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-xs leading-7 text-slate-700 dark:text-slate-200 sm:text-sm">
                <span aria-hidden="true" className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-sky-100 font-black text-sky-800 dark:bg-sky-900 dark:text-sky-200">{index + 1}</span>
                <span className="min-w-0">{step}</span>
              </li>
            ))}
          </ol>
          {topic.caution && <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <ShieldAlert aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />{topic.caution}
          </p>}
          {demo && <p className="mt-3 text-xs font-semibold leading-6 text-amber-800 dark:text-amber-300">در نسخهٔ آزمایشی، اطلاعات ساختگی‌اند و تغییرات به حساب واقعی منتقل نمی‌شوند.</p>}
          <Link to={`${topic.audience === 'admin' ? '/help/admin' : '/help'}?topic=${encodeURIComponent(topic.id)}`}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-300 bg-white px-4 text-xs font-extrabold text-sky-900 transition hover:border-sky-500 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800">
            <BookOpenText aria-hidden="true" className="h-4 w-4" /> راهنمای کامل و سؤالات متداول
          </Link>
        </div>
      </details>
    </aside>
  );
};
