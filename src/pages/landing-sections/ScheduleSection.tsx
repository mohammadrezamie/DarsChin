import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Clock3, MapPin, UserRound } from 'lucide-react';

type PreviewSlot = 'morning' | 'noon';
type PreviewCourse = {
  id: string;
  day: string;
  slot: PreviewSlot;
  time: string;
  title: string;
  teacher?: string;
  room?: string;
  conflictWith?: string;
  tone: 'blue' | 'emerald' | 'violet';
};

// Fixed fictional content for the landing preview: no live schedule or eligibility claims.
const previewDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه'];
const previewCourses: PreviewCourse[] = [
  { id: 'physics', day: 'شنبه', slot: 'morning', time: '۰۸:۰۰ تا ۱۰:۰۰',
    title: 'فیزیک ۱', teacher: 'دکتر احمدی', room: 'کلاس ۱۰۱', tone: 'blue' },
  { id: 'programming', day: 'یکشنبه', slot: 'noon', time: '۱۰:۰۰ تا ۱۲:۰۰',
    title: 'برنامه‌سازی پیشرفته', teacher: 'دکتر کریمی', conflictWith: 'مدار منطقی', tone: 'violet' },
  { id: 'differential', day: 'دوشنبه', slot: 'morning', time: '۰۸:۰۰ تا ۱۰:۰۰',
    title: 'معادلات دیفرانسیل', teacher: 'دکتر رضایی', tone: 'emerald' },
];

const courseTones = {
  blue: 'bg-blue-50 text-blue-950 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-100 dark:ring-blue-900/60',
  emerald: 'bg-emerald-50 text-emerald-950 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-900/60',
  violet: 'bg-violet-50 text-violet-950 ring-violet-100 dark:bg-violet-950/30 dark:text-violet-100 dark:ring-violet-900/60',
} as const;

/** Normal-flow content that wraps within the card instead of overflowing a narrow grid cell. */
const CoursePreviewCard: React.FC<{ course: PreviewCourse; mobile?: boolean }> = ({ course, mobile = false }) => (
  <article className={`min-w-0 max-w-full rounded-2xl p-3 ring-1 ring-inset ${courseTones[course.tone]} ${mobile ? 'sm:p-4' : 'h-full'}`}>
    {mobile && (
      <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs font-bold">
        <span>{course.day}</span>
        <span className="inline-flex min-w-0 items-center gap-1"><Clock3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{course.time}</span>
      </div>
    )}
    <h3 className="min-w-0 break-words text-sm font-extrabold leading-6 [overflow-wrap:anywhere]">{course.title}</h3>
    <div className="mt-2 flex min-w-0 flex-col items-start gap-1.5 text-xs leading-5">
      {course.teacher && (
        <span className="flex min-w-0 max-w-full items-start gap-1.5">
          <UserRound aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{course.teacher}</span>
        </span>
      )}
      {course.room && (
        <span className="flex min-w-0 max-w-full items-start gap-1.5">
          <MapPin aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{course.room}</span>
        </span>
      )}
    </div>
    {course.conflictWith && (
      <p className="mt-3 flex min-w-0 items-start gap-1.5 rounded-lg bg-rose-100/80 px-2.5 py-2 text-xs font-bold leading-5 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">تداخل نمونه با {course.conflictWith}</span>
      </p>
    )}
  </article>
);

export const ScheduleSection: React.FC = () => {
  const reduceMotion = useReducedMotion();

  return (
    <section id="schedule" dir="rtl" aria-labelledby="landing-conflict-heading"
      className="scroll-mt-24 mx-auto w-full min-w-0 max-w-7xl px-3 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-12">
        <h2 id="landing-conflict-heading"
          className="mb-4 text-3xl font-black leading-snug text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
          تشخیص هوشمند تداخل
        </h2>
        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-lg sm:leading-9">
          هم‌پوشانی ساعت کلاس‌ها را به‌موقع ببین و گزینه‌های دیگر را بررسی کن.
          این برنامه، پیش‌نمایش ساختگی از شکل نمایش تداخل در درس‌چین است.
        </p>
      </div>

      <div className="min-w-0 max-w-full rounded-3xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-5 lg:p-7">
        <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
            <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            پیش‌نمایش برنامه هفتگی
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            دادهٔ نمونه
          </span>
        </div>

        {/* Phones and small tablets: cards preserve readable course, teacher and time details. */}
        <div aria-label="برنامهٔ هفتگی نمونه به تفکیک روز" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
          {previewCourses.map((course, index) => (
            <motion.div key={course.id} className="min-w-0"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: reduceMotion ? 0 : index * 0.06 }}>
              <CoursePreviewCard course={course} mobile />
            </motion.div>
          ))}
        </div>

        {/* Desktop: six fluid columns without a forced 700px minimum or absolute-positioned cards. */}
        <div aria-label="جدول هفتگی نمونه" className="hidden min-w-0 lg:block">
          <div className="grid min-w-0 grid-cols-[5rem_repeat(5,minmax(0,1fr))] gap-2">
            <div className="self-center text-center text-xs font-bold text-slate-500 dark:text-slate-400">ساعت</div>
            {previewDays.map(day => <div key={day}
              className="min-w-0 self-center py-2 text-center text-xs font-extrabold text-slate-600 dark:text-slate-300">{day}</div>)}
            {(['morning', 'noon'] as const).map(slot => (
              <React.Fragment key={slot}>
                <div className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 px-1 py-3 text-xs font-semibold text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <span>{slot === 'morning' ? '۰۸:۰۰' : '۱۰:۰۰'}</span>
                  <span>{slot === 'morning' ? '۱۰:۰۰' : '۱۲:۰۰'}</span>
                </div>
                {previewDays.map(day => {
                  const course = previewCourses.find(item => item.day === day && item.slot === slot);
                  return <div key={day} className="min-w-0 rounded-xl bg-slate-50/70 p-1 dark:bg-slate-800/30">
                    {course ? <CoursePreviewCard course={course} /> : <div aria-hidden="true" className="h-full min-h-28" />}
                  </div>;
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="mt-4 flex min-w-0 flex-wrap items-start gap-3 rounded-2xl bg-emerald-50/80 p-3 text-sm text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100 sm:p-4">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">گروه جایگزین در این مثال</p>
            <p className="mt-1 break-words text-xs leading-6 [overflow-wrap:anywhere] sm:text-sm">
              مدار منطقی، گروه ۲ — دوشنبه ۱۳:۰۰؛ بررسی جایگزین‌ها باید با اطلاعات معتبر ترم انجام شود.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
