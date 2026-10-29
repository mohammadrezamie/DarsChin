import { getStoredToken } from './api';

export type DirectoryRole = 'all' | 'student' | 'admin' | 'super-admin';

/** Same-origin binary download; raw admin data is never persisted in localStorage. */
export async function downloadUserExcel(role: DirectoryRole): Promise<void> {
  const token = getStoredToken();
  if (!token) throw new Error('برای دریافت فایل، دوباره وارد حساب شوید.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`/api/admin/users/export.xlsx?role=${encodeURIComponent(role)}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('spreadsheetml.sheet')) {
      throw new Error(`خروجی Excel دریافت نشد (کد ${response.status}).`);
    }
    const blob = await response.blob();
    if (controller.signal.aborted) throw new Error('زمان دریافت فایل تمام شد.');
    const uri = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = uri;
    a.download = `darschin-users-${role}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(uri), 2500);
  } finally {
    clearTimeout(timeout);
  }
}
