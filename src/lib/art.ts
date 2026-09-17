/**
 * Shared SVG artwork as markup strings, so the same drawings can be used by
 * Astro components and by `scripts/generate-images.ts` (OG images, icons).
 * Every color is a CSS variable with a fallback, which lets skins recolor the
 * character in the browser; `resolveVars()` bakes the fallbacks for sharp.
 */

import { mulberry32 } from './random.ts';

export const SAHUR_VIEWBOX = { w: 210, h: 260 } as const;
/** Point in viewBox units that sits on the hiding spot (between the eyes). */
export const SAHUR_ANCHOR = { x: 100, y: 112 } as const;

export type Mood = 'idle' | 'shout';

const line = 'var(--tts-line, #2b1a0e)';
const wood = 'var(--tts-wood, #b97a44)';
const grain = 'var(--tts-grain, #8a5328)';
const dark = 'var(--tts-dark, #5e3718)';
const top = 'var(--tts-top, #e8b87f)';
const ring = 'var(--tts-ring, #c38a51)';
const bat = 'var(--tts-bat, #dcab72)';
const grip = 'var(--tts-grip, #5a3419)';

const stick = (d: string) =>
  `<path d="${d}" fill="none" stroke="${line}" stroke-width="11" stroke-linecap="round"/>` +
  `<path d="${d}" fill="none" stroke="${grain}" stroke-width="5" stroke-linecap="round"/>`;

const mouths: Record<Mood, string> = {
  idle: `<path d="M78 140 Q100 156 122 140" fill="none" stroke="${line}" stroke-width="5" stroke-linecap="round"/>`,
  shout:
    `<path d="M76 134 Q100 128 124 134 Q121 172 100 174 Q79 172 76 134 Z" fill="#2a1209" stroke="${line}" stroke-width="3.5" stroke-linejoin="round"/>` +
    `<path d="M81 135 Q100 131 119 135 L118 142 Q100 139 82 142 Z" fill="#fff"/>` +
    `<path d="M87 162 Q100 151 113 162 Q108 171 100 171 Q92 171 87 162 Z" fill="#e25c6e"/>`,
};

/**
 * Tung Tung Tung Sahur: a wooden log with stick limbs and a bat.
 * Pass `mood: 'both'` to render both mouths; CSS then picks one via
 * `[data-mood]` on the parent <svg>.
 */
export function sahurMarkup(mood: Mood | 'both' = 'both'): string {
  const mouth =
    mood === 'both'
      ? `<g class="tts-idle">${mouths.idle}</g><g class="tts-shout">${mouths.shout}</g>`
      : mouths[mood];

  return `
<g stroke="${line}" stroke-width="3.5" stroke-linejoin="round">
  <rect x="72" y="210" width="13" height="34" rx="5" fill="${grain}"/>
  <rect x="115" y="210" width="13" height="34" rx="5" fill="${grain}"/>
  <path d="M62 250 Q62 241 73 241 H83 Q92 241 92 250 Z" fill="${dark}"/>
  <path d="M108 250 Q108 241 117 241 H127 Q138 241 138 250 Z" fill="${dark}"/>
</g>
${stick('M60 130 C40 138 30 156 34 178')}
<circle cx="34" cy="181" r="7" fill="${grain}" stroke="${line}" stroke-width="3.5"/>
${stick('M140 132 C158 130 170 118 176 104')}
<g transform="translate(173 118) rotate(12)">
  <path d="M-4 4 L-4 -36 C-4 -56 -11 -72 -11 -100 A11 11 0 0 1 11 -100 C11 -72 4 -56 4 -36 L4 4 Z" fill="${bat}" stroke="${line}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M-4 -30 H4 V-4 H-4 Z" fill="${grip}"/>
  <ellipse cx="0" cy="6" rx="8" ry="4.5" fill="${grip}" stroke="${line}" stroke-width="3"/>
  <path d="M-5.5 -98 C-5.5 -80 -2.2 -64 -1.5 -48" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2.5" stroke-linecap="round"/>
</g>
<circle cx="176" cy="101" r="8" fill="${grain}" stroke="${line}" stroke-width="3.5"/>
<path d="M52 44 C49 100 49 160 52 214 A48 14 0 0 0 148 214 C151 160 151 100 148 44 Z" fill="${wood}" stroke="${line}" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M126 46 C133 100 133 170 128 225.4 A48 14 0 0 0 148 214 C151 160 151 100 148 44 Z" fill="#000" fill-opacity=".2"/>
<path d="M62 62 C60 100 60 160 62 204" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="7" stroke-linecap="round"/>
<g fill="none" stroke="${grain}" stroke-width="2.5" stroke-linecap="round">
  <path d="M70 64 C67 82 72 98 68 116"/>
  <path d="M134 140 C137 160 132 176 136 196"/>
  <path d="M94 192 C92 204 95 212 93 222"/>
  <path d="M124 60 C126 70 123 78 125 86"/>
</g>
<ellipse cx="72" cy="176" rx="7" ry="4.5" fill="${grain}"/>
<ellipse cx="72" cy="176" rx="3" ry="1.8" fill="${dark}"/>
<ellipse cx="100" cy="44" rx="48" ry="14" fill="${top}" stroke="${line}" stroke-width="3.5"/>
<g fill="none" stroke="${ring}" stroke-width="2">
  <ellipse cx="100" cy="44" rx="34" ry="9.5"/>
  <ellipse cx="100" cy="44" rx="21" ry="5.8"/>
  <ellipse cx="100" cy="44" rx="8" ry="2.2"/>
  <path d="M104 43 L121 37" stroke-linecap="round"/>
</g>
<g stroke="${line}" stroke-width="7" stroke-linecap="round">
  <path d="M62 80 L93 89"/>
  <path d="M138 80 L107 89"/>
</g>
<g stroke="${line}" stroke-width="3" fill="#fff">
  <circle cx="80" cy="104" r="14"/>
  <circle cx="120" cy="104" r="14"/>
</g>
<g fill="#15100c">
  <circle cx="83" cy="106" r="4.6"/>
  <circle cx="117" cy="106" r="4.6"/>
</g>
<g fill="#fff">
  <circle cx="84.6" cy="104.4" r="1.4"/>
  <circle cx="118.6" cy="104.4" r="1.4"/>
</g>
<path d="M96 122 Q100 127 104 122" fill="none" stroke="${line}" stroke-width="3" stroke-linecap="round"/>
${mouth}`;
}

/** Brand mark, drawn on a 64 × 64 grid. */
export const LOGO_MARKUP = `
<rect width="64" height="64" rx="15" fill="#161a33"></rect>
<path d="M50.5 9.5a8 8 0 1 0 5.2 12.4 6.5 6.5 0 1 1-5.2-12.4Z" fill="#f4ead2"></path>
<path d="M18 18c-.7 8-.7 23 0 33a14 4 0 0 0 28 0c.7-10 .7-25 0-33Z" fill="#b97a44" stroke="#2b1a0e" stroke-width="2"></path>
<ellipse cx="32" cy="18" rx="14" ry="4.5" fill="#e8b87f" stroke="#2b1a0e" stroke-width="2"></ellipse>
<ellipse cx="32" cy="18" rx="7" ry="2" fill="none" stroke="#c38a51" stroke-width="1.2"></ellipse>
<path d="M21 27.5l7 2M43 27.5l-7 2" stroke="#2b1a0e" stroke-width="2.6" stroke-linecap="round"></path>
<circle cx="26.5" cy="34" r="4.3" fill="#fff" stroke="#2b1a0e" stroke-width="1.2"></circle>
<circle cx="37.5" cy="34" r="4.3" fill="#fff" stroke="#2b1a0e" stroke-width="1.2"></circle>
<circle cx="27.4" cy="34.6" r="1.7" fill="#15100c"></circle>
<circle cx="36.6" cy="34.6" r="1.7" fill="#15100c"></circle>
<path d="M26.5 43.5q5.5 4 11 0" fill="none" stroke="#2b1a0e" stroke-width="2.2" stroke-linecap="round"></path>`;

/** Crescent moon centered on 0,0 with an outer radius of 40. */
export const MOON_PATH = 'M36.32 16.76 A40 40 0 1 1 -5.06 -39.68 A35 35 0 1 0 36.32 16.76 Z';

/* ------------------------------------------------------------------ */
/* Village skyline (viewBox 0 0 1600 300, ground at the bottom)        */
/* ------------------------------------------------------------------ */

export const SKYLINE_VIEWBOX = '0 0 1600 300';

const far = 'var(--scene-far, #161b3a)';
const mid = 'var(--scene-mid, #0c0f25)';
const near = 'var(--scene-near, #04050b)';
const lamp = 'var(--scene-lamp, #ffb547)';

// [x, width, wall top, roof peak, lit window?]
const houses: [number, number, number, number, boolean][] = [
  [30, 120, 214, 176, false],
  [170, 90, 222, 190, true],
  [300, 140, 206, 164, false],
  [470, 96, 216, 186, true],
  [900, 130, 210, 170, true],
  [1060, 100, 220, 188, false],
  [1210, 150, 204, 160, true],
  [1400, 120, 216, 180, false],
];

function house([x, w, wall, peak]: (typeof houses)[number]): string {
  const o = 8;
  return `M${x - o} ${wall} L${x + w / 2} ${peak} L${x + w + o} ${wall} H${x + w} V300 H${x} V${wall} Z`;
}

function windowLight(glow: string) {
  return ([x, w, wall]: (typeof houses)[number]) => {
    const wx = Math.round(x + w * 0.32);
    const wy = wall + 20;
    return (
      `<circle cx="${wx + 6}" cy="${wy + 8}" r="30" fill="url(#${glow})"/>` +
      `<rect x="${wx}" y="${wy}" width="12" height="15" rx="1.5" fill="${lamp}" opacity=".9"/>`
    );
  };
}

/** `id` keeps gradient ids unique when a page renders more than one skyline. */
export function skylineMarkup(id = 'sky'): string {
  const glow = `${id}-glow`;
  return `
<defs>
  <radialGradient id="${glow}">
    <stop offset="0" stop-color="${lamp}" stop-opacity=".45"/>
    <stop offset="1" stop-color="${lamp}" stop-opacity="0"/>
  </radialGradient>
</defs>
<path fill="${far}" d="M0 196 C90 184 170 188 260 194 C360 200 430 176 540 180 C650 184 720 196 820 190 C930 183 1010 166 1120 172 C1230 178 1300 190 1400 184 C1480 179 1540 172 1600 176 V300 H0 Z"/>
<path fill="${mid}" d="${houses.map(house).join(' ')}"/>
${houses.filter((h) => h[4]).map(windowLight(glow)).join('')}
<g fill="${near}">
  <path d="M0 266 C200 258 420 264 620 260 C820 256 1000 264 1200 260 C1380 256 1500 262 1600 258 V300 H0 Z"/>
  <path d="M-12 224 L86 170 L186 224 H176 V300 H-2 V224 Z"/>
  <path d="M1384 216 L1486 162 L1612 216 H1600 V300 H1396 V216 Z"/>
  <path d="M1452 171 Q1449 160 1454 156 L1456 149 L1460 155 L1466 155 L1470 149 L1471 157 Q1475 162 1471 170 Q1482 172 1484 182 L1478 182 Q1476 176 1470 176 Z"/>
  <path d="M596 268 C598 236 604 204 616 176 L622 178 C611 206 605 238 604 268 Z"/>
  <path d="M619 176 C600 160 580 158 560 166 C582 162 600 166 619 181 Z"/>
  <path d="M619 176 C606 150 590 140 572 138 C592 146 606 158 617 181 Z"/>
  <path d="M619 176 C626 150 640 138 658 136 C642 146 630 160 621 181 Z"/>
  <path d="M619 176 C640 162 662 162 680 172 C660 168 640 170 621 181 Z"/>
  <path d="M619 176 C618 154 622 140 632 128 C626 144 624 160 622 181 Z"/>
  <path d="M686 199 L765 157 L844 199 Z"/>
  <path d="M704 199 H711 V268 H704 Z M819 199 H826 V268 H819 Z M698 236 H832 V243 H698 Z"/>
  <path d="M764 176 H766 V190 H764 Z M759 190 H771 Q774 190 774 193 V217 Q774 220 771 220 H759 Q756 220 756 217 V193 Q756 190 759 190 Z"/>
  <path d="M997 108 H1003 V268 H997 Z M981 120 H1019 V125 H981 Z"/>
</g>
<circle cx="792" cy="192" r="34" fill="url(#${glow})"/>
<circle cx="792" cy="192" r="3" fill="${lamp}"/>
<g fill="none" stroke="${near}" stroke-width="1.5">
  <path d="M0 148 Q500 196 983 122"/>
  <path d="M1017 122 Q1300 176 1600 138"/>
  <path d="M0 162 Q520 208 983 124"/>
</g>`;
}

/* ------------------------------------------------------------------ */
/* Stars, generated once at build time from a fixed seed               */
/* ------------------------------------------------------------------ */

export interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkle: boolean;
  delay: number;
}

export function makeStars(count: number, seed = 7): Star[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    x: +(rand() * 100).toFixed(2),
    y: +(rand() ** 1.4 * 72).toFixed(2),
    size: +(1 + rand() * 1.6).toFixed(2),
    opacity: +(0.3 + rand() * 0.6).toFixed(2),
    twinkle: rand() < 0.3,
    delay: +(rand() * 6).toFixed(2),
  }));
}

/** Replace `var(--x, #hex)` with `#hex` for renderers without CSS (sharp). */
export const resolveVars = (svg: string): string => svg.replace(/var\(--[\w-]+, (#[0-9a-f]+)\)/gi, '$1');

export const GOLDEN_VARS: Record<string, string> = {
  '--tts-line': '#4a3100',
  '--tts-wood': '#f2b52e',
  '--tts-grain': '#c98a0e',
  '--tts-dark': '#9a6400',
  '--tts-top': '#ffe08a',
  '--tts-ring': '#e0a620',
  '--tts-bat': '#fff0b8',
  '--tts-grip': '#b07a00',
};
