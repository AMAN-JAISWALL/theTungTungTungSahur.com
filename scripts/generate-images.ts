/**
 * Renders the favicon, app icons and Open Graph images into public/.
 * The PNGs are committed, so builds never depend on the fonts installed on
 * the build machine.
 *
 *   npm run images
 *
 * Text falls back to system fonts. For on-brand text, point OG_FONT_DIR at a
 * folder with Geist and Geist Mono .ttf files:
 *
 *   OG_FONT_DIR=/path/to/geist npm run images
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GOLDEN_VARS,
  LOGO_MARKUP,
  makeStars,
  MOON_PATH,
  resolveVars,
  SAHUR_VIEWBOX,
  sahurMarkup,
  skylineMarkup,
  type Mood,
} from '../src/lib/art.ts';

const root = new URL('../public/', import.meta.url);

if (process.env.OG_FONT_DIR) {
  // sharp's bundled fontconfig reads this before its first text render.
  const conf = join(tmpdir(), 'ttts-fonts.conf');
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  await writeFile(
    conf,
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig>` +
      `<dir>${escape(process.env.OG_FONT_DIR)}</dir><dir>WINDOWSFONTDIR</dir><dir>/usr/share/fonts</dir>` +
      `<dir>/System/Library/Fonts</dir><cachedir>${escape(join(tmpdir(), 'ttts-fontcache'))}</cachedir></fontconfig>`,
  );
  process.env.FONTCONFIG_FILE = conf;
}
const { default: sharp } = await import('sharp');

const SANS = "Geist, 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Geist Mono', Consolas, Menlo, monospace";

const character = (x: number, y: number, width: number, mood: Mood, golden = false) => {
  const scale = width / SAHUR_VIEWBOX.w;
  let body = resolveVars(sahurMarkup(mood));
  if (golden) {
    body = sahurMarkup(mood).replace(/var\((--[\w-]+), (#[0-9a-f]+)\)/gi, (_m, name: string, fallback: string) => {
      return GOLDEN_VARS[name] ?? fallback;
    });
  }
  return `<g transform="translate(${x} ${y}) scale(${scale.toFixed(4)})">${body}</g>`;
};

function nightBackdrop(id: string, w: number, h: number): string {
  const stars = makeStars(90, 11)
    .map((s) => `<circle cx="${((s.x / 100) * w).toFixed(1)}" cy="${((s.y / 100) * h * 0.8).toFixed(1)}" r="${(s.size * 0.7).toFixed(2)}" fill="#fff" opacity="${s.opacity}"/>`)
    .join('');
  return `
  <defs>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#03040b"/>
      <stop offset=".5" stop-color="#070a1e"/>
      <stop offset=".85" stop-color="#120f30"/>
      <stop offset="1" stop-color="#1d1644"/>
    </linearGradient>
    <filter id="${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter>
    <filter id="${id}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${id}-sky)"/>
  <g filter="url(#${id}-blur)" opacity=".55">
    <circle cx="${w * 0.2}" cy="${h * 1.02}" r="170" fill="#007cf0"/>
    <circle cx="${w * 0.52}" cy="${h * 1.05}" r="200" fill="#7928ca"/>
    <circle cx="${w * 0.86}" cy="${h * 1.02}" r="150" fill="#ff4d4d" opacity=".6"/>
  </g>
  ${stars}
  <g transform="translate(${w - 104} 96) scale(1.15)">
    <circle r="52" fill="#f4ead2" opacity=".12" filter="url(#${id}-soft)"/>
    <path d="${MOON_PATH}" fill="#f4ead2"/>
  </g>
  <svg x="0" y="${h - 190}" width="${w}" height="190" viewBox="0 0 1600 300" preserveAspectRatio="xMidYMax slice">${resolveVars(skylineMarkup(id))}</svg>`;
}

interface OgSpec {
  /** Prefix for the gradient and filter ids inside this one file. */
  id: string;
  eyebrow: string;
  /** Headline, pre-wrapped. Keep each line under ~19 characters so it clears the artwork. */
  lines: string[];
  size?: number;
  /** Second-tier line under the headline. */
  sub?: string;
  cta: string;
  mood?: Mood;
}

/** The shared text-left / character-right Open Graph card. */
function ogCard({ id, eyebrow, lines, size = 76, sub, cta, mood = 'idle' }: OgSpec): string {
  const w = 1200;
  const h = 630;
  const step = Math.round(size * 1.08);
  // Centre the headline block on y≈300, leaving room for the eyebrow above and the CTA below.
  const first = Math.round(300 - ((lines.length - 1) * step) / 2);
  const last = first + (lines.length - 1) * step;
  const headline = lines
    .map((line, i) => `<tspan x="68" y="${first + i * step}" font-size="${size}">${line}</tspan>`)
    .join('');
  // sharp renders <text> without auto-width, so the pill is sized from the label.
  const ctaWidth = Math.round(cta.length * 12.6 + 60);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${nightBackdrop(id, w, h)}
  <rect width="${w}" height="${h}" fill="#03040a" opacity=".25"/>
  <circle cx="930" cy="330" r="220" fill="#ffb547" opacity=".16" filter="url(#${id}-blur)"/>
  ${character(815, 118, 230, mood)}
  <text x="72" y="118" font-family="${MONO}" font-size="21" font-weight="500" fill="#8a8d9b" letter-spacing="1.5">${eyebrow}</text>
  <text font-family="${SANS}" font-weight="600" fill="#ededf2" letter-spacing="-3.4">${headline}</text>
  ${sub ? `<text x="70" y="${last + 56}" font-family="${SANS}" font-size="30" fill="#a3a6b4">${sub}</text>` : ''}
  <rect x="72" y="${last + (sub ? 92 : 52)}" width="${ctaWidth}" height="58" rx="29" fill="#ededf2"/>
  <text x="${72 + ctaWidth / 2}" y="${last + (sub ? 131 : 91)}" text-anchor="middle" font-family="${SANS}" font-size="23" font-weight="600" fill="#07080f">${cta}</text>
  <text x="72" y="592" font-family="${MONO}" font-size="20" font-weight="500" fill="#ededf2" opacity=".85">thetungtungtungsahur.com</text>
</svg>`;
}

function ogFind(): string {
  const w = 1200;
  const h = 630;
  const lantern = { x: 810, y: 330 };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${nightBackdrop('find', w, h)}
  <defs>
    <radialGradient id="find-hole" cx="${lantern.x}" cy="${lantern.y}" r="330" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#02030a" stop-opacity="0"/>
      <stop offset=".42" stop-color="#02030a" stop-opacity=".12"/>
      <stop offset="1" stop-color="#02030a" stop-opacity=".88"/>
    </radialGradient>
    <radialGradient id="find-warm" cx="${lantern.x}" cy="${lantern.y}" r="260" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffb547" stop-opacity=".32"/>
      <stop offset="1" stop-color="#ffb547" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="find-eye">
      <stop offset="0" stop-color="#fff6cf"/>
      <stop offset=".45" stop-color="#ffd666" stop-opacity=".9"/>
      <stop offset="1" stop-color="#ffb547" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${character(718, 200, 210, 'shout')}
  <rect width="${w}" height="${h}" fill="url(#find-hole)"/>
  <rect width="${w}" height="${h}" fill="url(#find-warm)"/>
  <g>
    <ellipse cx="1060" cy="392" rx="30" ry="22" fill="url(#find-eye)"/>
    <ellipse cx="1106" cy="392" rx="30" ry="22" fill="url(#find-eye)"/>
    <ellipse cx="1060" cy="392" rx="9" ry="6.5" fill="#fff6cf"/>
    <ellipse cx="1106" cy="392" rx="9" ry="6.5" fill="#fff6cf"/>
  </g>
  <text font-family="${MONO}" font-weight="500" fill="#ffb547">
    <tspan x="600" y="190" font-size="26" opacity=".55">tung</tspan>
    <tspan x="1004" y="236" font-size="30" opacity=".8">TUNG</tspan>
    <tspan x="640" y="520" font-size="34">TUNG!</tspan>
  </text>
  <text x="72" y="118" font-family="${MONO}" font-size="21" font-weight="500" fill="#8a8d9b" letter-spacing="1.5">FREE SOUND GAME · PHONE &amp; DESKTOP</text>
  <text font-family="${SANS}" font-weight="600" fill="#ededf2" letter-spacing="-4">
    <tspan x="68" y="226" font-size="84">Find Tung</tspan>
    <tspan x="68" y="312" font-size="84">Tung Tung</tspan>
    <tspan x="68" y="398" font-size="84">Sahur</tspan>
  </text>
  <text x="72" y="462" font-family="${SANS}" font-size="28" fill="#a3a6b4">Follow the tung. Catch him before dawn.</text>
  <rect x="72" y="498" width="208" height="56" rx="28" fill="#ededf2"/>
  <text x="176" y="534" text-anchor="middle" font-family="${SANS}" font-size="22" font-weight="600" fill="#07080f">Play Now →</text>
  <text x="72" y="600" font-family="${MONO}" font-size="19" font-weight="500" fill="#ededf2" opacity=".85">thetungtungtungsahur.com</text>
</svg>`;
}

/** Full-bleed square icon; the OS applies its own mask or corner radius. */
function appIcon(size: number, zoom: number): string {
  const art = LOGO_MARKUP.replace(/<rect[^>]*><\/rect>/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#161a33"/>
  <g transform="translate(32 32) scale(${zoom}) translate(-32 -32)">${art}</g>
</svg>`;
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${LOGO_MARKUP}\n</svg>\n`;

async function png(svg: string, path: string) {
  const file = fileURLToPath(new URL(path, root));
  await mkdir(dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
  console.log(`wrote public/${path}`);
}

await writeFile(new URL('favicon.svg', root), favicon);
console.log('wrote public/favicon.svg');
await png(appIcon(180, 0.86), 'apple-touch-icon.png');
await png(appIcon(192, 0.72), 'icon-192.png');
await png(appIcon(512, 0.72), 'icon-512.png');
await png(
  ogCard({
    id: 'hub',
    eyebrow: 'GAME HUB · FREE · NO DOWNLOAD',
    lines: ['Tung Tung Tung', 'Sahur Games'],
    sub: 'Free browser games, after dark.',
    cta: 'Play Free →',
  }),
  'og/default.png',
);
await png(ogFind(), 'og/find-tung-tung-tung-sahur.png');
await png(
  ogCard({
    id: 'games',
    eyebrow: 'EVERY GAME ON THE HUB',
    lines: ['All Tung Tung', 'Tung Sahur Games'],
    size: 72,
    sub: 'Free, in your browser, on any screen.',
    cta: 'Browse Games →',
  }),
  'og/games.png',
);
await png(
  ogCard({
    id: 'lore',
    eyebrow: 'MEANING · ORIGIN · LORE',
    lines: ['Who Is Tung', 'Tung Tung Sahur?'],
    size: 72,
    sub: 'The drum, the meme and the three knocks.',
    cta: 'Read the Story →',
    mood: 'shout',
  }),
  'og/tung-tung-tung-sahur.png',
);
await png(
  ogCard({
    id: 'about',
    eyebrow: 'ABOUT THIS SITE',
    lines: ['A Tiny Game Hub', 'for a Very Loud Log'],
    size: 66,
    sub: 'Independent, fan-made and ad-free.',
    cta: 'About →',
  }),
  'og/about.png',
);
