// ============================================================================
// DARSCHYN (درس‌چین) - Same-origin, timeout-bound API Client Utilities
// ============================================================================

import type { ApiResponse } from '../types';

export const TOKEN_STORAGE_KEY = 'darschyn_auth_token';
export const API_TIMEOUT_MS = 20_000;

export function getStoredToken(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    // Safari/private mode or blocked storage must not crash the entire app.
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // The auth service will still make the authorization decision server-side.
  }
}

/** Never attach bearer credentials to URLs supplied by another origin or route. */
export function isInternalApiPath(endpoint: string): boolean {
  if (typeof endpoint !== 'string' || !endpoint.startsWith('/api/') || endpoint.includes('\\')) return false;
  try {
    // URL normalization rejects path traversal outside the API prefix.
    const parsed = new URL(endpoint, 'https://darschin.internal.invalid');
    return parsed.origin === 'https://darschin.internal.invalid' &&
      parsed.pathname.startsWith('/api/') && parsed.username === '' && parsed.password === '';
  } catch {
    return false;
  }
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  if (!isInternalApiPath(endpoint)) {
    return { success: false, error: 'آدرس درخواست نامعتبر است.' };
  }

  // Browser demo never sends credentials or user records to the real API.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/demo/')) {
    const { browserDemoRequest } = await import('../demo/mock-api');
    return browserDemoRequest<T>(endpoint, options);
  }

  const controller = new AbortController();
  const externalSignal = options.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body != null && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    const token = getStoredToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    // No browser-side cache of user profiles, permission data or course history.
    const response = await fetch(endpoint, {
      ...options,
      cache: 'no-store',
      credentials: 'same-origin',
      headers,
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Never print HTML/body content: it can contain private data or secrets.
      return { success: false, error: `پاسخ نامعتبر از سرور (${response.status}).` };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { success: false, error: 'پاسخ سرور قابل خواندن نیست.' };
    }
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return { success: false, error: 'ساختار پاسخ سرور نامعتبر است.' };
    }

    const data = payload as Record<string, unknown>;
    if (!response.ok) {
      return {
        success: false,
        error: typeof data.error === 'string' && data.error ? data.error : `خطای سرور (${response.status})`,
      };
    }
    // Preserve the established server response envelope for existing call sites.
    return payload as ApiResponse<T>;
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        success: false,
        error: externalSignal?.aborted
          ? 'درخواست لغو شد.'
          : 'زمان پاسخ‌گویی سرور تمام شد؛ دوباره تلاش کنید.',
      };
    }
    // Avoid sending the raw Error.message/URL to the UI: network failures may
    // include addresses, tokens and other sensitive connection details.
    return { success: false, error: 'ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.' };
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
