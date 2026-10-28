import React from 'react';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';

type BoundaryProps = { children: React.ReactNode; resetKey: string };
type BoundaryState = { hasError: boolean };

/**
 * A failed lazy route should not blank the entire web app. Route changes reset
 * the failure state without touching auth or persisted student selections.
 */
export class AppErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(previous: BoundaryProps): void {
    if (previous.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <main dir="rtl" id="main-content" role="main" className="darschin-error-screen mx-auto flex min-h-[75dvh] w-full max-w-3xl flex-col items-center justify-center gap-5 px-5 py-14 text-center">
        <span aria-hidden="true" className="inline-flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/45 dark:text-amber-300">
          <AlertTriangle className="h-8 w-8" />
        </span>
        <div className="max-w-lg space-y-3">
          <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">نمایش این بخش با مشکل روبه‌رو شد</h1>
          <p className="text-sm leading-8 text-slate-600 dark:text-slate-300">
            ممکن است اتصال یا بارگذاری این صفحه قطع شده باشد. اطلاعات درسی ذخیره‌شده را پاک نکردیم؛ می‌توانی صفحه را دوباره بارگذاری کنی.
          </p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-2.5 min-[380px]:flex-row">
          <button type="button" onClick={() => window.location.reload()}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
            <RefreshCw aria-hidden="true" className="h-4 w-4" /> بارگذاری دوباره
          </button>
          <a href="/" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <ArrowRight aria-hidden="true" className="h-4 w-4" /> صفحهٔ اصلی
          </a>
        </div>
      </main>
    );
  }
}
