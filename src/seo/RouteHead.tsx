import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getRouteMeta } from './route-meta';

function updateMeta(selector: string, key: string, value: string, text: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(key, value);
    document.head.appendChild(element);
  }
  element.content = text;
}

/** Keeps SPA navigation accurate without leaking private/demo screens to indexing. */
export function RouteHead(): null {
  const location = useLocation();
  useEffect(() => {
    const route = getRouteMeta(location.pathname);
    document.title = route.title;
    updateMeta('meta[name="description"]', 'name', 'description', route.description);
    updateMeta('meta[name="robots"]', 'name', 'robots',
      route.indexable ? 'index, follow' : 'noindex, nofollow, noarchive');
    updateMeta('meta[property="og:title"]', 'property', 'og:title', route.title);
    updateMeta('meta[property="og:description"]', 'property', 'og:description', route.description);

    // Never synthesize a canonical from the request Host or a Vercel preview.
    const origin = document.head.querySelector<HTMLMetaElement>('meta[name="darschin-public-origin"]')?.content;
    const canonicalUrl = route.indexable && origin && window.location.origin === origin
      ? origin + (location.pathname === '/' ? '/' : location.pathname) : null;
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalUrl) {
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonicalUrl;
      updateMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    } else {
      link?.remove();
      document.head.querySelector('meta[property="og:url"]')?.remove();
    }
  }, [location.pathname]);
  return null;
}
