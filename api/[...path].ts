/**
 * Same-origin API gateway for Vercel previews.
 * This is a transport adapter, NOT a database or an Express replacement.
 * Configure DARSCHIN_API_ORIGIN with the HTTPS origin of the separately hosted API.
 */
const ALLOWED_REQUEST_HEADERS = [
  'authorization',
  'accept',
  'accept-language',
  'content-type',
  'if-match',
  'if-none-match',
];

function apiJson(status: number, error: string, code: string): Response {
  return Response.json(
    { success: false, error, code },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

function validBackendOrigin(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const localDevelopment = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (
      !(url.protocol === 'https:' || (localDevelopment && url.protocol === 'http:')) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) return null;
    return url;
  } catch {
    return null;
  }
}

/** Exported separately so regression tests can inject an isolated fake upstream. */
export async function proxyApiRequest(
  request: Request,
  backendOrigin = process.env.DARSCHIN_API_ORIGIN,
  upstreamFetch: typeof fetch = fetch,
): Promise<Response> {
  const origin = validBackendOrigin(backendOrigin);
  if (!origin) {
    return apiJson(
      503,
      'سرویس API محیط آزمایشی هنوز متصل نشده است. لطفاً بعداً دوباره امتحان کنید.',
      'API_BACKEND_NOT_CONFIGURED',
    );
  }

  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith('/api/')) {
    return apiJson(404, 'مسیر API پیدا نشد.', 'API_ROUTE_NOT_FOUND');
  }

  const destination = new URL(incoming.pathname + incoming.search, origin);
  const headers = new Headers();
  for (const key of ALLOWED_REQUEST_HEADERS) {
    const value = request.headers.get(key);
    if (value !== null) headers.set(key, value);
  }

  const mayContainBody = request.method !== 'GET' && request.method !== 'HEAD';
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    body: mayContainBody ? request.body : undefined,
    redirect: 'manual', // A redirect to an unrelated origin must not carry an auth token.
    cache: 'no-store',
  };
  if (mayContainBody && request.body) init.duplex = 'half';

  try {
    const upstream = await upstreamFetch(destination, init);
    if (upstream.status >= 300 && upstream.status < 400) {
      return apiJson(502, 'پاسخ تغییر مسیر غیرمنتظره از سرویس API دریافت شد.', 'API_UNSAFE_REDIRECT');
    }
    const responseHeaders = new Headers({ 'cache-control': 'no-store' });
    for (const key of ['content-type', 'content-disposition']) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return apiJson(502, 'ارتباط با سرویس API برقرار نشد.', 'API_UPSTREAM_UNAVAILABLE');
  }
}

export default {
  fetch(request: Request) {
    return proxyApiRequest(request);
  },
};
