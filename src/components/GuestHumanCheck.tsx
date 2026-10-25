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

/** A visible human check for guest forms; never emulates a passed token. */
export const GuestHumanCheck: React.FC<{
  action: 'login' | 'register' | 'otp';
  token: string;
  onToken: (token: string) => void;
}> = ({ action, token, onToken }) => {
  const container = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<{ enabled:boolean; siteKey:string } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    void apiRequest<{ enabled: boolean; siteKey: string }>('/api/security/challenge')
      .then(result => { if (alive) setSettings(result.success && result.data
        ? result.data : { enabled: false, siteKey: '' }); });
    return () => { alive = false; };
  }, []);

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

  if (!settings || !settings.enabled) return null;
  return <div dir="rtl" className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
    <p className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
      <ShieldCheck className="h-4 w-4 text-blue-600" /> تأیید «من ربات نیستم»
    </p>
    <div ref={container} className="min-h-[65px] min-w-0 max-w-full" />
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
