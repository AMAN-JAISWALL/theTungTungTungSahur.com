// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// The sitemap is a route, not an integration: see src/pages/sitemap.xml.ts (metadata in src/site.ts).

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
});
