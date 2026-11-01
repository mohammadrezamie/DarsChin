/**
 * A reproducible, human-shareable bug report from the browser-only demo.
 * Intentionally excludes cookies, tokens, localStorage, URL query params and
 * any student/account data. Nothing is uploaded from this module.
 */
export type DemoBugSeverity = 'low' | 'medium' | 'high';
export type DemoBugArea = 'student' | 'admin' | 'planner' | 'other';

export interface DemoBugReportInput {
  title: string;
  steps: string;
  expected: string;
  actual: string;
  severity: DemoBugSeverity;
  area: DemoBugArea;
  pathname: string;
  recordedAt: string;
}

const severityLabels: Record<DemoBugSeverity, string> = {
  low: 'کم',
  medium: 'متوسط',
  high: 'زیاد',
};
const areaLabels: Record<DemoBugArea, string> = {
  student: 'پنل دانشجو',
  admin: 'پنل مدیر',
  planner: 'برنامه‌ریز',
  other: 'سایر بخش‌های دمو',
};

/** Return pathname only; never include a URL query, fragment or origin. */
export function sanitizeDemoPathname(raw: string): string {
  if (!raw.startsWith('/demo')) return '/demo';
  const withoutQuery = raw.split(/[?#]/, 1)[0];
  return /^\/demo(?:\/[a-z0-9/-]*)?$/i.test(withoutQuery) ? withoutQuery : '/demo';
}

export function validateDemoBugReport(input: Pick<DemoBugReportInput, 'title' | 'steps' | 'expected' | 'actual'>): string | null {
  if (!input.title.trim()) return 'عنوان خطا را وارد کن.';
  if (!input.steps.trim()) return 'مراحل بازتولید خطا را وارد کن.';
  if (!input.expected.trim()) return 'رفتار مورد انتظار را توضیح بده.';
  if (!input.actual.trim()) return 'رفتاری را که دیدی توضیح بده.';
  return null;
}

export function formatDemoBugReport(input: DemoBugReportInput): string {
  const error = validateDemoBugReport(input);
  if (error) throw new Error(error);

  // The user's free text is intentionally left verbatim; no secrets are
  // collected automatically. The preview explicitly asks for anonymization.
  return [
    '# گزارش باگ درس‌چین (دمو)',
    '',
    `**عنوان:** ${input.title.trim()}`,
    `**بخش:** ${areaLabels[input.area]}`,
    `**شدت:** ${severityLabels[input.severity]}`,
    `**مسیر:** \`${sanitizeDemoPathname(input.pathname)}\``,
    `**زمان ثبت (UTC):** ${input.recordedAt}`,
    '**محیط:** دمو در مرورگر؛ بدون اتصال به Backend واقعی',
    '',
    '## مراحل بازتولید',
    input.steps.trim(),
    '',
    '## رفتار مورد انتظار',
    input.expected.trim(),
    '',
    '## رفتار مشاهده‌شده',
    input.actual.trim(),
    '',
    '## نتیجه بازبینی',
    '- [ ] در نسخه دمو بازتولید شد',
    '- [ ] در نسخه واقعیِ دارای API بررسی شد (در صورت مرتبط بودن)',
    '- [ ] اصلاح و تست رگرسیون اضافه شد',
    '',
    '> لطفاً پیش از اشتراک‌گذاری، متن را از نظر اطلاعات شخصی، رمز و توکن بازبینی کنید.',
  ].join('\n');
}
