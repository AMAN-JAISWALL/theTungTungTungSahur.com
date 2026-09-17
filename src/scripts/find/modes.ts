/** Rules for each mode: difficulty ramps, timers, ranks. Pure data and functions. */

export type ModeId = 'classic' | 'rush' | 'daily';

export const MODE_IDS: ModeId[] = ['classic', 'rush', 'daily'];

export interface ModeInfo {
  id: ModeId;
  name: string;
  meta: string;
  blurb: string;
}

export const MODES: Record<ModeId, ModeInfo> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    meta: 'No timer',
    blurb: 'Find him at your own pace. Best for your first night.',
  },
  rush: {
    id: 'rush',
    name: 'Sahur Rush',
    meta: 'Beat the dawn',
    blurb: 'Catch him again and again before sunrise. He gets sneakier every time.',
  },
  daily: {
    id: 'daily',
    name: 'Daily Sahur',
    meta: '5 hides · new daily',
    blurb: 'Everyone gets the same 5 hiding spots today. Keep your streak alive.',
  },
};

export interface Splash {
  title: string;
  sub: string;
}

export interface RoundSpec {
  /** Catch zone as a fraction of the stage area. */
  area: number;
  /** 0 = stays put, 1–3 = wanders faster. */
  speed: number;
  /** Pot-bangers making decoy noise. */
  decoys: number;
  golden: boolean;
  splash?: Splash;
}

const GOLDEN_CHANCE = 0.1;

export function classicRound(round: number, rand: () => number): RoundSpec {
  return { area: 0.012, speed: 0, decoys: 0, golden: round > 0 && rand() < GOLDEN_CHANCE };
}

export const RUSH = {
  /** Seconds on the dawn clock at the start. */
  start: 40,
  /** The clock can't bank more than this. */
  max: 60,
  missPenalty: 3,
};

/** Seconds added for a catch at `level` (1-based). */
export const rushTimeBonus = (level: number, golden: boolean) =>
  Math.max(3, 8 - Math.floor(level / 3)) + (golden ? 3 : 0);

const RUSH_AREAS = [0.013, 0.011, 0.0095, 0.0085, 0.0078, 0.0072, 0.0066, 0.006, 0.0056, 0.0052];

const RUSH_SPLASHES: Record<number, Splash> = {
  4: { title: 'He’s on the Move', sub: 'Listen closely. The drumming wanders now.' },
  6: { title: 'A Pot-Banger Joins In', sub: 'Follow the wooden tung, not the metal klang.' },
  8: { title: 'Faster Feet', sub: 'He wanders quicker. He freezes when your lantern is close.' },
  10: { title: 'Two Pot-Bangers', sub: 'The whole street is awake. Trust the tung.' },
};

export function rushRound(level: number, rand: () => number): RoundSpec {
  return {
    area: RUSH_AREAS[Math.min(level, RUSH_AREAS.length) - 1],
    speed: level < 4 ? 0 : level < 8 ? 1 : level < 12 ? 2 : 3,
    decoys: level < 6 ? 0 : level < 10 ? 1 : 2,
    golden: level > 1 && rand() < GOLDEN_CHANCE,
    splash: RUSH_SPLASHES[level],
  };
}

/** Score multiplier for catches in a row without a miss (1 = first catch). */
export const comboMultiplier = (combo: number) => Math.min(3, 1 + 0.25 * Math.max(0, combo - 1));

/** Points for a catch that took `seconds`. */
export function rushPoints(seconds: number, combo: number, golden: boolean): number {
  const speed = Math.round(150 * Math.max(0, 1 - seconds / 12));
  return Math.round((100 + speed) * comboMultiplier(combo) * (golden ? 2 : 1));
}

export const DAILY_ROUNDS: RoundSpec[] = [
  { area: 0.012, speed: 0, decoys: 0, golden: false },
  { area: 0.0085, speed: 0, decoys: 0, golden: false },
  { area: 0.01, speed: 1, decoys: 0, golden: false, splash: { title: 'Hide 3 of 5', sub: 'This one wanders. Follow the sound.' } },
  { area: 0.009, speed: 0, decoys: 1, golden: false, splash: { title: 'Hide 4 of 5', sub: 'A pot-banger joins in. Trust the wooden tung.' } },
  { area: 0.009, speed: 2, decoys: 1, golden: true, splash: { title: 'Final Hide', sub: 'Golden Sahur is on the loose, and he won’t sit still.' } },
];

export const DAILY_MISS_PENALTY = 3;

/** One emoji per daily hide, for the share grid. */
export const dailyEmoji = (seconds: number) =>
  seconds < 6 ? '🟩' : seconds < 12 ? '🟨' : seconds < 20 ? '🟧' : '🟥';

/** Local calendar date, e.g. 2026-09-17. */
export function todayKey(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d + days));
}

/** Daily #1 was 2026-09-17, launch day. */
export function dailyNumber(key = todayKey()): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 8, 17)) / 86_400_000) + 1;
}

export const RANKS = [
  { at: 0, name: 'Sleepyhead' },
  { at: 5, name: 'Light Sleeper' },
  { at: 15, name: 'Early Riser' },
  { at: 35, name: 'Night Watch' },
  { at: 75, name: 'Drum Chaser' },
  { at: 150, name: 'Sahur Hunter' },
  { at: 300, name: 'Sahur Legend' },
];

export function rankFor(finds: number) {
  let index = 0;
  RANKS.forEach((rank, i) => {
    if (finds >= rank.at) index = i;
  });
  const current = RANKS[index];
  const next = RANKS[index + 1];
  return {
    name: current.name,
    next: next?.name,
    toNext: next ? next.at - finds : 0,
    progress: next ? (finds - current.at) / (next.at - current.at) : 1,
  };
}
