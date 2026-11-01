/** پیش‌نمایش موقت؛ پیش‌فرض فعلاً روشن و برای Pages همواره فعال می‌ماند. */
export const publicDemoEnabled =
  import.meta.env.VITE_STATIC_PREVIEW === 'true' ||
  import.meta.env.VITE_PUBLIC_DEMO !== 'false';
