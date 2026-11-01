import { getRouteMeta, normalizedPublicOrigin } from '../../src/seo/route-meta';

/** Escape data before embedding in HTML attributes or text. No request headers are interpolated. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] ?? char);
}

export function renderSeoDocument(template: string, pathname: string, siteUrl?: string): string {
  const meta = getRouteMeta(pathname);
  const origin = normalizedPublicOrigin(siteUrl);
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const robots = meta.indexable ? 'index, follow' : 'noindex, nofollow, noarchive';
  const canonical = origin && meta.indexable ? origin + (pathname === '/' ? '/' : pathname) : null;
  const tags = [
    `<meta name="robots" content="${robots}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="fa_IR" />`,
    `<meta property="og:site_name" content="درس‌چین" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta name="twitter:card" content="summary" />`,
    ...(origin ? [`<meta name="darschin-public-origin" content="${escapeHtml(origin)}" />`] : []),
    ...(canonical ? [
      `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
      `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
      ...(pathname === '/' ? [`<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'درس‌چین',
        inLanguage: 'fa-IR',
        url: origin,
        description: meta.description,
      }).replace(/</g, '\\u003c')}</script>`] : []),
    ] : []),
  ].join('\n    ');
  // Remove static fallback tags before inserting route-specific ones; duplicate
  // robots/canonical/OG values make crawler behavior unpredictable.
  return template
    .replace(/^\s*<meta name="robots"[^>]*\/?>\s*$/gm, '')
    .replace(/^\s*<meta property="og:[^"]+"[^>]*\/?>\s*$/gm, '')
    .replace(/^\s*<meta name="twitter:card"[^>]*\/?>\s*$/gm, '')
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${description}" />`)
    .replace('</head>', `    ${tags}\n  </head>`);
}

export function publicRobotsText(siteUrl?: string): string {
  const origin = normalizedPublicOrigin(siteUrl);
  const body = 'User-agent: *\nAllow: /\nDisallow: /api/\n';
  return origin ? `${body}\nSitemap: ${origin}/sitemap.xml\n` : body;
}

/** No unverified hostnames and no demo or private URLs in the sitemap. */
export function publicSitemapXml(siteUrl?: string): string | null {
  const origin = normalizedPublicOrigin(siteUrl);
  if (!origin) return null;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...['/', '/guide/', '/help'].map(route => `  <url><loc>${escapeHtml(origin + route)}</loc></url>`),
    '</urlset>',
  ].join('\n');
}
