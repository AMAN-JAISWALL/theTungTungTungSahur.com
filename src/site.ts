export const SITE = {
  name: 'The Tung Tung Tung Sahur',
  shortName: 'Tung Sahur',
  domain: 'thetungtungtungsahur.com',
  url: 'https://thetungtungtungsahur.com',
  themeColor: '#07080f',
  locale: 'en_US',
} as const;

export const FIND_PATH = '/games/find-tung-tung-tung-sahur';

export const NAV = [
  { href: '/games', label: 'Games' },
  { href: `${FIND_PATH}#how-to-play`, label: 'How to Play' },
  { href: '/about', label: 'About' },
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
