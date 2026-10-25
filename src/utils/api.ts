// ============================================================================
// DARSCHYN (درس‌چین) - API Client Utilities
// ============================================================================

import { ApiResponse } from '../types';

export const TOKEN_STORAGE_KEY = 'darschyn_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  // The browser-only demo must never transmit requests, tokens or personal data
  // to the real API. Route interception is limited strictly to /demo/* pages.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/demo/')) {
    const { browserDemoRequest } = await import('../demo/mock-api');
    return browserDemoRequest<T>(endpoint, options);
  }

  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type');
    let data: any = {};
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('Non-JSON response for', endpoint, 'status:', response.status, 'body:', text.substring(0, 100));
      return { success: false, error: `خطای سرور: ${response.status}` };
    }
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `خطای سرور (${response.status})`,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: `عدم برقراری ارتباط با سرور سامانه. دلیل: ${err.message}`,
    };
  }
}
