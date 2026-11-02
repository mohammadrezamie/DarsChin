import React, { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, ChevronDown, Sparkles, Zap } from 'lucide-react';
import type { CourseEligibilityResult, CourseRecommendation, StudentAcademicProfile } from '../types';
import { StudentWishlistBuilder } from './StudentWishlistBuilder';
import { RegistrationLaunchpad } from './RegistrationLaunchpad';
import { canPrioritizeOffering, currentPrimaryCoverage, orderedChosenCourses } from '../domain/student-flow-stage';

interface Props {
  stage: 'courses' | 'preferences';
  onStage: (value: 'courses' | 'preferences') => void;
  curriculumId: string | null;
  profile: StudentAcademicProfile | null;
  evaluations: CourseEligibilityResult[];
  recommendations: CourseRecommendation[];
  wishlistCourseIds: string[];
  selectedOfferingIds: string[];
  coursePriorities: string[];
  offeringPriorities: Record<string, string[]>;
  onSaveWishlist: (ids: string[]) => Promise<boolean>;
  onPrimary: (courseId: string, offeringId: string) => void;
  onAddFallback: (courseId: string, offeringId: string) => void;
  onRemoveFallback: (courseId: string, offeringId: string) => void;
  onReorderAlternatives: (courseId: string, ids: string[]) => void;
  onReorderCourses: (ids: string[]) => void | boolean | Promise<void | boolean>;
  planBusy?: boolean;
}

export function moveAlternative(list: readonly string[], id: string, direction: -1 | 1): string[] {
  const result = [...new Set(list)];
  const i = result.indexOf(id);
  const target = i + direction;
  if (i < 0 || target < 0 || target >= result.length) return result;
  [result[i], result[target]] = [result[target], result[i]];
  return result;
}

/** One persisted plan: course selection first, then teachers and registration queue together. */
export const CourseRegistrationFlow: React.FC<Props> = ({
  stage, onStage, curriculumId, profile, evaluations, recommendations, wishlistCourseIds,
  selectedOfferingIds, coursePriorities, offeringPriorities, onSaveWishlist, onPrimary,
  onAddFallback, onRemoveFallback, onReorderAlternatives, onReorderCourses, planBusy = false,
}) => {
  const [savingSelection, setSavingSelection] = useState(false);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const busy = savingSelection || planBusy;
  const courseGroups = orderedChosenCourses(wishlistCourseIds, coursePriorities).map(courseId => {
    const offerings = evaluations.filter(item => item.courseId === courseId);
    const primary = offerings.find(item => selectedOfferingIds.includes(item.offeringId)) || null;
    const availableIds = new Set(offerings.map(item => item.offeringId));
    const alternativeIds = [...new Set(offeringPriorities[courseId] || [])]
      .filter(id => id !== primary?.offeringId && availableIds.has(id));
    return { courseId, offerings, primary, alternativeIds };
  });
  const unlisted = evaluations.filter(item => selectedOfferingIds.includes(item.offeringId) &&
    !wishlistCourseIds.includes(item.courseId));
  const firstPendingId = courseGroups.find(course => !course.primary)?.courseId || courseGroups[0]?.courseId;
  const openCourseId = expandedCourseId === null ? firstPendingId : expandedCourseId;

  return <section dir="rtl" aria-label="انتخاب درس و صف ثبت یکپارچه" className="dc-registration-flow space-y-4">
    <header className="dc-flow-heading rounded-[1.6rem] p-4 sm:p-6">
      <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-black text-fuchsia-800 dark:bg-slate-900 dark:text-fuchsia-200">
        <Sparkles size={15} aria-hidden="true"/> انتخاب واحد، بدون سردرگمی
      </span>
      <h2 className="mt-3 text-xl font-black leading-9 text-slate-950 dark:text-white sm:text-2xl">
        اول درس‌ها؛ بعد استادها و صف ثبت
      </h2>
      <p className="mt-1 text-xs leading-7 text-slate-700 dark:text-slate-200">
        اول درس‌هایی را که می‌خواهی برداری انتخاب کن؛ سپس استاد اول، گروه‌های جایگزین و ترتیب ثبت را در یک جای مشترک بچین.
        این صف همان اولویت‌بندی توست؛ نه یک فهرست جدا.
      </p>
    </header>
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="مراحل انتخاب واحد">
      <button type="button" aria-current={stage === 'courses' ? 'step' : undefined} disabled={busy} onClick={() => onStage('courses')}
        className={'dc-flow-stage min-h-20 rounded-2xl p-3 text-right ' + (stage === 'courses' ? 'dc-flow-active' : '')}>
        <span className="block text-xs font-black">۱. انتخاب درس‌ها</span>
        <span className="mt-1 block text-[11px] leading-5">هنوز استاد انتخاب نکن</span>
      </button>
      <button type="button" aria-current={stage === 'preferences' ? 'step' : undefined}
        disabled={busy || !wishlistCourseIds.length} onClick={() => onStage('preferences')}
        className={'dc-flow-stage min-h-20 rounded-2xl p-3 text-right disabled:opacity-50 ' + (stage === 'preferences' ? 'dc-flow-active' : '')}>
        <span className="block text-xs font-black">۲. استاد و صف ثبت</span>
        <span className="mt-1 block text-[11px] leading-5">اولویت اول + جایگزین‌ها</span>
      </button>
    </div>
    {stage === 'courses' ? <>
      <StudentWishlistBuilder curriculumId={curriculumId} wishlistCourseIds={wishlistCourseIds}
        evaluations={evaluations} recommendations={recommendations} onSave={onSaveWishlist}
        onSavingChange={setSavingSelection} courseFirst/>
      <div className="dc-flow-next sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3 sm:static">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {wishlistCourseIds.length.toLocaleString('fa-IR')} درس انتخاب شده
        </span>
        <button type="button" disabled={busy || !wishlistCourseIds.length} onClick={() => onStage('preferences')}
          className="dc-flow-next-button inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-black text-white disabled:opacity-50">
          مرحله بعد: اولویت استاد <ArrowLeft size={16} aria-hidden="true"/>
        </button>
      </div>
    </> : <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
          {currentPrimaryCoverage(wishlistCourseIds, selectedOfferingIds, evaluations).ready.toLocaleString('fa-IR')} از {courseGroups.length.toLocaleString('fa-IR')} درس دارای استاد اولِ مجاز؛ ترتیب کارت‌ها با صف ثبت یکی است.
        </p>
        <button type="button" disabled={busy} onClick={() => onStage('courses')}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-fuchsia-300 bg-white px-3 text-xs font-bold text-fuchsia-800 dark:border-fuchsia-800 dark:bg-slate-900 dark:text-fuchsia-200">
          <ArrowRight size={16}/> ویرایش درس‌ها
        </button>
      </div>
      {busy && <p role="status" aria-live="polite" className="rounded-xl bg-sky-50 p-3 text-xs text-sky-900 dark:bg-sky-950 dark:text-sky-200">در حال ذخیرهٔ تغییرات…</p>}
      {unlisted.length > 0 && <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        گروه‌هایی از برنامهٔ قبلی خارج از درس‌های منتخب جدید وجود دارد. برای جلوگیری از حذف ناخواسته، باقی مانده‌اند؛ قبل از ثبت آن‌ها را بررسی کن.
      </p>}
      <div className="space-y-3" aria-label="استادهای اولویت‌دار">
        {courseGroups.map(({ courseId, offerings, primary, alternativeIds }, index) => {
          const ordered = [
            ...(primary ? [primary] : []),
            ...alternativeIds.map(id => offerings.find(item => item.offeringId === id))
              .filter((item): item is CourseEligibilityResult => Boolean(item)),
            ...offerings.filter(item => item.offeringId !== primary?.offeringId && !alternativeIds.includes(item.offeringId)),
          ];
          const expanded = openCourseId === courseId;
          return <article key={courseId} className="dc-flow-course overflow-hidden rounded-[1.3rem]">
            <button type="button" aria-expanded={expanded} aria-controls={'course-teachers-' + courseId}
              onClick={() => setExpandedCourseId(expanded ? '__all_closed__' : courseId)}
              className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 px-3 py-3 text-right focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 sm:px-4">
              <div className="flex min-w-0 items-center gap-2">
                <span className="dc-flow-index grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-black">
                  {(index + 1).toLocaleString('fa-IR')}
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">{offerings[0]?.courseName || 'درس بدون گروه ارائه‌شده'}</h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-300">{offerings.length.toLocaleString('fa-IR')} گروه ارائه‌شده</span>
                </div>
              </div>
              <span className="flex items-center gap-2">
                {primary && canPrioritizeOffering(primary) ? <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300"><CheckCircle2 size={15} className="ml-1 inline"/>{primary.instructor || 'استاد اول مشخص است'}</span>
                  : <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200">{primary ? 'استاد اول قبلی فعلاً مجاز نیست؛ جایگزین انتخاب کن' : 'استاد اول مشخص نیست'}</span>}
                <ChevronDown aria-hidden="true" className={'h-4 w-4 text-slate-500 transition-transform ' + (expanded ? 'rotate-180' : '')}/>
              </span>
            </button>
            {expanded && <div id={'course-teachers-' + courseId} className="space-y-2 border-t border-slate-100 p-3 dark:border-slate-700 sm:p-4">
              {ordered.map(item => {
                const isPrimary = item.offeringId === primary?.offeringId;
                const altRank = alternativeIds.indexOf(item.offeringId);
                const isAlt = altRank >= 0;
                const rank = isPrimary ? 1 : isAlt ? altRank + 2 : null;
                return <div key={item.offeringId}
                  className={'dc-flow-choice flex flex-wrap items-center justify-between gap-2 rounded-xl p-2.5 ' +
                    (isPrimary ? 'dc-flow-primary' : isAlt ? 'dc-flow-alternative' : '')}>
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[11px] font-black text-indigo-700 dark:bg-slate-800 dark:text-indigo-200">
                      {rank ? rank.toLocaleString('fa-IR') : '–'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 dark:text-white">
                        {item.instructor || 'استاد نامشخص'} · گروه {item.groupCode || '؟'}
                      </p>
                      <p className="text-[11px] leading-6 text-slate-600 dark:text-slate-300">
                        {item.dayOfWeek || 'روز نامشخص'} · {item.startTime || '--'} تا {item.endTime || '--'}
                      </p>
                      {!canPrioritizeOffering(item) && <p className="text-[11px] text-rose-700 dark:text-rose-300">
                        {item.primaryReason || 'شرایط اخذ این گروه تأیید نشده است'}
                      </p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!isPrimary && canPrioritizeOffering(item) && <button type="button" disabled={busy} onClick={() => onPrimary(courseId, item.offeringId)}
                      className="min-h-10 rounded-lg bg-fuchsia-600 px-2.5 text-[11px] font-black text-white">استاد اول</button>}
                    {!isPrimary && !isAlt && primary && canPrioritizeOffering(item) &&
                      <button type="button" disabled={busy} onClick={() => onAddFallback(courseId, item.offeringId)}
                        className="min-h-10 rounded-lg border border-amber-400 bg-amber-50 px-2 text-[11px] font-black text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">+ جایگزین</button>}
                    {isAlt && <>
                      <button type="button" disabled={busy || altRank === 0} aria-label={'اولویت بالاتر ' + item.instructor}
                        onClick={() => onReorderAlternatives(courseId, [
                          ...(primary ? [primary.offeringId] : []), ...moveAlternative(alternativeIds, item.offeringId, -1)
                        ])} className="grid min-h-10 min-w-9 place-items-center rounded-lg disabled:opacity-30"><ArrowUp size={16}/></button>
                      <button type="button" disabled={busy || altRank === alternativeIds.length - 1}
                        aria-label={'اولویت پایین‌تر ' + item.instructor} onClick={() => onReorderAlternatives(courseId, [
                          ...(primary ? [primary.offeringId] : []), ...moveAlternative(alternativeIds, item.offeringId, 1)
                        ])} className="grid min-h-10 min-w-9 place-items-center rounded-lg disabled:opacity-30"><ArrowDown size={16}/></button>
                      <button type="button" disabled={busy} onClick={() => onRemoveFallback(courseId, item.offeringId)}
                        className="min-h-10 px-2 text-[11px] font-black text-rose-700 dark:text-rose-300">حذف</button>
                    </>}
                    {isPrimary && <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-200">اولویت ۱</span>}
                  </div>
                </div>;
              })}
              {!offerings.length && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                برای این درس گروه ارائه‌شده پیدا نشد. خود درس از فهرست حذف نشده است.
              </p>}
            </div>}
          </article>;
        })}
      </div>
      <div className="dc-flow-queue-heading flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-indigo-950 dark:text-indigo-100">
        <Zap className="h-5 w-5 text-indigo-600 dark:text-indigo-300"/> همان اولویت‌ها در صف آمادهٔ ثبت
      </div>
      <RegistrationLaunchpad evaluations={evaluations} selectedOfferingIds={selectedOfferingIds}
        offeringPriorities={offeringPriorities} coursePriorities={coursePriorities} profile={profile}
        chosenCourseIds={wishlistCourseIds} planBusy={busy}
        onSelectPrimaryOffering={onPrimary}
        curriculumId={curriculumId} onEditPriorities={() => onStage('courses')}
        onReorderCourses={onReorderCourses} />
    </div>}
  </section>;
};
