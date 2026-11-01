import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, API_TIMEOUT_MS, getStoredToken, isInternalApiPath, setStoredToken, TOKEN_STORAGE_KEY } from '../src/utils/api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

describe('same-origin API client security and resiliency', () => {
  it('accepts only normalized internal /api/ paths and rejects absolute/external URLs', () => {
    for (const uri of ['/api/auth/me', '/api/student/plan?term=1405', '/api/demand/surveys/1/report']) {
      expect(isInternalApiPath(uri), uri).toBe(true);
    }
    for (const uri of ['https://evil.example/receive', '//evil.example/api/data', '/api/../../evil',
      '/api/../admin', '/login', 'api/student/profile', '/api\\evil.test', '']) {
      expect(isInternalApiPath(uri), uri).toBe(false);
    }
  });

  it('never fetches or attaches the bearer token to an external URL', async () => {
    const fetchMock = vi.fn();
    const storage = { getItem: vi.fn().mockReturnValue('private-session') };
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', storage);
    const result = await apiRequest('https://evil.example/api/collect');
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it('uses same-origin credentials/no-store and attaches authorization on permitted API calls only', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ success: true, data: { id: 'student' } }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: () => 'safe-token' });
    const result = await apiRequest('/api/student/profile');
    expect(result.success).toBe(true);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/student/profile');
    expect(options.cache).toBe('no-store');
    expect(options.credentials).toBe('same-origin');
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer safe-token');
    expect(new Headers(options.headers).has('Content-Type')).toBe(false);
  });

  it('adds the JSON content type for JSON bodies, without overwriting explicit headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: () => null });
    await apiRequest('/api/student/plan', { method: 'POST', body: '{}'});
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Content-Type')).toBe('application/json');
    await apiRequest('/api/student/plan', { method: 'POST', body: '{}',
      headers: {'Content-Type':'application/vnd.custom+json'} });
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Content-Type')).toBe('application/vnd.custom+json');
  });

  it('never writes HTML or a sensitive server error body to console or UI', async () => {
    const secret = 'SENSITIVE_PRIVATE_BODY_DO_NOT_LOG';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>'+secret+'</html>', {
      status: 502, headers: { 'content-type': 'text/html' },
    })));
    vi.stubGlobal('localStorage', { getItem: () => null });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await apiRequest('/api/auth/me');
      expect(result.success).toBe(false);
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('rejects malformed JSON and structurally invalid envelopes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{', { headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(json([1,2,3]));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect((await apiRequest('/api/auth/me')).success).toBe(false);
    expect((await apiRequest('/api/auth/me')).success).toBe(false);
  });

  it('does not expose raw connection errors containing sensitive details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret https://internal.example/token=private')));
    vi.stubGlobal('localStorage', { getItem: () => null });
    const result = await apiRequest('/api/student/profile');
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain('private');
  });

  it('aborts stalled fetches and returns a recoverable timeout error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', { getItem: () => null });
    let requestedSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => {
      requestedSignal = options.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {once:true});
      });
    }));
    const pending = apiRequest('/api/student/profile');
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);
    const result = await pending;
    expect(requestedSignal?.aborted).toBe(true);
    expect(result.success).toBe(false);
    expect(result.error).toContain('زمان پاسخ');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('honors a caller abort without misreporting it as a timeout', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) =>
      new Promise((_resolve,reject)=>options.signal?.addEventListener('abort',()=>reject(new Error('abort'))))));
    const cancel = new AbortController();
    const pending = apiRequest('/api/student/profile', {signal:cancel.signal});
    cancel.abort();
    const result = await pending;
    expect(result.success).toBe(false);
    expect(result.error).toContain('لغو');
  });

  it('does not crash when browsers block storage access', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    });
    expect(getStoredToken()).toBeNull();
    expect(() => setStoredToken('token')).not.toThrow();
    expect(() => setStoredToken(null)).not.toThrow();
    expect(TOKEN_STORAGE_KEY).toBe('darschyn_auth_token');
  });
});
