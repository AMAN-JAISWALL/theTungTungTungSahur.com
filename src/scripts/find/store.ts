/** Progress and settings, saved in localStorage. Falls back to memory if storage is blocked. */
import { MODE_IDS, shiftDay, todayKey, type ModeId } from './modes';

export interface Settings {
  sound: boolean;
  visual: boolean;
  voice: boolean;
  haptics: boolean;
}

export interface DailyResult {
  time: number;
  grid: string;
}

export interface Save {
  finds: number;
  golden: number;
  classicBest: number | null;
  rushBest: number;
  rushBestCatches: number;
  daily: {
    streak: number;
    bestStreak: number;
    last: string | null;
    results: Record<string, DailyResult>;
  };
  settings: Settings;
  mode: ModeId;
  coached: boolean;
}

const KEY = 'ttts:find:v1';
const KEEP_DAYS = 60;

const defaults = (): Save => ({
  finds: 0,
  golden: 0,
  classicBest: null,
  rushBest: 0,
  rushBestCatches: 0,
  daily: { streak: 0, bestStreak: 0, last: null, results: {} },
  settings: { sound: true, visual: false, voice: true, haptics: true },
  mode: 'classic',
  coached: false,
});

type Listener = (save: Save) => void;
const listeners = new Set<Listener>();
let cache: Save | null = null;

export function load(): Save {
  if (cache) return cache;
  const base = defaults();
  cache = base;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Save>;
      cache = {
        ...base,
        ...saved,
        daily: { ...base.daily, ...saved.daily },
        settings: { ...base.settings, ...saved.settings },
      };
      if (!MODE_IDS.includes(cache.mode)) cache.mode = 'classic';
    }
  } catch {
    // Storage blocked or corrupted: keep in-memory defaults.
  }
  return cache;
}

export function update(change: (save: Save) => void): Save {
  const save = load();
  change(save);
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private mode or full storage: progress lasts for this visit only.
  }
  listeners.forEach((listener) => listener(save));
  return save;
}

export function subscribe(listener: Listener): void {
  listeners.add(listener);
  listener(load());
}

/** Streak only counts if it was kept alive yesterday or today. */
export function currentStreak(save = load()): number {
  const today = todayKey();
  const { last, streak } = save.daily;
  return last === today || last === shiftDay(today, -1) ? streak : 0;
}

/** Records the first completed Daily of the day. Returns false if today was already recorded. */
export function recordDaily(result: DailyResult): boolean {
  const today = todayKey();
  if (load().daily.results[today]) return false;
  update((save) => {
    const d = save.daily;
    d.streak = d.last === shiftDay(today, -1) ? d.streak + 1 : 1;
    d.bestStreak = Math.max(d.bestStreak, d.streak);
    d.last = today;
    d.results[today] = result;
    const cutoff = shiftDay(today, -KEEP_DAYS);
    for (const key of Object.keys(d.results)) if (key < cutoff) delete d.results[key];
  });
  return true;
}
