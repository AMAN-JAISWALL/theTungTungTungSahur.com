export const SITE = {
  name: 'The Tung Tung Tung Sahur',
  shortName: 'Tung Sahur',
  domain: 'thetungtungtungsahur.com',
  url: 'https://thetungtungtungsahur.com',
  themeColor: '#07080f',
  locale: 'en_US',
} as const;

/** The one inbox for the whole site: feedback, bugs, rights queries. Published on /contact. */
export const CONTACT_EMAIL = 'hello@thetungtungtungsahur.com';

/** Google Analytics 4 measurement ID, loaded from Layout.astro on production builds only. */
export const GA_ID = 'G-SPP2KNNLRK';

/** Microsoft Clarity project ID — heatmaps and session replay, production builds only. */
export const CLARITY_ID = 'ykr6bd9ih6';

export const FIND_PATH = '/games/find-tung-tung-tung-sahur';
/** The entity page explaining the meme itself. */
export const LORE_PATH = '/tung-tung-tung-sahur';
/** The question hub: everything people ask about the meme, the games and the Roblox dispute. */
export const FAQ_PATH = '/faq';
export const ABOUT_PATH = '/about';
export const CONTACT_PATH = '/contact';
export const PRIVACY_PATH = '/privacy';
export const TERMS_PATH = '/terms';

/**
 * Sitemap metadata per route, consumed by /sitemap.xml.
 *
 * `lastmod` is the date a page's content last changed in a way worth recrawling. Bump it by hand
 * when you meaningfully edit a page — never on every build. Search engines only honour `lastmod`
 * while it stays verifiably accurate, and a date that moves whenever the site is rebuilt teaches
 * them to ignore the field entirely.
 *
 * Routes are discovered from the filesystem, so a new page still appears here without being
 * listed; it just falls back to {@link SITEMAP_FALLBACK_PRIORITY} and carries no `lastmod`.
 */
export const ROUTE_META: Record<string, { priority: number; lastmod: string }> = {
  '/': { priority: 1.0, lastmod: '2026-09-19' },
  [FIND_PATH]: { priority: 0.9, lastmod: '2026-09-18' },
  [LORE_PATH]: { priority: 0.8, lastmod: '2026-09-18' },
  [FAQ_PATH]: { priority: 0.8, lastmod: '2026-09-18' },
  '/games': { priority: 0.7, lastmod: '2026-09-18' },
  [ABOUT_PATH]: { priority: 0.5, lastmod: '2026-09-19' },
  [CONTACT_PATH]: { priority: 0.5, lastmod: '2026-09-19' },
  [PRIVACY_PATH]: { priority: 0.3, lastmod: '2026-09-19' },
  [TERMS_PATH]: { priority: 0.3, lastmod: '2026-09-18' },
};

export const SITEMAP_FALLBACK_PRIORITY = 0.4;

/** Served in place of a URL rather than crawled to, so they stay out of the sitemap. */
export const SITEMAP_EXCLUDED = ['/404', '/500'];

export const NAV = [
  { href: '/games', label: 'Games' },
  { href: `${FIND_PATH}#how-to-play`, label: 'How to Play' },
  { href: LORE_PATH, label: 'Who Is He?' },
  { href: FAQ_PATH, label: 'FAQ' },
  { href: ABOUT_PATH, label: 'About' },
] as const;

/**
 * The pages about the site rather than the games. One list, rendered twice: as a section on the
 * home page and as the footer's Site and Legal columns, so the two can't drift apart.
 */
export const SITE_PAGES = [
  {
    href: ABOUT_PATH,
    label: 'About Us',
    legal: false,
    blurb: 'Who makes this, why a meme about a drum became a game you play by ear, and how it’s built.',
  },
  {
    href: CONTACT_PATH,
    label: 'Contact Us',
    legal: false,
    blurb: 'Report a bug, suggest a game, or send a rights query. One inbox, read by one person.',
  },
  {
    href: PRIVACY_PATH,
    label: 'Privacy Policy',
    legal: true,
    blurb: 'What’s stored and where: your progress stays in your browser, plus which analytics the site uses.',
  },
  {
    href: TERMS_PATH,
    label: 'Terms & Conditions',
    legal: true,
    blurb: 'The rules for using the site: free to play, fan-made and unofficial, offered as-is.',
  },
] as const;

export type GameIconName = 'lantern' | 'runner' | 'rhythm' | 'alarm' | 'tap';

export interface Game {
  slug: string;
  name: string;
  status: 'live' | 'soon';
  tagline: string;
  icon: GameIconName;
  href?: string;
  tags: string[];
}

export const GAMES: Game[] = [
  {
    slug: 'find-tung-tung-tung-sahur',
    name: 'Find Tung Tung Tung Sahur',
    status: 'live',
    tagline: 'He’s hiding in the dark. Follow the tung tung tung and catch him before dawn.',
    icon: 'lantern',
    href: FIND_PATH,
    tags: ['Sound', 'Hide & Seek', '1–3 min'],
  },
  {
    slug: 'tung-tung-runner',
    name: 'Tung Tung Runner',
    status: 'soon',
    tagline: 'Sprint across midnight rooftops, dodge the alley cats and make it home for sahur.',
    icon: 'runner',
    tags: ['Endless Runner'],
  },
  {
    slug: 'tung-tung-rhythm',
    name: 'Tung Tung Rhythm',
    status: 'soon',
    tagline: 'Drum the sahur beat on time. Miss a tung and the whole street stays asleep.',
    icon: 'rhythm',
    tags: ['Rhythm'],
  },
  {
    slug: 'wake-up-before-sahur',
    name: 'Wake Up Before Sahur',
    status: 'soon',
    tagline: 'Get the whole village out of bed before imsak. Some sleepers are very stubborn.',
    icon: 'alarm',
    tags: ['Puzzle'],
  },
  {
    slug: 'tung-tung-clicker',
    name: 'Tung Tung Clicker',
    status: 'soon',
    tagline: 'Tap to tung. Buy bigger bats. Wake up the entire planet, one knock at a time.',
    icon: 'tap',
    tags: ['Idle', 'Clicker'],
  },
];

export const LIVE_GAMES = GAMES.filter((g) => g.status === 'live');
export const SOON_GAMES = GAMES.filter((g) => g.status === 'soon');
