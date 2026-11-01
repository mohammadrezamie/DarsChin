import React from 'react';
import { ExternalLink, GraduationCap } from 'lucide-react';

/** Canonical footer shared by every DarsChin route, including both isolated demos. */
export const COMPANY_WEBSITE = 'https://tnacompany.ir/';
export const COMPANY_NAME_FA = 'تکین نوآوران آینده';

function copyrightYear(): string {
  // Keep the notice current in the Persian calendar without a yearly source edit.
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' })
    .format(new Date());
}

export const SiteFooter: React.FC<{ withMobileDock?: boolean }> = ({ withMobileDock = false }) => (
  <footer
    dir="rtl"
    aria-label="مالکیت و اطلاعات شرکت سازندهٔ درس‌چین"
    className="mt-auto w-full border-t border-slate-800 bg-slate-950 text-slate-300"
  >
    <div className={`mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-center md:flex-row md:gap-8 md:px-6 ${withMobileDock ? 'pb-28 md:pb-6' : ''}`}>
      <div className="min-w-0 shrink-0 text-center md:text-right">
        <p className="inline-flex items-center justify-center gap-2 text-base font-black text-white md:justify-start">
          <GraduationCap aria-hidden="true" className="h-5 w-5 text-blue-400" />
          درس‌چین
        </p>
        <p className="mt-1 text-xs leading-6 text-slate-400">
          پروژه‌ای از شرکت {COMPANY_NAME_FA}
        </p>
      </div>

      <p className="max-w-xl text-center text-xs leading-7 text-slate-300">
        <span dir="ltr" className="inline-block whitespace-nowrap">© {copyrightYear()}</span>
        <span aria-hidden="true" className="mx-2 text-slate-500">·</span>
        کلیهٔ حقوق مادی و معنوی سامانهٔ درس‌چین متعلق به شرکت {COMPANY_NAME_FA} است.
      </p>

      <a
        href={COMPANY_WEBSITE}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="بازدید از وب‌سایت شرکت تکین نوآوران آینده، در زبانهٔ جدید"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:border-blue-500 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <span>وب‌سایت شرکت</span>
        <span dir="ltr" className="text-[11px] text-blue-200">tnacompany.ir</span>
        <ExternalLink aria-hidden="true" className="h-4 w-4 text-blue-300" />
      </a>
    </div>
  </footer>
);
