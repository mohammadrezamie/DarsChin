import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpenCheck, CalendarCheck2, ClipboardList, ShieldCheck } from 'lucide-react';

const steps = [
  {
    icon: BookOpenCheck,
    number: '۰۱',
    title: 'چارت و شرایط درس‌ها',
    text: 'ورودی و رشتهٔ خودت را مشخص کن و پیش‌نیاز، هم‌نیاز و محدودیت‌های واحد را با اطلاعات تأییدشده بررسی کن.',
  },
  {
    icon: CalendarCheck2,
    number: '۰۲',
    title: 'ساعت کلاس و امتحان',
    text: 'گروه‌ها و ساعت‌ها را کنار هم قرار بده، تداخل‌ها را ببین و تعداد روزهای حضور را بسنج.',
  },
  {
    icon: ClipboardList,
    number: '۰۳',
    title: 'صف ثبتِ آماده',
    text: 'گزینه‌های اصلی و جایگزین را مرتب کن و کد گروه‌ها را برای ثبت نهایی در سامانهٔ رسمی آماده نگه دار.',
  },
];

const questions = [
  {
    question: 'آیا درس‌چین خودش در آموزشیار انتخاب واحد می‌کند؟',
    answer: 'خیر. درس‌چین برای تصمیم‌گیری، بررسی تداخل و مرتب‌کردن اولویت‌هاست. ثبت و تأیید نهایی واحدها در سامانهٔ رسمی دانشگاه انجام می‌شود.',
  },
  {
    question: 'می‌توانم بدون ثبت‌نام برنامه‌ریز را امتحان کنم؟',
    answer: 'بله؛ دموی دانشجو بدون شمارهٔ موبایل و رمز باز می‌شود و فقط از داده‌های آزمایشی استفاده می‌کند.',
  },
  {
    question: 'آیا تشخیص پیش‌نیاز به معنی مجازبودن قطعی درس است؟',
    answer: 'خیر. شرایط هر رشته و ورودی، سقف واحد، ارائهٔ گروه‌ها و مقررات مصوب باید جداگانه بررسی شوند. تصمیم نهایی با سامانه و مقررات آموزشی است.',
  },
  {
    question: 'برای انتخاب گروه، چه چیزهایی را با هم ببینم؟',
    answer: 'ساعت شروع و پایان کلاس، امتحان، استاد، کد دقیق گروه، فاصلهٔ رفت‌وآمد و گزینهٔ جایگزین را در یک برنامه مرور کن.',
  },
];

export const GettingStartedSection: React.FC = () => (
  <section id="getting-started" dir="rtl" aria-labelledby="getting-started-title"
    className="scroll-mt-24 border-y border-slate-200 bg-gradient-to-b from-white via-blue-50/50 to-slate-50 px-3 py-14 sm:px-6 sm:py-20 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900/60 dark:to-slate-950">
    <div className="mx-auto max-w-7xl">
      <div className="flex min-w-0 flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <p className="mb-2 text-xs font-black tracking-wide text-blue-700 dark:text-blue-300">راهنمای شروع · مخصوص برنامه‌ریزی انتخاب واحد</p>
          <h2 id="getting-started-title" className="text-[clamp(1.65rem,4.5vw,2.65rem)] font-black leading-[1.6] text-slate-950 dark:text-white">
            قبل از انتخاب واحد، <span className="text-blue-700 dark:text-blue-300">سه قدم مهم</span> را مرور کن
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-8 text-slate-600 dark:text-slate-300 sm:text-base">
            از پیدا کردن چارت درست تا آماده‌کردن صف ثبت؛ به‌جای حدس، کارهایت را مرحله‌به‌مرحله جلو ببر.
          </p>
        </div>
        <a href="/guide/" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-blue-300 bg-white px-5 text-sm font-extrabold text-blue-800 transition hover:border-blue-500 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-800">
          مطالعهٔ راهنمای کامل <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        </a>
      </div>

      <div className="mt-8 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map(({ icon: Icon, number, title, text }) => (
          <article key={number} className="group min-w-0 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-800/5 sm:p-6 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><Icon aria-hidden="true" className="h-6 w-6" /></span>
              <span className="text-sm font-black tabular-nums text-slate-400 dark:text-slate-500">{number}</span>
            </div>
            <h3 className="text-lg font-extrabold leading-7 text-slate-950 dark:text-white">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{text}</p>
          </article>
        ))}
      </div>

      <div id="faq" className="mt-14 grid min-w-0 gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-10">
        <div className="min-w-0">
          <span className="text-xs font-black text-blue-700 dark:text-blue-300">سؤال‌های متداول</span>
          <h2 className="mt-2 text-2xl font-black leading-[1.65] text-slate-950 dark:text-white sm:text-3xl">اول جواب سؤال‌هایت را بگیر</h2>
          <p className="mt-3 text-sm leading-8 text-slate-600 dark:text-slate-300">
            درس‌چین دستیار انتخاب واحد است، نه جایگزین قوانین دانشگاه. شفاف‌بودن محدودیت‌ها به‌اندازهٔ امکانات مهم است.
          </p>
          <Link to="/demo/student" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            امتحان دموی بدون ثبت‌نام <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
        <div className="min-w-0 space-y-3" aria-label="سؤالات متداول انتخاب واحد">
          {questions.map(({ question, answer }) => (
            <details key={question} className="group min-w-0 rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 shadow-sm open:border-blue-200 sm:px-5 dark:border-slate-800 dark:bg-slate-900/80 dark:open:border-blue-800">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-2 text-sm font-extrabold leading-7 text-slate-900 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:text-base dark:text-slate-100">
                <span>{question}</span>
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xl font-medium text-blue-700 group-open:rotate-45 dark:bg-blue-950 dark:text-blue-300">+</span>
              </summary>
              <p className="border-t border-slate-100 pb-3 pt-3 text-sm leading-8 text-slate-600 dark:border-slate-800 dark:text-slate-300">{answer}</p>
            </details>
          ))}
        </div>
      </div>
      <p className="mt-8 flex items-start gap-2 text-xs leading-7 text-slate-500 dark:text-slate-400">
        <ShieldCheck aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        محتوای راهنما آموزشی است؛ برای قوانین قطعی و ثبت واحد، مرجع رسمی دانشگاه و وضعیت پروندهٔ خودت را بررسی کن.
      </p>
    </div>
  </section>
);
