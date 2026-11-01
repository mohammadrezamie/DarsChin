import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpenText, CheckCircle2, ChevronDown, GraduationCap, HelpCircle, Search, Shield, ShieldCheck, Sparkles, X } from 'lucide-react';
import { filterHelpTopics, HELP_FAQ, HELP_TOPICS, helpTopicById, type HelpAudience } from '../help/topics';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { adminWorkspaceAccess } from '../utils/admin-navigation';

type Category = 'all' | HelpAudience;

const categories: { key: Category; label: string; description: string; icon: typeof BookOpenText }[] = [
  { key:'all',label:'همهٔ راهنماها',description:'راهنمای کامل محصول',icon:BookOpenText },
  { key:'general',label:'شروع کار',description:'دمو، حساب و مفاهیم',icon:Sparkles },
  { key:'student',label:'دانشجو',description:'برنامه، صف ثبت و نیازسنجی',icon:GraduationCap },
  { key:'admin',label:'مدیریت',description:'چارت، قوانین و گزارش‌ها',icon:Shield },
];

const roleName = (role: HelpAudience) =>
  role === 'general' ? 'شروع کار' : role === 'student' ? 'میز کار دانشجو' : 'پنل مدیریت';

export const HelpCenterPage: React.FC<{ scope?: 'public' | 'admin' }> = ({ scope = 'public' }) => {
  const { user } = useAuth();
  const canSeeAdminGuide = scope === 'admin' && adminWorkspaceAccess(user).isAdmin;
  const [params, setParams] = useSearchParams();
  const requestedId = params.get('topic') ?? '';
  const requestedTopic = helpTopicById(requestedId);
  const [category, setCategory] = useState<Category>(() =>
    scope === 'admin' ? 'admin' : requestedTopic?.audience === 'student' || requestedTopic?.audience === 'general' ? requestedTopic.audience : 'all');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Deep links from individual workspaces reveal their exact help category.
  useEffect(() => {
    if (!requestedTopic || (requestedTopic.audience === 'admin' && !canSeeAdminGuide) ||
      (scope === 'public' && requestedTopic.audience === 'admin')) return;
    setCategory(requestedTopic.audience);
    setQuery('');
    const frame = requestAnimationFrame(() => {
      document.getElementById(`help-topic-${requestedTopic.id}`)?.scrollIntoView({
        block:'start',behavior:'auto',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [requestedId, scope, canSeeAdminGuide]);

  const topics = useMemo(() =>
    filterHelpTopics(query).filter(topic =>
      (scope === 'admin' ? canSeeAdminGuide && topic.audience === 'admin' : topic.audience !== 'admin') &&
      (category === 'all' || category === topic.audience)),
  [query, category, scope, canSeeAdminGuide]);

  const visibleFaq = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('fa').replace(/ي/g,'ی').replace(/ك/g,'ک');
    return HELP_FAQ.filter(faq =>
      (scope === 'admin' ? canSeeAdminGuide && faq.audience === 'admin' : faq.audience !== 'admin') &&
      (category === 'all' || category === 'general' || category === faq.audience || faq.audience === 'general') &&
      (!text || (faq.question + ' ' + faq.answer).toLocaleLowerCase('fa').replace(/ي/g,'ی').replace(/ك/g,'ک').includes(text)),
    );
  }, [category,query,scope,canSeeAdminGuide]);

  const chooseCategory = (next: Category) => {
    setCategory(next);
    setParams(current => {
      const updated = new URLSearchParams(current);
      updated.delete('topic');
      return updated;
    }, { replace: true });
  };

  return (
    <div dir="rtl" className="darschin-page min-h-dvh bg-slate-50 font-[Vazirmatn] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/85 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
        <nav aria-label="ناوبری مرکز راهنما" className="mx-auto flex min-h-[68px] max-w-7xl min-w-0 items-center justify-between gap-3 px-3 sm:px-6">
          <Link to="/" className="flex min-h-11 items-center gap-2 rounded-xl text-base font-black text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-200">
            <span className="inline-grid h-9 w-9 place-items-center rounded-xl bg-blue-700 text-white"><BookOpenText aria-hidden="true" className="h-5 w-5" /></span>
            <span className="hidden min-[350px]:inline">درس‌چین</span><span className="text-sm font-medium text-slate-500 dark:text-slate-300">/ راهنما</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to={scope === 'admin' ? '/admin' : '/demo/student'} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-blue-700 px-3 text-xs font-black text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-4 sm:text-sm">
              {scope === 'admin' ? 'پنل من' : 'تجربهٔ دمو'} <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </header>

      <main id="help-main" className="mx-auto max-w-7xl px-3 pb-20 pt-6 sm:px-6 sm:pt-10">
        <div className="relative overflow-hidden rounded-[1.65rem] bg-[#0f234d] px-4 py-8 text-white shadow-xl shadow-blue-950/10 sm:px-9 sm:py-12">
          <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-20 h-60 w-60 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-100"><HelpCircle aria-hidden="true" className="h-4 w-4" /> راهنمای استفاده از محصول</span>
            <h1 className="mt-4 text-[clamp(1.7rem,5vw,2.8rem)] font-black leading-[1.55]">{scope === 'admin' ? 'راهنمای داخلی پنل مدیریت' : 'هر بخش درس‌چین را راحت یاد بگیر'}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-8 text-blue-100 sm:text-base">{scope === 'admin' ? 'آموزش عملیات مجاز، چارت‌ها، ارائه‌ها، نقش‌ها و نیازسنجی؛ این بخش فقط برای مدیران دارای مجوز است.' : 'آموزش مرحله‌به‌مرحلهٔ برنامه‌ریزی انتخاب واحد، صف ثبت، نیازسنجی و پاسخ به پرسش‌های رایج دانشجویان.'}</p>
            <label htmlFor="help-search" className="mt-6 block text-xs font-bold text-blue-100">دنبال چه چیزی می‌گردی؟</label>
            <div className="mt-2 flex min-w-0 items-center gap-2 rounded-2xl bg-white px-3 py-1 text-slate-800 shadow-lg shadow-blue-950/15 sm:px-4">
              <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-700" />
              <input id="help-search" ref={searchRef} type="search" value={query} onChange={e=>setQuery(e.target.value)}
                placeholder="مثلاً: نیازسنجی، تداخل، پیش‌نیاز، کد گروه…"
                className="h-12 min-w-0 flex-1 border-0 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-500 focus:outline-none" />
              {query && <button type="button" aria-label="پاک‌کردن جست‌وجوی راهنما" onClick={()=>{setQuery('');searchRef.current?.focus();}}
                className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500"><X aria-hidden="true" className="h-4 w-4" /></button>}
            </div>
            <p className="mt-3 text-xs leading-6 text-blue-100">{scope === 'admin' ? 'این راهنما برای نقش‌های مجاز داخلی است؛ مشاهدهٔ مطلب، دسترسی عملیاتی تازه‌ای ایجاد نمی‌کند.' : 'برای استفاده از این راهنما نیازی به ورود نیست و دادهٔ شخصی لازم ندارد.'}</p>
          </div>
        </div>

        <section aria-label="دسته‌بندی راهنما" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {categories.filter(item => scope === 'admin' ? item.key === 'admin' : item.key !== 'admin').map(item=>{
            const Icon=item.icon;const active=category===item.key;
            return <button key={item.key} type="button" aria-pressed={active}
              onClick={()=>chooseCategory(item.key)}
              className={`flex min-h-[84px] min-w-0 flex-col items-start justify-center gap-1 rounded-2xl border px-3 py-3 text-right transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-4 ${active
                ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-sm dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-100'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'}`}>
              <span className="flex items-center gap-2 text-sm font-black"><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{item.label}</span>
              <span className={`text-[11px] leading-5 ${active?'text-blue-700 dark:text-blue-200':'text-slate-500 dark:text-slate-400'}`}>{item.description}</span>
            </button>;
          })}
        </section>

        <div className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0">
            <section aria-labelledby="help-topics-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-blue-700 dark:text-blue-300">آموزش کاربردی</p>
                  <h2 id="help-topics-title" className="mt-1 text-xl font-black leading-8 sm:text-2xl">راهنمای بخش‌های درس‌چین</h2>
                </div>
                <span role="status" aria-live="polite" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{topics.length.toLocaleString('fa-IR')} راهنما</span>
              </div>
              {topics.length ? <div className="mt-4 grid min-w-0 gap-3">
                {topics.map(topic=>(
                  <article key={topic.id} id={`help-topic-${topic.id}`} aria-label={topic.title}
                    className="min-w-0 scroll-mt-24 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-blue-700 dark:text-blue-300">{roleName(topic.audience)}</span>
                      {requestedId===topic.id && <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">راهنمای بخش انتخاب‌شده</span>}
                    </div>
                    <h3 className="text-base font-black leading-8 text-slate-950 dark:text-white sm:text-lg">{topic.title}</h3>
                    <p className="mt-1 text-sm leading-7 text-slate-600 dark:text-slate-300">{topic.summary}</p>
                    <details open={requestedId===topic.id ? true : undefined} className="group mt-3 rounded-xl border border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-800/55">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 text-xs font-extrabold text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-200 sm:text-sm">
                        آموزش گام‌به‌گام <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-slate-200 px-3 pb-4 pt-3 dark:border-slate-700">
                        <ol className="space-y-3">
                          {topic.steps.map((step,i)=><li key={step} className="flex items-start gap-2 text-sm leading-7 text-slate-700 dark:text-slate-200">
                            <span className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-blue-100 text-xs font-black text-blue-800 dark:bg-blue-950 dark:text-blue-200">{(i+1).toLocaleString('fa-IR')}</span><span className="min-w-0">{step}</span>
                          </li>)}
                        </ol>
                        {topic.caution && <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-7 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><ShieldCheck aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />{topic.caution}</p>}
                        {topic.audience !== 'general' && <Link to={topic.audience==='student'?'/demo/student':'/admin'}
                          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-xs font-extrabold text-blue-800 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200">
                          {topic.audience === 'admin' ? 'بازگشت به پنل مدیریت' : 'تجربهٔ همین محیط در دمو'} <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                        </Link>}
                      </div>
                    </details>
                  </article>
                ))}
              </div> : <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900">
                <Search aria-hidden="true" className="mx-auto h-8 w-8 text-slate-400" />
                <h3 className="mt-3 font-extrabold">راهنمایی با این عبارت پیدا نشد</h3>
                <p className="mt-1 text-sm leading-7 text-slate-500 dark:text-slate-400">عبارت دیگری امتحان کن یا دستهٔ «همهٔ راهنماها» را انتخاب کن.</p>
                <button type="button" onClick={()=>{setQuery('');chooseCategory('all');searchRef.current?.focus();}} className="mt-4 min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white">نمایش همهٔ راهنماها</button>
              </div>}
            </section>

            <section id="help-faq" aria-labelledby="help-faq-title" className="mt-12 scroll-mt-24">
              <p className="text-xs font-black text-blue-700 dark:text-blue-300">پرسش‌های متداول</p>
              <h2 id="help-faq-title" className="mt-1 text-xl font-black leading-8 sm:text-2xl">جواب سؤال‌های پرتکرار</h2>
              <div className="mt-4 space-y-3">
                {visibleFaq.map(faq=><details key={faq.question} className="group min-w-0 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-2 text-sm font-extrabold leading-7 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <span>{faq.question}</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-700 transition-transform group-open:rotate-180 dark:text-blue-300" />
                  </summary>
                  <p className="border-t border-slate-100 py-3 text-sm leading-8 text-slate-600 dark:border-slate-800 dark:text-slate-300">{faq.answer}</p>
                </details>)}
                {!visibleFaq.length && <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">برای این جست‌وجو پرسش متداولی وجود ندارد؛ همهٔ راهنماها را بررسی کن.</p>}
              </div>
            </section>
          </div>

          <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-900 dark:bg-blue-950/30">
              <h2 className="flex items-center gap-2 text-base font-black text-blue-900 dark:text-blue-100"><CheckCircle2 aria-hidden="true" className="h-5 w-5" /> مسیر پیشنهادی شروع</h2>
              <ol className="mt-4 space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-200">
                <li>۱. دمو دانشجو را باز کن.</li><li>۲. دروس و ساعت‌ها را مقایسه کن.</li><li>۳. برنامه و صف ثبت را بچین.</li><li>۴. برای ثبت نهایی، سامانهٔ رسمی دانشگاه را بررسی کن.</li>
              </ol>
              <Link to={scope === 'admin' ? '/admin' : '/demo/student'} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-700 px-3 text-sm font-extrabold text-white hover:bg-blue-800">{scope === 'admin' ? 'بازگشت به مدیریت' : 'شروع دموی دانشجو'}</Link>
              {scope !== 'admin' && <a href="/guide/" className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-blue-300 bg-white px-3 text-center text-xs font-bold text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200">چک‌لیست کامل انتخاب واحد</a>}
            </div>
            <p className="mt-4 text-xs leading-7 text-slate-500 dark:text-slate-400">این راهنما آموزش استفاده از ابزار است؛ شرایط قانونی اخذ درس و اطلاعات رسمی دانشگاه باید جداگانه تأیید شوند.</p>
          </aside>
        </div>
      </main>
      <footer className="border-t border-slate-200 bg-white px-4 py-6 text-center text-xs leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <Link to={scope === 'admin' ? '/admin' : '/' } className="font-bold text-blue-700 dark:text-blue-300">درس‌چین</Link> · {scope === 'admin' ? 'راهنمای داخلی مدیریت' : 'راهنمای دانشجو و سؤالات متداول'} · <Link to={scope === 'admin' ? '/admin' : '/demo/student'} className="underline underline-offset-4">{scope === 'admin' ? 'پنل مدیریت' : 'تجربهٔ رایگان'}</Link>
      </footer>
    </div>
  );
};
