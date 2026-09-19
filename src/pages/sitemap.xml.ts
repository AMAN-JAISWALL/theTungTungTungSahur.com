import type { APIRoute } from 'astro';
import { ROUTE_META, SITE, SITEMAP_EXCLUDED, SITEMAP_FALLBACK_PRIORITY } from '../site';

/**
 * Every page is a hand-written .astro file, so globbing the routes directory is the whole of route
 * discovery. Lazy glob: we only ever read the keys, so the page modules are never imported.
 */
const PAGE_FILES = import.meta.glob('./**/*.astro');

const CHANGEFREQ = 'weekly';

/** './games/index.astro' -> '/games'. Matches trailingSlash: 'never'. */
function toRoute(file: string): string {
  const path = file.replace(/^\.\//, '').replace(/\.astro$/, '');
  return `/${path.replace(/(?:^|\/)index$/, '')}`.replace(/\/$/, '') || '/';
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": 'apos' }[c]};`);
}

function toUrlEntry(route: string): string {
  const meta = ROUTE_META[route];
  const loc = escapeXml(new URL(route, SITE.url).href);
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    ...(meta ? [`    <lastmod>${meta.lastmod}</lastmod>`] : []),
    `    <changefreq>${CHANGEFREQ}</changefreq>`,
    `    <priority>${(meta?.priority ?? SITEMAP_FALLBACK_PRIORITY).toFixed(1)}</priority>`,
    '  </url>',
  ].join('\n');
}

export const GET: APIRoute = () => {
  const routes = Object.keys(PAGE_FILES)
    .map(toRoute)
    .filter((route) => !SITEMAP_EXCLUDED.includes(route))
    // Most important first, then alphabetically, so the file stays stable between builds.
    .sort((a, b) => {
      const byPriority =
        (ROUTE_META[b]?.priority ?? SITEMAP_FALLBACK_PRIORITY) -
        (ROUTE_META[a]?.priority ?? SITEMAP_FALLBACK_PRIORITY);
      return byPriority || a.localeCompare(b);
    });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...routes.map(toUrlEntry),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
