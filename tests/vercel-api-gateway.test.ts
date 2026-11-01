import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxyApiRequest } from '../api/[...path]';

const req = (route: string, init?: RequestInit) => new Request('https://preview.example' + route, init);

describe('Vercel API gateway', () => {
  afterEach(() => { vi.restoreAllMocks(); delete process.env.DARSCHIN_API_ORIGIN; });

  it('fails closed with JSON 503 when the backend is not configured', async () => {
    const remote = vi.fn<typeof fetch>();
    delete process.env.DARSCHIN_API_ORIGIN;
    const result = await proxyApiRequest(req('/api/health'), undefined, remote);
    // Defaults read from the environment; this test is deliberately independent of runner secrets.
    expect(result.status).toBe(503);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect((await result.json()).code).toBe('API_BACKEND_NOT_CONFIGURED');
    expect(remote).not.toHaveBeenCalled();
  });

  it('preserves method, authorization, JSON payload, path and query without forwarding browser cookies', async () => {
    const remote = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ success: true, data: { id: 'synthetic-job' } }, { status: 201 }),
    );
    const input = req('/api/sync/jobs?term=1405', {
      method: 'POST',
      headers: {
        authorization: 'Bearer dummy-test-token',
        'content-type': 'application/json',
        cookie: 'vercel_protection=do-not-forward',
      },
      body: JSON.stringify({ campusId: 'campus-demo' }),
    });

    const response = await proxyApiRequest(input, 'https://backend.example', remote);
    expect(response.status).toBe(201);
    expect((await response.json()).success).toBe(true);
    expect(remote).toHaveBeenCalledOnce();

    const [target, options] = remote.mock.calls[0];
    expect(String(target)).toBe('https://backend.example/api/sync/jobs?term=1405');
    expect(options?.method).toBe('POST');
    expect(new Headers(options?.headers).get('authorization')).toBe('Bearer dummy-test-token');
    expect(new Headers(options?.headers).get('cookie')).toBeNull();
    expect(options?.redirect).toBe('manual');
    expect(await new Response(options?.body).text()).toBe('{"campusId":"campus-demo"}');
  });

  it('preserves application errors and does not cache authenticated replies', async () => {
    const remote = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ success: false, error: 'unauthorized' }, { status: 401 }),
    );
    const result = await proxyApiRequest(req('/api/auth/me'), 'https://backend.example', remote);
    expect(result.status).toBe(401);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect((await result.json()).error).toBe('unauthorized');
  });

  it('refuses insecure public upstreams and upstream redirects', async () => {
    const remote = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'https://different.example/' } }),
    );
    const invalid = await proxyApiRequest(req('/api/health'), 'http://backend.example', remote);
    expect(invalid.status).toBe(503);
    expect(remote).not.toHaveBeenCalled();

    const redirected = await proxyApiRequest(req('/api/health'), 'https://backend.example', remote);
    expect(redirected.status).toBe(502);
    expect((await redirected.json()).code).toBe('API_UNSAFE_REDIRECT');
  });

  it('returns JSON 502 without leaking upstream internal errors', async () => {
    const remote = vi.fn<typeof fetch>().mockRejectedValue(new Error('Private hostname and port'));
    const result = await proxyApiRequest(req('/api/health'), 'https://backend.example', remote);
    expect(result.status).toBe(502);
    expect(JSON.stringify(await result.json())).not.toContain('Private hostname');
  });
});
