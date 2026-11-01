// ============================================================================
// DARSCHYN (درس‌چین) - Student Dashboard
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  UploadCloud,
  Layers,
  Sparkles,
  BookOpen,
  Calendar,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { CourseEligibilityResult, CourseRecommendation, StudentAcademicProfile, AcademicLimitInfo } from '../types';

import { AcademicProfileModal } from './AcademicProfileModal';
import { PassedCoursesManager } from './PassedCoursesManager';
import { StudentHelpCenter } from './StudentHelpCenter';
import { ImportOfferingsModal } from './ImportOfferingsModal';
import { OfferingsList } from './OfferingsList';
import { RecommendationsPanel } from './RecommendationsPanel';
import { SchedulePlanner } from './SchedulePlanner';
import { DemandWorkspace } from './DemandWorkspace';
import { RegistrationLaunchpad } from './RegistrationLaunchpad';
import { StudentMobileDock } from './StudentMobileDock';

type StudentTab = 'offerings' | 'recommendations' | 'schedule' | 'registration' | 'demand' | 'passed' | 'support';

const studentTabs = [
  // Put the student's primary mobile journey first; all other workspaces
  // remain reachable via the same horizontal nav without a vertical menu.
  { id: 'offerings', label: 'بررسی تطبیقی دروس ارائه‌شده', short: 'دروس ارائه‌شده', icon: Layers },
  { id: 'schedule', label: 'برنامه‌ریز و جدول زمانی', short: 'برنامه من', icon: Calendar },
  { id: 'registration', label: 'صف سریع ثبت دروس', short: 'صف ثبت', icon: Zap },
  { id: 'recommendations', label: 'پیشنهاد هوشمند انتخاب واحد', short: 'پیشنهادها', icon: Sparkles },
  { id: 'passed', label: 'دروس پاس‌شده', short: 'پاس‌شده‌ها', icon: BookOpen },
  { id: 'demand', label: 'نیازسنجی درس‌های ترم آینده', short: 'نیازسنجی', icon: BookOpen },
  { id: 'support', label: 'پشتیبانی و گزارش خطا', short: 'پشتیبانی', icon: MessageCircle },
] as const;

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const isBrowserDemo = useLocation().pathname.startsWith('/demo/');
  
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null);
  const [curriculumId, setCurriculumId] = useState<string | null>(null);
  const [academicLimits, setAcademicLimits] = useState<AcademicLimitInfo | null>(null);
  const [currentTerm, setCurrentTerm] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<CourseEligibilityResult[]>([]);
  const [recommendations, setRecommendations] = useState<CourseRecommendation[]>([]);
  const [demandCourseIds, setDemandCourseIds] = useState<string[]>([]);
  const [demandSurveyAvailable, setDemandSurveyAvailable] = useState(false);
  const [selectedOfferingIds, setSelectedOfferingIds] = useState<string[]>([]);
  const [coursePriorities, setCoursePriorities] = useState<string[]>([]);
  const [offeringPriorities, setOfferingPriorities] = useState<Record<string, string[]>>({});

  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<{
    offeringId: string;
    courseName: string;
    messages: string[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<StudentTab>('offerings');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const planMutationRef = useRef(false);
  const evaluationVersionRef = useRef(0);
  const tabButtonsRef = useRef<Partial<Record<StudentTab, HTMLButtonElement | null>>>({});
  const tabStripRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const conflictDialogRef = useRef<HTMLDivElement>(null);
  const conflictCancelRef = useRef<HTMLButtonElement>(null);
  const clearDialogRef = useRef<HTMLDivElement>(null);
  const clearCancelRef = useRef<HTMLButtonElement>(null);
  const conflictOpen = Boolean(conflictWarning);

  // An academic warning must stay usable when the browser is zoomed or a
  // keyboard is attached: lock underlying scroll and contain keyboard focus.
  useEffect(() => {
    if (!conflictOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    conflictCancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Keep the warning visible until the pending server write finishes.
        if (!planMutationRef.current) {
          event.preventDefault();
          setConflictWarning(null);
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const actions = conflictDialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      if (!actions?.length) return;
      const first = actions[0], last = actions[actions.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = oldOverflow;
      previousFocus?.focus();
    };
  }, [conflictOpen]);

  // Replace blocking native confirm() with a keyboard-accessible in-app
  // confirmation. Closing never discards an in-flight server write.
  useEffect(() => {
    if (!clearConfirmOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    clearCancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!planMutationRef.current) {
          event.preventDefault();
          setClearConfirmOpen(false);
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = clearDialogRef.current?.querySelectorAll('button:not([disabled])');
      const first = focusable?.item(0) as HTMLButtonElement | null;
      const last = focusable?.item((focusable?.length ?? 0) - 1) as HTMLButtonElement | null;
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = oldOverflow;
      previousFocus?.focus();
    };
  }, [clearConfirmOpen]);

  // Only scroll the desktop tab strip itself. scrollIntoView() on the tab
  // accidentally scrolled the WHOLE document when students switched tabs.
  useEffect(() => {
    const button = tabButtonsRef.current[activeTab];
    const strip = tabStripRef.current;
    if (!button || !strip) return;
    const bounds = button.getBoundingClientRect();
    const area = strip.getBoundingClientRect();
    const delta = bounds.right > area.right ? bounds.right - area.right
      : bounds.left < area.left ? bounds.left - area.left : 0;
    if (Math.abs(delta) > 1) strip.scrollBy({ left: delta, behavior: 'auto' });
  }, [activeTab]);

  const selectMobileWorkspace = (tab: StudentTab) => {
    setActiveTab(tab);
    // A deliberate bottom-dock action should reveal the selected content
    // above the dock instead of leaving the student at a distant scroll point.
    requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      workspaceRef.current?.focus({ preventScroll: true });
    });
  };

  const fetchDashboardData = async () => {
    const version = ++evaluationVersionRef.current;
    setLoading(true);
    setLoadError(null);
    // Never carry a prior student's selection or private academic summary into
    // a newly authenticated student's workspace while requests are pending.
    if (profile?.userId && profile.userId !== user?.id) {
      setProfile(null);
      setCurriculumId(null);
      setAcademicLimits(null);
      setCurrentTerm(null);
      setEvaluations([]);
      setRecommendations([]);
      setSelectedOfferingIds([]);
      setCoursePriorities([]);
      setOfferingPriorities({});
    }
    try {
      // Resolve saved selections before calculating eligibility on reload.
      const [profileRes, planRes] = await Promise.all([
        apiRequest<{ profile: StudentAcademicProfile; curriculum?: { id: string } | null }>('/api/student/profile'),
        apiRequest<{ selectedOfferingIds?: string[]; coursePriorities?: string[] | Record<string, number>; offeringPriorities?: Record<string, string[]> }>('/api/student/plan'),
      ]);
      if (version !== evaluationVersionRef.current) return;
      // Both responses are required before evaluating a plan. Never silently
      // use an old browser selection if the persisted plan request failed.
      if (!profileRes.success || !profileRes.data?.profile ||
          !planRes.success || !planRes.data ||
          !Array.isArray(planRes.data.selectedOfferingIds)) {
        setProfile(null);
        setCurriculumId(null);
        setSelectedOfferingIds([]);
        setCoursePriorities([]);
        setOfferingPriorities({});
        setEvaluations([]);
        setRecommendations([]);
        setAcademicLimits(null);
        setCurrentTerm(null);
        setLoadError(!profileRes.success || !profileRes.data?.profile
          ? profileRes.error || 'پرونده تحصیلی دریافت نشد؛ پیش‌نمایش موقتاً خالی است.'
          : planRes.error || 'برنامه ذخیره‌شده دریافت نشد؛ اطلاعات حساب حذف نشده‌اند. دوباره تلاش کنید.');
        return;
      }
      setProfile(profileRes.data.profile);
      setCurriculumId(profileRes.data.curriculum?.id || null);
      const planned = planRes.data.selectedOfferingIds;
      setSelectedOfferingIds(planned);
      const priorities = planRes.data.coursePriorities;
      if (Array.isArray(priorities)) setCoursePriorities(priorities);
      else if (priorities && typeof priorities === 'object') {
        setCoursePriorities(Object.keys(priorities).sort((x, y) => priorities[x] - priorities[y]));
      } else setCoursePriorities([]);
      setOfferingPriorities(planRes.data.offeringPriorities &&
        typeof planRes.data.offeringPriorities === 'object' ? planRes.data.offeringPriorities : {});

      const evalRes = await apiRequest<any>('/api/eligibility/evaluate', {
        method: 'POST', body: JSON.stringify({ plannedCourseIds: planned }),
      });
      if (version !== evaluationVersionRef.current) return;
      if (evalRes.success && evalRes.data) {
        setEvaluations(evalRes.data.report?.results || []);
        setRecommendations(evalRes.data.recommendations || []);
        // Absence is not permission to retain an earlier student's limits or
        // a previous evaluation's academic term.
        setAcademicLimits(evalRes.data.academicLimits ?? null);
        setCurrentTerm(evalRes.data.context?.term ?? null);
      } else {
        setEvaluations([]);
        setRecommendations([]);
        setAcademicLimits(null);
        setCurrentTerm(null);
        setLoadError(evalRes.error || 'تحلیل دروس ارائه‌شده در دسترس نیست؛ تا دریافت مجدد امکان ویرایش برنامه غیرفعال است.');
      }
    } catch {
      if (version === evaluationVersionRef.current) {
        setEvaluations([]);
        setRecommendations([]);
        setAcademicLimits(null);
        setCurrentTerm(null);
        setLoadError('ارتباط با سامانه برقرار نشد؛ پیش از تغییر برنامه، اطلاعات را دوباره دریافت کنید.');
      }
    } finally {
      if (version === evaluationVersionRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.roles?.includes('student')) void fetchDashboardData();
  }, [user]);

  useEffect(() => {
    if (!user?.id || !user.roles.includes('student')) return;
    let mounted = true;
    const loadDemandHints = async () => {
      const surveys = await apiRequest<{id:string;status:string}[]>('/api/demand/surveys');
      const open = surveys.data?.find(item => item.status === 'OPEN');
      if (!mounted) return;
      setDemandSurveyAvailable(!!open);
      if (!open) { setDemandCourseIds([]); return; }
      const prior = await apiRequest<{courseIds:string[]} | null>(`/api/demand/surveys/${open.id}/response`);
      if (mounted) setDemandCourseIds(prior.data?.courseIds || []);
    };
    void loadDemandHints();
    return () => { mounted = false; };
  }, [user?.id, activeTab]);

  useEffect(() => {
    if (!user?.id || !user.roles.includes('student')) return;
    const checkActivation = async () => {
      const list = await apiRequest<{id:string;status:string}[]>('/api/demand/surveys');
      setDemandSurveyAvailable(Boolean(list.success && list.data?.some(s => s.status === 'OPEN')));
    };
    window.addEventListener('focus', checkActivation);
    return () => window.removeEventListener('focus', checkActivation);
  }, [user?.id]);

  useEffect(() => {
    if (!demandSurveyAvailable && activeTab === 'demand') setActiveTab('offerings');
  }, [demandSurveyAvailable, activeTab]);

  // Serialize plan writes: simultaneous controls must never overwrite a newer plan.
  const runPlanMutation = async (request: () => Promise<{ success: boolean; error?: string }>) => {
    if (loading || loadError) {
      setPlanError('برنامه هنوز به‌طور معتبر بارگذاری نشده است. ابتدا دریافت دوباره اطلاعات را انجام دهید.');
      return false;
    }
    if (planMutationRef.current) {
      setPlanError('تغییر قبلی هنوز در حال ثبت است. پس از پایان ذخیره‌سازی دوباره تلاش کنید.');
      return false;
    }
    planMutationRef.current = true;
    setPlanStatus('saving');
    setPlanError(null);
    try {
      const response = await request();
      if (!response.success) {
        setPlanStatus('error');
        setPlanError(response.error || 'تغییر برنامه ذخیره نشد. برنامه قبلی حفظ شده است.');
        return false;
      }
      setPlanError(null);
      setPlanStatus('saved');
      return true;
    } catch {
      setPlanStatus('error');
      setPlanError('ارتباط هنگام ذخیره‌سازی برقرار نشد. برنامه قبلی حفظ شده است.');
      return false;
    } finally {
      planMutationRef.current = false;
    }
  };

  const syncPlanToServer = (
    newSelectedIds: string[],
    newCoursePriorities: string[],
    newOfferingPriorities: Record<string, string[]>,
  ) => runPlanMutation(() => apiRequest('/api/student/plan', {
    method: 'PUT',
    body: JSON.stringify({
      selectedOfferingIds: newSelectedIds,
      coursePriorities: newCoursePriorities,
      offeringPriorities: newOfferingPriorities,
    }),
  }));

  // Reorder courses
  const handleReorderCourses = async (newCourseOrder: string[]): Promise<boolean> => {
    const saved = await syncPlanToServer(selectedOfferingIds, newCourseOrder, offeringPriorities);
    if (saved) setCoursePriorities(newCourseOrder);
    return saved;
  };

  // Select primary offering for a course (promotes offering to primary)
  const handleSelectPrimaryOffering = async (courseId: string, offeringId: string) => {
    const currentCourseOfferings = offeringPriorities[courseId] || [];
    const currentPrimary = selectedOfferingIds.find((id) => {
      const e = evaluations.find((ev) => ev.offeringId === id);
      return (e?.courseId || e?.courseCode) === courseId;
    });

    // Replace old primary with new offering in selectedOfferingIds
    const newSelected = [
      ...selectedOfferingIds.filter((id) => id !== currentPrimary && id !== offeringId),
      offeringId,
    ];

    const updatedOfferingList = [
      offeringId,
      ...currentCourseOfferings.filter((id) => id !== offeringId),
    ];
    const newOfferingPriorities = {
      ...offeringPriorities,
      [courseId]: updatedOfferingList,
    };

    if (await syncPlanToServer(newSelected, coursePriorities, newOfferingPriorities)) {
      setSelectedOfferingIds(newSelected);
      setOfferingPriorities(newOfferingPriorities);
      // The primary section changed; refresh server-derived prerequisites,
      // schedule conflicts and recommendations for the actual saved plan.
      void fetchDashboardData();
    }
  };

  // Add a fallback offering for a course
  const handleAddFallbackOffering = async (courseId: string, offeringId: string) => {
    const currentCourseOfferings = offeringPriorities[courseId] || [];
    if (currentCourseOfferings.includes(offeringId)) return;

    const newOfferingPriorities = {
      ...offeringPriorities,
      [courseId]: [...currentCourseOfferings, offeringId],
    };
    if (await syncPlanToServer(selectedOfferingIds, coursePriorities, newOfferingPriorities)) {
      setOfferingPriorities(newOfferingPriorities);
    }
  };

  // Remove a fallback offering from a course
  const handleRemoveFallbackOffering = async (courseId: string, offeringId: string) => {
    const currentCourseOfferings = offeringPriorities[courseId] || [];
    const newOfferingPriorities = {
      ...offeringPriorities,
      [courseId]: currentCourseOfferings.filter((id) => id !== offeringId),
    };
    if (await syncPlanToServer(selectedOfferingIds, coursePriorities, newOfferingPriorities)) {
      setOfferingPriorities(newOfferingPriorities);
    }
  };

  // Calculate schedule conflicts
  const selectedItems = evaluations.filter((e) => selectedOfferingIds.includes(e.offeringId));
  const timeConflicts: { offering1: string; offering2: string; day: string }[] = [];
  const prerequisiteConflicts = selectedItems.filter((e) => e.missingPrerequisites && e.missingPrerequisites.length > 0);

  for (let i = 0; i < selectedItems.length; i++) {
    for (let j = i + 1; j < selectedItems.length; j++) {
      const o1 = selectedItems[i];
      const o2 = selectedItems[j];
      
      // Basic time overlap check
      if (
        o1.dayOfWeek && o2.dayOfWeek && o1.dayOfWeek === o2.dayOfWeek &&
        o1.startTime && o1.endTime && o2.startTime && o2.endTime
      ) {
        if (o1.startTime < o2.endTime && o1.endTime > o2.startTime) {
          timeConflicts.push({
            offering1: o1.courseName,
            offering2: o2.courseName,
            day: o1.dayOfWeek,
          });
        }
      }
    }
  }

  const confirmToggleScheduleOffering = async (offeringId: string) => {
    const isAdding = !selectedOfferingIds.includes(offeringId);
    const newSelected = isAdding
      ? [...selectedOfferingIds, offeringId]
      : selectedOfferingIds.filter(id => id !== offeringId);

    // Backend authorization/eligibility is authoritative; do not optimistically
    // render an offering the API may reject.
    let acceptedSelectedIds = newSelected;
    let acceptedPriorities: Record<string, string[]> | undefined;
    const saved = await runPlanMutation(async () => {
      const response = await apiRequest<{
        selectedOfferingIds?: string[];
        plan?: { offeringPriorities?: Record<string, string[]> };
        offeringPriorities?: Record<string, string[]>;
      }>('/api/student/plan/select', {
        method: 'POST',
        body: JSON.stringify({ offeringId, action: isAdding ? 'add' : 'remove' }),
      });
      if (response.success) {
        if (Array.isArray(response.data?.selectedOfferingIds)) {
          acceptedSelectedIds = response.data.selectedOfferingIds;
        }
        acceptedPriorities = response.data?.plan?.offeringPriorities || response.data?.offeringPriorities;
      }
      return response;
    });
    if (!saved) return;

    setSelectedOfferingIds(acceptedSelectedIds);
    if (acceptedPriorities) setOfferingPriorities(acceptedPriorities);
    setConflictWarning(null);
    const version = ++evaluationVersionRef.current;
    const evalRes = await apiRequest<any>('/api/eligibility/evaluate', {
      method: 'POST',
      body: JSON.stringify({ plannedCourseIds: acceptedSelectedIds }),
    });
    if (version !== evaluationVersionRef.current) return;
    if (evalRes.success && evalRes.data) {
      setEvaluations(evalRes.data.report?.results || []);
      setRecommendations(evalRes.data.recommendations || []);
    } else {
      setLoadError(evalRes.error || 'تغییر برنامه ثبت شد؛ تحلیل جدید در دسترس نیست. اطلاعات را دوباره دریافت کنید.');
    }
  };

  const handleToggleScheduleOffering = (offeringId: string) => {
    if (selectedOfferingIds.includes(offeringId)) {
      confirmToggleScheduleOffering(offeringId);
      return;
    }

    const newEval = evaluations.find((e) => e.offeringId === offeringId);
    if (!newEval) return;

    // Strict ineligibility blocking
    if (!newEval.canSelect || !newEval.isEligible || newEval.overallStatus !== 'AVAILABLE') {
      setConflictWarning({
        offeringId,
        courseName: newEval.courseName,
        messages: [
          `خطای عدم صلاحیت آموزشی: ${newEval.primaryReason || 'پیش‌نیازهای این درس رعایت نشده است.'}`,
          ...(newEval.missingPrerequisites && newEval.missingPrerequisites.length > 0
            ? [`پیش‌نیازهای پاس‌نشده: ${newEval.missingPrerequisites.map((p) => p.name).join('، ')}`]
            : []),
          ...(newEval.missingCorequisites && newEval.missingCorequisites.length > 0
            ? [`هم‌نیازهای انتخاب‌نشده: ${newEval.missingCorequisites.map((c) => c.name).join('، ')}`]
            : []),
        ],
      });
      return;
    }

    const currentSelected = evaluations.filter((e) => selectedOfferingIds.includes(e.offeringId));
    const messages: string[] = [];

    currentSelected.forEach((existing) => {
      // Lecture Conflict
      if (
        newEval.dayOfWeek &&
        existing.dayOfWeek &&
        newEval.dayOfWeek === existing.dayOfWeek &&
        newEval.startTime &&
        existing.startTime &&
        newEval.endTime &&
        existing.endTime
      ) {
        if (newEval.startTime < existing.endTime && newEval.endTime > existing.startTime) {
          messages.push(
            `تداخل زمان کلاس با درس "${existing.courseName}" (روز ${newEval.dayOfWeek} ساعت ${existing.startTime} تا ${existing.endTime})`
          );
        }
      }

      // Exam Conflict
      if (newEval.examDate && existing.examDate) {
        const newDate = newEval.examDate.split(' - ')[0].trim();
        const existingDate = existing.examDate.split(' - ')[0].trim();
        if (newDate === existingDate) {
          if (newEval.examDate === existing.examDate) {
            messages.push(`تداخل دقیق زمان امتحان با درس "${existing.courseName}" (${newEval.examDate})`);
          } else {
            messages.push(`تداخل روز امتحان با درس "${existing.courseName}" (هر دو در تاریخ ${newDate})`);
          }
        }
      }
    });

    // Never invent 8/20/24-unit legal limits from a missing or stale profile.
    // The Express eligibility/selection response remains authoritative.
    const maxUnits = academicLimits?.effectiveMaxUnits;
    const isExtra = newEval.isExtraUnit;

    if (!isExtra && typeof maxUnits === 'number' && Number.isFinite(maxUnits)) {
      const currentUnits = currentSelected.reduce((sum, item) => {
        if (item.isExtraUnit) return sum;
        return sum + (item.units || 0);
      }, 0);

      if (currentUnits + (newEval.units || 0) > maxUnits) {
        messages.push(`افزودن این درس از سقف اعلام‌شده برای این دانشجو (${maxUnits} واحد) بیشتر می‌شود؛ نتیجه نهایی با سرور بررسی خواهد شد.`);
      }
    }

    if (messages.length > 0) {
      setConflictWarning({ offeringId, courseName: newEval.courseName, messages });
    } else {
      confirmToggleScheduleOffering(offeringId);
    }
  };

  const handleClearSchedule = () => setClearConfirmOpen(true);
  const confirmClearSchedule = async () => {
    // A full reset must clear priority/fallback state as well as selected IDs.
    if (await syncPlanToServer([], [], {})) {
      setSelectedOfferingIds([]);
      setCoursePriorities([]);
      setOfferingPriorities({});
      setClearConfirmOpen(false);
      // Recalculate eligibility against the cleared server-side plan.
      void fetchDashboardData();
    }
  };

  if (!user || !user.roles?.includes('student')) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        لطفاً ابتدا به عنوان دانشجو وارد سامانه شوید.
      </div>
    );
  }

  return (
    <div dir="rtl" className="darschin-page darschin-student-workspace space-y-5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:space-y-6 md:pb-0">
      {/* Header Panel */}
      <div className="darschin-surface relative min-w-0 overflow-hidden rounded-[1.35rem] border border-blue-100/80 bg-gradient-to-bl from-white via-blue-50/50 to-indigo-50/40 p-3.5 shadow-[0_16px_50px_-36px_rgba(37,99,235,0.35)] sm:p-6 dark:border-blue-900/30 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30 print:hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        
        <div className="relative flex min-w-0 flex-col items-stretch justify-between gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="mb-1.5 break-words text-[clamp(1.1rem,4vw,1.45rem)] font-bold leading-8 tracking-tight text-slate-950 dark:text-white">
              سلام، {user.name} 👋
            </h2>
            <div className="mb-2 inline-flex max-w-full items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/85 px-2.5 py-1 text-[11px] font-bold leading-5 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>چارت‌های نمونهٔ دمو مصوبهٔ رسمی دانشگاه نیستند.</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              از اینجا درس‌ها، برنامهٔ هفتگی و ترتیب ثبت را سریع مدیریت کن.
            </p>
            {academicLimits && (
              <details className="group mt-3 min-w-0 rounded-xl border border-blue-100 bg-white/65 dark:border-slate-700/70 dark:bg-slate-900/50">
                <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-blue-800 dark:text-blue-200">جزئیات پیشرفت تحصیلی <span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span></summary>
                <div className="grid min-w-0 grid-cols-1 gap-2 border-t border-blue-100 p-3 sm:grid-cols-3 dark:border-slate-700/70">
                <div className="min-w-0 flex flex-col gap-1">
                  <span className="break-words text-[10px] leading-5 text-slate-500 dark:text-slate-400">رشته‌ای اجباری</span>
                  <span className="break-words text-[11px] font-bold leading-5 text-slate-700 dark:text-slate-300">
                    پاس‌شده: {academicLimits.majorRequiredPassed} | باقیمانده: {academicLimits.majorRequiredRemaining}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="break-words text-[10px] leading-5 text-slate-500 dark:text-slate-400">گرایشی اجباری</span>
                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    پاس‌شده: {academicLimits.trackRequiredPassed} | باقیمانده: {academicLimits.trackRequiredRemaining}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="break-words text-[10px] leading-5 text-slate-500 dark:text-slate-400">اختیاری (کل)</span>
                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    پاس‌شده: {academicLimits.electivesPassed}
                  </span>
                </div>
                </div>
              </details>
            )}
          </div>
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 lg:w-auto lg:min-w-[20rem]">
            <button type="button" onClick={() => setProfileModalOpen(true)}
              className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-center text-xs font-extrabold leading-5 text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
              پروندهٔ تحصیلی
            </button>
            <button type="button" onClick={() => setImportModalOpen(true)}
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 px-3 py-2 text-center text-xs font-extrabold leading-5 text-white shadow-lg shadow-blue-600/15 transition hover:from-blue-700 hover:to-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
              <UploadCloud aria-hidden="true" className="h-4 w-4 shrink-0" /> دریافت دروس
            </button>
            <p className="col-span-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">فایل دروس و راهنمای افزونه در پنجرهٔ «دریافت دروس» است.</p>
          </div>
        </div>
      </div>

      {/* Global Conflict Warning Banner */}
      {timeConflicts.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-4 print:hidden">
          <div className="p-2 bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400 rounded-xl shrink-0 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200 mb-1">
              هشدار تداخل زمانی در برنامه انتخابی
            </h3>
            <ul className="text-xs text-rose-700 dark:text-rose-300 space-y-1">
              {timeConflicts.map((conflict, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 dark:bg-rose-600"></span>
                  درس‌های <strong>{conflict.offering1}</strong> و <strong>{conflict.offering2}</strong> در روز <strong>{conflict.day}</strong> دارای تداخل زمانی هستند.
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {prerequisiteConflicts.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
          <div className="p-2 bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400 rounded-xl shrink-0 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200 mb-1">
              هشدار مغایرت پیش‌نیازها در برنامه انتخابی
            </h3>
            <ul className="text-xs text-rose-700 dark:text-rose-300 space-y-1">
              {prerequisiteConflicts.map((conflict, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 dark:bg-rose-600"></span>
                  درس <strong>{conflict.courseName}</strong> نیازمند پاس‌شدن: {conflict.missingPrerequisites.map(p => p.name).join('، ')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Mobile-first student workspace navigation: no 4-tab overflow on phones. */}
      <nav aria-label="بخش‌های میز کار دانشجو" className={`sticky top-[68px] z-30 hidden min-w-0 md:block rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 print:hidden ${isBrowserDemo ? 'md:top-0' : ''}`}>
        <div ref={tabStripRef} className="darschin-scroll-x flex flex-nowrap gap-1.5 pb-1" aria-label="جابجایی سریع بین بخش‌ها">
          {studentTabs.map(tab => {
            const TabIcon = tab.icon;
            const current = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                ref={element => { tabButtonsRef.current[tab.id] = element; }}
                disabled={tab.id === 'demand' && !demandSurveyAvailable}
                title={tab.id === 'demand' && !demandSurveyAvailable ? 'پس از بازکردن نیازسنجی توسط مدیر گروه فعال می‌شود' : undefined}
                onClick={() => setActiveTab(tab.id)}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-11 shrink-0 items-center justify-start gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-right text-xs font-bold leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${current
                  ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200'
                  : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <TabIcon aria-hidden={true} className="h-4 w-4 shrink-0" />
                <span>{tab.short}</span>
                {tab.id === 'demand' && !demandSurveyAvailable && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">بسته</span>}
              </button>
            );
          })}
        </div>
      </nav>

      <div aria-live="polite" className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/80 sm:px-4">
        {planStatus !== 'idle' && <span role="status" className="flex min-w-0 items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
          {planStatus === 'saving' ? <RefreshCw aria-hidden={true} className="h-4 w-4 animate-spin text-blue-600" />
            : planStatus === 'saved' ? <CheckCircle2 aria-hidden={true} className="h-4 w-4 text-emerald-600" />
            : planStatus === 'error' ? <AlertCircle aria-hidden={true} className="h-4 w-4 text-rose-600" />
            : <CheckCircle2 aria-hidden={true} className="h-4 w-4 text-slate-400" />}
          {planStatus === 'saving' ? 'در حال ذخیره تغییرات…'
            : planStatus === 'saved' ? 'تغییرات برنامه ثبت شد.'
            : planStatus === 'error' ? 'برنامه ذخیره نشد.'
            : 'برای ثبت تغییرات از بخش برنامه‌ریز استفاده کنید.'}
        </span>}
        <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">{selectedOfferingIds.length} گروه در برنامهٔ من</span>
      </div>

      {(planError || loadError) && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertCircle aria-hidden={true} className="h-5 w-5 shrink-0" />
          <span className="flex-1">{planError || loadError}</span>
          {loadError && (
            <button type="button" disabled={planStatus === 'saving'} onClick={() => void fetchDashboardData()}
              className="min-h-11 rounded-lg border border-rose-300 px-3 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-700">
              دریافت دوباره اطلاعات
            </button>
          )}
        </div>
      )}

      {/* Tab Content */}
      <section ref={workspaceRef} tabIndex={-1} className="min-h-[240px] min-w-0 scroll-mt-6 focus:outline-none sm:min-h-[400px] md:scroll-mt-36" aria-label={studentTabs.find(tab => tab.id === activeTab)?.label}>
        {loading && activeTab !== 'demand' && activeTab !== 'support' ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-xs font-medium">در حال بارگذاری و تحلیل داده‌ها...</span>
          </div>
        ) : (
          <>
            {activeTab === 'offerings' && (
              <OfferingsList
                evaluations={evaluations}
                selectedOfferingIds={selectedOfferingIds}
                onToggleScheduleOffering={handleToggleScheduleOffering}
                onOpenProfileModal={() => setProfileModalOpen(true)}
              />
            )}
            
            {activeTab === 'recommendations' && (
              <RecommendationsPanel
                recommendations={recommendations}
                evaluations={evaluations}
                selectedOfferingIds={selectedOfferingIds}
                onToggleScheduleOffering={handleToggleScheduleOffering}
                demandCourseIds={demandCourseIds}
                demandSurveyAvailable={demandSurveyAvailable}
                onOpenDemand={() => setActiveTab('demand')}
              />
            )}

            {activeTab === 'schedule' && (
              <SchedulePlanner
                evaluations={evaluations}
                selectedOfferingIds={selectedOfferingIds}
                coursePriorities={coursePriorities}
                offeringPriorities={offeringPriorities}
                onToggleScheduleOffering={handleToggleScheduleOffering}
                onSelectPrimaryOffering={handleSelectPrimaryOffering}
                onAddFallbackOffering={handleAddFallbackOffering}
                onRemoveFallbackOffering={handleRemoveFallbackOffering}
                onReorderCourses={handleReorderCourses}
                onClearSchedule={handleClearSchedule}
                profile={profile}
                currentTerm={currentTerm}
                academicLimits={academicLimits}
              />
            )}

            {activeTab === 'registration' && (
              <RegistrationLaunchpad
                evaluations={evaluations}
                selectedOfferingIds={selectedOfferingIds}
                coursePriorities={coursePriorities}
                profile={profile}
                curriculumId={curriculumId}
                onEditPriorities={() => setActiveTab('schedule')}
                onReorderCourses={handleReorderCourses}
              />
            )}

            {activeTab === 'demand' && demandSurveyAvailable && <DemandWorkspace role="student" />}
            {activeTab === 'passed' && (
              <PassedCoursesManager onPassedCoursesChanged={fetchDashboardData} />
            )}
            {activeTab === 'support' && <StudentHelpCenter />}
          </>
        )}
      </section>

      <StudentMobileDock active={activeTab} demandAvailable={demandSurveyAvailable} onSelect={selectMobileWorkspace} />

      <AcademicProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onProfileUpdated={fetchDashboardData}
      />

            <ImportOfferingsModal
        isOpen={isImportModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={fetchDashboardData}
      />

      {/* Destructive plan reset: keep focus and scroll inside this in-app dialog. */}
      {clearConfirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-4">
          <div ref={clearDialogRef} dir="rtl" role="alertdialog" aria-modal="true"
            aria-labelledby="student-clear-title" aria-describedby="student-clear-desc"
            className="darschin-dialog darschin-page my-auto max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-[1.5rem] border border-rose-200 bg-white p-4 shadow-2xl dark:border-rose-900 dark:bg-slate-900 sm:p-6">
            <h3 id="student-clear-title" className="mb-3 text-lg font-black text-slate-950 dark:text-white">پاک‌کردن برنامهٔ انتخابی؟</h3>
            <p id="student-clear-desc" className="mb-5 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {selectedOfferingIds.length} گروه انتخاب‌شده، ترتیب درس‌ها و گروه‌های جایگزین از برنامه پاک می‌شوند. پاک‌سازی فقط پس از تأیید سرور اعمال می‌شود.
            </p>
            {planStatus === 'error' && planError && (
              <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-6 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{planError}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button ref={clearCancelRef} type="button" disabled={planStatus === 'saving'}
                onClick={() => setClearConfirmOpen(false)}
                className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">
                انصراف
              </button>
              <button type="button" disabled={planStatus === 'saving'}
                onClick={() => void confirmClearSchedule()}
                className="min-h-11 rounded-xl bg-rose-700 px-3 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-50">
                {planStatus === 'saving' ? 'در حال پاک‌سازی…' : 'بله، پاک کن'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Warning Modal */}
      {conflictWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-4">
          <div ref={conflictDialogRef} dir="rtl" role="alertdialog" aria-modal="true" aria-labelledby="student-conflict-dialog-title" aria-describedby="student-conflict-dialog-desc" className="darschin-dialog darschin-page my-auto max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-[1.75rem] border border-amber-200 bg-white p-4 shadow-2xl dark:border-amber-800/40 dark:bg-slate-900 sm:p-6">
            <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <h3 id="student-conflict-dialog-title" className="text-lg font-black sm:text-xl">هشدار تداخل برنامه</h3>
            </div>
            
            <p id="student-conflict-dialog-desc" className="mb-4 break-words text-sm leading-7 text-slate-700 dark:text-slate-300">
              درخواست افزودن درس <strong>{conflictWarning.courseName}</strong> نیازمند بررسی موارد زیر است. تأیید شما قوانین سرور را دور نمی‌زند:
            </p>
            
            <ul className="mb-5 space-y-2">
              {conflictWarning.messages.map((msg, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span className="min-w-0 break-words leading-relaxed">{msg}</span>
                </li>
              ))}
            </ul>
            
            {planStatus === 'error' && planError && (
              <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-6 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{planError}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" ref={conflictCancelRef} disabled={planStatus === 'saving'}
                onClick={() => setConflictWarning(null)}
                className="min-h-11 min-w-0 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                انصراف
              </button>
              <button type="button" disabled={planStatus === 'saving'}
                onClick={() => void confirmToggleScheduleOffering(conflictWarning.offeringId)}
                className="min-h-11 min-w-0 rounded-xl bg-amber-600 px-3 py-2 text-xs font-extrabold leading-6 text-white shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-700 focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50 sm:text-sm"
              >
                درخواست ثبت با بررسی سرور
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
