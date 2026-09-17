// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

/** Crawl priority by pathname; anything unlisted falls back to 0.4. @type {Record<string, number>} */
const SITEMAP_PRIORITY = {
  '/': 1.0,
  '/games/find-tung-tung-tung-sahur': 0.9,
  '/tung-tung-tung-sahur': 0.8,
  '/faq': 0.8,
  '/games': 0.7,
  '/about': 0.5,
  '/contact': 0.5,
  '/privacy': 0.3,
  '/terms': 0.3,
};

// https://astro.build/config
export default defineConfig({
  site: 'https://thetungtungtungsahur.com',
  // `file` output (about.html) pairs with `never`, so hosts serve /about without a trailing slash.
  trailingSlash: 'never',
  build: {
    format: 'file',
  },

  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Geist',
      cssVariable: '--font-geist',
      weights: [400, 500, 600],
      styles: ['normal'],
      fallbacks: ['Arial', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Geist Mono',
      cssVariable: '--font-geist-mono',
      weights: [400, 500],
      styles: ['normal'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    sitemap({
      // Error pages are served in place of a URL, never crawled to.
      filter: (page) => !/\/(?:404|500)$/.test(new URL(page).pathname),
      changefreq: 'weekly',
      lastmod: new Date(),
      serialize(item) {
        item.priority = SITEMAP_PRIORITY[new URL(item.url).pathname] ?? 0.4;
        return item;
      },
    }),
  ],
});
