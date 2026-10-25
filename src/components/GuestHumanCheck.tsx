import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { apiRequest } from '../utils/api';

type TurnstileAPI = {
  render: (element: HTMLElement, options: {
    sitekey: string; action: string; theme: string; size: string;
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }) => string;
  remove: (widget: string) => void;
  reset: (widget: string) => void;
};
declare global { interface Window { turnstile?: TurnstileAPI } }
let scriptLoad: Promise<void> | null = null;

function loadTurnstile() {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser required'));
  if (window.turnstile) return Promise.resolve();
  if (!scriptLoad) scriptLoad = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => window.turnstile ? resolve() : reject(new Error('Widget failed to initialize'));
    script.onerror = () => reject(new Error('Widget unavailable'));
    document.head.appendChild(script);
  }).catch(error => { scriptLoad = null; throw error; });
  return scriptLoad;
}

/**
 * A real human challenge on guest login/registration and OTP screens.
 * Turnstile is preferred when configured; otherwise we show the existing
 * first-party SVG CAPTCHA. The backend must verify either mode.
 */
export const GuestHumanCheck: React.FC<{
  action: 'login' | 'register' | 'otp';
  token: string;
  onToken: (token: string) => void;
}> = ({ action, token, onToken }) => {
  const container = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<{ enabled:boolean; siteKey:string } | null>(null);
  const [configError, setConfigError] = useState(false);
  const [configRetry, setConfigRetry] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const [localCaptcha, setLocalCaptcha] = useState<{ id:string; svg:string } | null>(null);
  const [localAnswer, setLocalAnswer] = useState('');

  useEffect(() => {
    let alive = true;
    setConfigError(false);
    void apiRequest<{ enabled: boolean; siteKey: string }>('/api/security/challenge')
      .then(result => {
        if (!alive) return;
        if (result.success && result.data && typeof result.data.enabled === 'boolean') {
          setSettings(result.data);
        } else {
          setSettings(null);
          setConfigError(true); // No guessed or fake success on API failures.
        }
      }).catch(() => { if (alive) { setSettings(null); setConfigError(true); } });
    return () => { alive = false; };
  }, [configRetry]);

  useEffect(() => {
    if (settings?.enabled !== false) return;
    let alive = true;
    setStatus('loading');
    setLocalCaptcha(null);
    setLocalAnswer('');
    onToken('');
    // Reuse the existing OTP image CAPTCHA endpoint; no third-party access needed.
    void apiRequest<{ id:string; svg:string }>('/api/auth/otp/captcha/generate')
      .then(result => {
        if (!alive) return;
        if (result.success && result.data &&
          typeof result.data.id === 'string' && typeof result.data.svg === 'string') {
          setLocalCaptcha(result.data);
          setStatus('ready');
        } else setStatus('error');
      }).catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, [settings?.enabled, retry]);

  useEffect(() => {
    if (!settings?.enabled) return;
    if (!settings.siteKey) { setStatus('error'); return; }
    let active = true, widget: string | null = null;
    setStatus('loading');
    onToken('');
    void loadTurnstile().then(() => {
      if (!active || !container.current || !window.turnstile) return;
      widget = window.turnstile.render(container.current, {
        sitekey: settings.siteKey, action, theme: 'auto', size: 'flexible',
        callback: value => { if (active) { onToken(value); setStatus('ready'); } },
        'expired-callback': () => { if (active) { onToken(''); setStatus('ready'); } },
        'error-callback': () => { if (active) { onToken(''); setStatus('error'); } },
      });
      setStatus('ready');
    }).catch(() => { if (active) setStatus('error'); });
    return () => {
      active = false;
      if (widget !== null) window.turnstile?.remove(widget);
    };
  }, [settings?.enabled, settings?.siteKey, action, retry]);

  if (!settings) return <div role={configError ? 'alert' : 'status'} className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700">
    {configError ? 'دریافت تنظیمات تأیید انسان ناموفق بود؛ بدون تأیید ثبت‌نام و ورود امکان‌پذیر نیست.' : 'در حال بارگذاری تأیید امنیتی…'}
    {configError && <button type="button" className="mr-3 underline" onClick={() => setConfigRetry(n => n + 1)}>تلاش مجدد</button>}
  </div>;

  const localMode = !settings.enabled;
  return <div dir="rtl" className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
    <p className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
      <ShieldCheck className="h-4 w-4 text-blue-600" /> تأیید «من ربات نیستم»
    </p>
    {localMode ? <>
      {localCaptcha && <>
        <div className="flex flex-wrap items-center gap-3">
          <div role="img" aria-label="تصویر کد امنیتی" className="max-w-full overflow-hidden rounded-lg bg-white p-2"
            dangerouslySetInnerHTML={{ __html: localCaptcha.svg }} />
          <button type="button" onClick={() => setRetry(n => n + 1)}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs dark:border-slate-600">
            <RefreshCw className="h-4 w-4" /> تصویر جدید
          </button>
        </div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
          کد داخل تصویر را بنویس
          <input dir="ltr" type="text" autoComplete="off" maxLength={12} value={localAnswer}
            onChange={event => {
              const value = event.target.value.replace(/\s/g, '');
              setLocalAnswer(value);
              onToken(value ? `local:${localCaptcha.id}:${value}` : '');
            }}
            className="darschin-field mt-2 w-full text-base" placeholder="کد امنیتی" />
        </label>
      </>}
    </> : <div ref={container} className="min-h-[65px] min-w-0 max-w-full" />}
    {status === 'error' && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-200">
      <span>بارگذاری تأیید انسان ناموفق بود. اتصال این سرویس را بررسی کن.</span>
      <button type="button" onClick={() => setRetry(n => n + 1)} className="flex min-h-11 items-center gap-2 rounded-lg border border-rose-200 px-3">
        <RefreshCw className="h-4 w-4" /> تلاش مجدد
      </button>
    </div>}
    {status === 'loading' && <p className="text-xs text-slate-500 dark:text-slate-300">در حال بارگذاری تأیید امنیتی…</p>}
    {status === 'ready' && !token && <p className="text-xs text-slate-500 dark:text-slate-300">تأیید را تکمیل کن؛ ورود بدون پاسخ معتبر پذیرفته نمی‌شود.</p>}
  </div>;
};
