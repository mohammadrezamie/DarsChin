/** Public-first route metadata; never expose a student's account pages to search. */
export type RouteMeta = { title: string; description: string; indexable: boolean };

export const SITE_TITLE = 'درس‌چین | برنامه‌ریزی انتخاب واحد و بررسی تداخل';
export const SITE_DESCRIPTION =
  'درس‌چین دستیار برنامه‌ریزی انتخاب واحد است: بررسی پیش‌نیازها، چیدمان هفتگی، مدیریت اولویت درس‌ها و تجربهٔ رایگان دمو با داده‌های آزمایشی.';

const ROUTES: Record<string, RouteMeta> = {
  '/': { title: SITE_TITLE, description: SITE_DESCRIPTION, indexable: true },
  '/help': { title: 'راهنمای استفاده و سوالات متداول درس‌چین | آموزش دانشجو و مدیر',
    description: 'راهنمای گام‌به‌گام کار با درس‌چین: دروس ارائه‌شده، تداخل‌سنج، صف ثبت، نیازسنجی، مدیریت چارت‌ها و پاسخ به سوالات متداول.',
    indexable: true },
  '/demo': {
    title: 'دموی انتخاب واحد | درس‌چین',
    description: 'نسخهٔ آزمایشی برنامه‌ریز انتخاب واحد با داده‌های ساختگی، بدون ورود به حساب واقعی دانشگاه.',
    indexable: false,
  },
  '/demo/student': {
    title: 'پنل آزمایشی دانشجو | درس‌چین',
    description: 'محیط آزمایشی دانشجو برای بررسی درس‌ها و برنامهٔ هفتگی، بدون اطلاعات واقعی.',
    indexable: false,
  },
  '/demo/admin': {
    title: 'پنل آزمایشی مدیریت | درس‌چین',
    description: 'محیط آزمایشی مدیریت درس‌چین با داده‌های نمونه.',
    indexable: false,
  },
  '/login': { title: 'ورود به حساب | درس‌چین', description: 'ورود امن به حساب درس‌چین.', indexable: false },
  '/register': { title: 'ثبت‌نام | درس‌چین', description: 'ایجاد حساب کاربری درس‌چین.', indexable: false },
  '/forgot-password': { title: 'بازیابی رمز | درس‌چین', description: 'بازیابی دسترسی به حساب درس‌چین.', indexable: false },
  '/dashboard': { title: 'میز کار دانشجو | درس‌چین', description: 'فضای خصوصی دانشجو.', indexable: false },
  '/admin': { title: 'مدیریت | درس‌چین', description: 'فضای خصوصی مدیریت درس‌چین.', indexable: false },
};

/** Public homepage and learning center are indexable. /guide/ is separate crawlable HTML. */
export function getRouteMeta(pathname: string): RouteMeta {
  return ROUTES[pathname] ?? {
    title: 'صفحه یافت نشد | درس‌چین',
    description: 'این مسیر در درس‌چین وجود ندارد.',
    indexable: false,
  };
}

/** Set only on a real public origin: never canonicalize previews or ingest request Host/XFF. */
export function normalizedPublicOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password ||
        url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) return null;
    return url.origin;
  } catch {
    return null;
  }
}
