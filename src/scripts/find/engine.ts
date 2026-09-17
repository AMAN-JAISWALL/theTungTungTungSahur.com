/**
 * Find Tung Tung Tung Sahur: game loop, input, rounds and scoring.
 *
 * The stage lives in a <dialog>. Each frame writes a few transforms and
 * repaints one half-resolution canvas (the darkness and lantern light), so
 * it stays smooth on phones. Knocks use a look-ahead scheduler: audio is
 * queued slightly ahead on the AudioContext clock, and the matching visual
 * pulses fire from the same queue.
 */
import { Sound } from './audio';
import {
  comboMultiplier,
  classicRound,
  DAILY_MISS_PENALTY,
  DAILY_ROUNDS,
  dailyEmoji,
  dailyNumber,
  MODES,
  rankFor,
  RUSH,
  rushPoints,
  rushRound,
  rushTimeBonus,
  todayKey,
  type ModeId,
  type RoundSpec,
  type Splash,
} from './modes';
import * as store from './store';
import { hashString, mulberry32 } from '../../lib/random';

type Phase = 'idle' | 'search' | 'caught' | 'result' | 'paused';
type Tone = 'good' | 'bad' | 'gold';

interface Spot {
  /** Base position in the hiding band, 0–1 on both axes (same on every screen). */
  u: number;
  v: number;
  /** Current position, 0–1 of the stage. */
  x: number;
  y: number;
  /** Wander path: amplitude (band units), angular speed, phase and its own clock. */
  au: number;
  av: number;
  wx: number;
  wy: number;
  phase: number;
  clock: number;
  moving: boolean;
  /** Decoys: next klang time and hit counter. */
  nextHit: number;
  hits: number;
}

interface Knock {
  t: number;
  heat: number;
  roll: boolean;
  accent: boolean;
}

interface ResultView {
  eyebrow: string;
  title: string;
  sub?: string;
  grid?: string;
  stats: [string, string][];
  note?: string;
  primary: string;
  onPrimary: () => void;
}

export const SHARE_URL = 'https://thetungtungtungsahur.com/games/find-tung-tung-tung-sahur';

const LOOKAHEAD = 0.12;
const ROLL_GAP = 0.075;
const CANVAS_SCALE = 0.5;
const EDGE = 0.07;
const BOTTOM = 0.92;
/** Room kept free under the HUD so a hiding spot is never covered by controls. */
const HUD_RESERVE = 150;
const HEAT_CURVE = 24;
const WORD_POOL = 10;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const nowS = () => performance.now() / 1000;
const numberFormat = new Intl.NumberFormat('en-US');
const secondsFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtSeconds = (s: number) => `${secondsFormat.format(s)}s`;
const fmtClock = (s: number) => {
  const whole = Math.max(0, Math.ceil(s));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};
const fmtMultiplier = (m: number) => `×${Number(m.toFixed(2))}`;
const plural = (n: number, one: string, many = `${one}s`) => `${numberFormat.format(n)} ${n === 1 ? one : many}`;
const heatName = (h: number) => (h > 0.8 ? 'Burning' : h > 0.62 ? 'Hot' : h > 0.42 ? 'Warm' : h > 0.22 ? 'Cool' : 'Cold');
/** Knock spacing inside a "tung · tung · tung" triple, and the rest after it. */
const gapFor = (h: number) => 0.26 * (0.1 / 0.26) ** h;
const restFor = (h: number) => 0.85 * (0.06 / 0.85) ** h;

function hsl(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [f(0), f(8), f(4)];
}

export interface Game {
  open(mode: ModeId): void;
}

export function createGame(dialog: HTMLDialogElement, sound: Sound, onExit?: () => void): Game {
  const $ = <T extends Element = HTMLElement>(selector: string) => {
    const el = dialog.querySelector<T>(selector);
    if (!el) throw new Error(`Missing ${selector}`);
    return el;
  };

  const stage = $('[data-stage]');
  const canvas = $<HTMLCanvasElement>('[data-dark]');
  const paint = canvas.getContext('2d');
  const lantern = $('[data-lantern]');
  const eyes = $('[data-eyes]');
  const eyesArt = $('[data-eyes] .glow-eyes');
  const reveal = $('[data-reveal]');
  const revealArt = $<SVGElement>('[data-reveal] svg');
  const potEl = $('[data-pot]');
  const potArt = $('[data-pot] > *');
  const flash = $('[data-flash]');
  const fx = $('[data-fx]');
  const dawnSky = $('[data-dawn]');
  const hudMode = $('[data-hud-mode]');
  const hudRound = $('[data-hud-round]');
  const hudTime = $('[data-hud-time]');
  const hudScoreWrap = $('[data-hud-score-wrap]');
  const hudScore = $('[data-hud-score]');
  const hudCombo = $('[data-hud-combo]');
  const dawnTrack = $('[data-dawn-track]');
  const dawnBar = $('[data-dawn-bar]');
  const heatBox = $('[data-heat]');
  const heatLabel = $('[data-heat-label]');
  const heatBar = $('[data-heat-bar]');
  const splash = $('[data-splash]');
  const splashTitle = $('[data-splash-title]');
  const splashSub = $('[data-splash-sub]');
  const coach = $('[data-coach]');
  const coachText = $('[data-coach-text]');
  const blocked = $<HTMLButtonElement>('[data-sound-blocked]');
  const pausedBox = $('[data-paused]');
  const resumeBtn = $<HTMLButtonElement>('[data-resume]');
  const live = $('[data-live]');
  const soundBtn = $<HTMLButtonElement>('[data-toggle-sound]');
  const visualBtn = $<HTMLButtonElement>('[data-toggle-visual]');
  const resultBox = $('[data-result]');
  const r = {
    eyebrow: $('[data-r-eyebrow]'),
    title: $('[data-r-title]'),
    sub: $('[data-r-sub]'),
    grid: $('[data-r-grid]'),
    note: $('[data-r-note]'),
    primary: $<HTMLButtonElement>('[data-r-primary]'),
    share: $<HTMLButtonElement>('[data-r-share]'),
    menu: $<HTMLButtonElement>('[data-r-menu]'),
    stats: [...dialog.querySelectorAll<HTMLElement>('[data-r-stat]')],
  };

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');

  // Run state
  let mode: ModeId = 'classic';
  let phase: Phase = 'idle';
  let rand: () => number = Math.random;
  let spec: RoundSpec = classicRound(0, Math.random);
  let target: Spot = { u: 0.5, v: 0.5, x: 0.5, y: 0.5, au: 0, av: 0, wx: 0, wy: 0, phase: 0, clock: 0, moving: false, nextHit: 0, hits: 0 };
  let decoys: Spot[] = [];
  let dailyPlan: { target: Spot; decoys: Spot[] }[] = [];
  let round = 0;
  let roundStart = 0;
  let pauseStart = 0;
  let misses = 0;
  let roundMisses = 0;
  let roundPenalty = 0;
  let score = 0;
  let combo = 0;
  let bestCombo = 0;
  let catches = 0;
  let timeLeft = 0;
  let lastWhole = -1;
  let dailyTimes: number[] = [];
  let practice = false;
  let rankUp: string | null = null;
  let shareText = '';
  let resultAction = () => {};

  // Stage metrics (CSS px) and the lantern
  let W = 1;
  let H = 1;
  let left = 0;
  let top = 0;
  let diag = 1;
  let radius = 30;
  let band = 0.18;
  let lightR = 120;
  let lx = 0;
  let ly = 0;
  let touch: { id: number; x: number; y: number; t: number; moved: number } | null = null;
  let usingKeys = false;

  // Sound scheduling and visuals
  let nextKnock = 0;
  let beat = 0;
  let heat = 0;
  let inZone = false;
  let pulse = 0;
  let darkness = 0.9;
  let darkTarget = 0.9;
  let lastWord = 0;
  let lastBand = -1;
  let lastBandAt = 0;
  let raf = 0;
  let lastFrame = 0;
  const queue: Knock[] = [];
  const timers = new Set<number>();
  const shown = new Map<string, string>();

  const words = Array.from({ length: WORD_POOL }, () => {
    const el = document.createElement('span');
    el.className = 'find-word';
    fx.append(el);
    return el;
  });
  let wordIndex = 0;

  const settings = () => store.load().settings;
  const audible = () => settings().sound && sound.running;
  const visualOn = () => settings().visual || !audible();

  function later(fn: () => void, ms: number) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }

  function setText(el: HTMLElement, key: string, text: string) {
    if (shown.get(key) === text) return;
    shown.set(key, text);
    el.textContent = text;
  }

  let liveToggle = false;
  function announce(text: string) {
    // Alternate a zero-width space so repeated messages are read again.
    liveToggle = !liveToggle;
    live.textContent = liveToggle ? text : `${text}​`;
  }

  function vibrate(pattern: number | number[]) {
    if (settings().haptics && 'vibrate' in navigator) navigator.vibrate(pattern);
  }

  function setPhase(next: Phase) {
    phase = next;
    stage.dataset.phase = next;
  }

  /* ---------------- Geometry ---------------- */

  function measure() {
    const rect = stage.getBoundingClientRect();
    const rx = W > 1 ? lx / W : 0.5;
    const ry = H > 1 ? ly / H : 0.5;
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    left = rect.left;
    top = rect.top;
    diag = Math.hypot(W, H);
    lx = rx * W;
    ly = ry * H;
    canvas.width = Math.ceil(W * CANVAS_SCALE);
    canvas.height = Math.ceil(H * CANVAS_SCALE);
    lightR = clamp(Math.min(W, H) * 0.17 + 40, 90, 200);
    setRadius(spec.area);
    stage.style.setProperty('--eye-size', `${clamp(radius * 0.26, 8, 15).toFixed(1)}px`);
    stage.style.setProperty('--reveal-size', `${revealSize()}px`);
  }

  function setRadius(area: number) {
    radius = clamp(Math.sqrt((area * W * H) / Math.PI), 22, 90);
    band = clamp((HUD_RESERVE + radius) / H, 0.16, 0.5);
  }
  const revealSize = () => Math.round(clamp(Math.min(W, H) * 0.22, 96, 176));

  function spotAt(u: number, v: number): Spot {
    const spot = { u, v, x: 0, y: 0, au: 0, av: 0, wx: 0, wy: 0, phase: 0, clock: 0, moving: false, nextHit: 0, hits: 0 };
    wander(spot, 0, 0);
    return spot;
  }

  /** Where the lantern is, in hiding-band units. */
  const lanternInBand = () => ({
    u: clamp((lx / W - EDGE) / (1 - 2 * EDGE), 0, 1),
    v: clamp((ly / H - band) / (BOTTOM - band), 0, 1),
  });

  /** Picks a spot at least `gap` (band units) away from every point in `avoid`. */
  function makeSpot(speed: number, avoid: { u: number; v: number }[], gap: number, rng: () => number): Spot {
    const moving = speed > 0;
    const au = moving ? (0.06 + 0.035 * speed) * (0.7 + 0.3 * rng()) : 0;
    const av = moving ? (0.055 + 0.035 * speed) * (0.7 + 0.3 * rng()) : 0;
    let u = 0.5;
    let v = 0.5;
    for (let i = 0; i < 40; i++) {
      u = lerp(au, 1 - au, rng());
      v = lerp(av, 1 - av, rng());
      if (avoid.every((p) => Math.hypot(p.u - u, p.v - v) >= gap)) break;
    }
    const spot = spotAt(u, v);
    Object.assign(spot, {
      au,
      av,
      moving,
      wx: (0.4 + 0.12 * speed) * (0.8 + 0.4 * rng()),
      wy: (0.32 + 0.1 * speed) * (0.8 + 0.4 * rng()),
      phase: rng() * Math.PI * 2,
    });
    wander(spot, 0, 0);
    return spot;
  }

  /** Advances a wandering spot and maps it into the current hiding band. */
  function wander(s: Spot, dt: number, speed: number) {
    let { u, v } = s;
    if (s.moving) {
      s.clock += dt * speed;
      u = clamp(u + s.au * Math.sin(s.wx * s.clock + s.phase), 0, 1);
      v = clamp(v + s.av * Math.sin(s.wy * s.clock + s.phase * 1.7), 0, 1);
    }
    s.x = lerp(EDGE, 1 - EDGE, u);
    s.y = lerp(band, BOTTOM, v);
  }

  const distTo = (s: Spot, x = lx, y = ly) => Math.hypot(s.x * W - x, s.y * H - y);
  const panFor = (s: Spot) => clamp((s.x * W - lx) / (W * 0.35), -1, 1) * 0.85;
  /** 0 far away → 1 at the edge of the catch zone. Log-shaped: halving the distance is one clear step. */
  const heatFor = (d: number) => {
    const x = clamp((d - radius) / (diag * 0.75), 0, 1);
    return 1 - Math.log1p(HEAT_CURVE * x) / Math.log1p(HEAT_CURVE);
  };

  function setLantern(x: number, y: number) {
    lx = clamp(x, 0, W);
    ly = clamp(y, 0, H);
  }

  function updateHeat() {
    const d = distTo(target);
    heat = heatFor(d);
    inZone = d <= radius;
  }

  /* ---------------- Rounds ---------------- */

  /** Every player starts in the middle and catches each hide near its spot, so the gaps stay fair. */
  function planDaily(rng: () => number) {
    let prev = { u: 0.5, v: 0.5 };
    return DAILY_ROUNDS.map((roundSpec) => {
      const spot = makeSpot(roundSpec.speed, [prev], 0.45, rng);
      const pots = Array.from({ length: roundSpec.decoys }, () => makeSpot(0, [prev, spot], 0.35, rng));
      prev = spot;
      return { target: spot, decoys: pots };
    });
  }

  function startRun(next: ModeId) {
    mode = next;
    timers.forEach(clearTimeout);
    timers.clear();
    const save = store.load();
    const today = todayKey();
    round = 0;
    misses = 0;
    score = 0;
    combo = 0;
    bestCombo = 0;
    catches = 0;
    rankUp = null;
    timeLeft = RUSH.start;
    lastWhole = -1;
    dailyTimes = [];
    practice = next === 'daily' && Boolean(save.daily.results[today]);
    rand = next === 'daily' ? mulberry32(hashString(`daily:${today}`)) : Math.random;
    if (next === 'daily') dailyPlan = planDaily(rand);
    lx = W / 2;
    ly = H / 2;
    shown.clear();

    resultBox.hidden = true;
    pausedBox.hidden = true;
    splash.hidden = true;
    stage.dataset.mode = next;
    setText(hudMode, 'mode', MODES[next].name);
    hudScoreWrap.hidden = next !== 'rush';
    dawnTrack.hidden = next !== 'rush';
    dawnSky.style.opacity = '0';
    renderScore();

    coach.hidden = save.coached;
    coachText.textContent = coarse.matches
      ? 'Drag your finger around and listen. The closer you get, the faster he drums. When it turns into a drumroll, lift your finger or tap.'
      : 'Move your mouse around and listen. The closer you get, the faster he drums. When it turns into a drumroll, click.';

    nextRound();
  }

  function nextRound() {
    if (mode === 'rush') spec = rushRound(round + 1, rand);
    else if (mode === 'daily') spec = DAILY_ROUNDS[round];
    else spec = classicRound(round, rand);
    setRadius(spec.area);

    if (mode === 'daily') {
      ({ target, decoys } = dailyPlan[round]);
    } else {
      const here = lanternInBand();
      target = makeSpot(spec.speed, [here], 0.42, rand);
      decoys = Array.from({ length: spec.decoys }, () => makeSpot(0, [here, target], 0.35, rand));
    }
    [target, ...decoys].forEach((spot) => wander(spot, 0, 0));

    const t = nowS();
    decoys.forEach((pot, i) => {
      pot.nextHit = t + 0.5 + i * 0.37;
      pot.hits = 0;
    });
    roundStart = t;
    roundMisses = 0;
    roundPenalty = 0;
    nextKnock = t + 0.2;
    beat = 0;
    queue.length = 0;
    lastBand = -1;
    darkTarget = 0.9;
    reveal.hidden = true;
    potEl.hidden = true;
    eyesArt.classList.toggle('is-golden', spec.golden);
    stage.classList.remove('is-caught');
    setPhase('search');
    updateHeat();

    renderRound();
    if (spec.splash) {
      showSplash(spec.splash);
      if (audible()) sound.chime();
    } else if (spec.golden) {
      showSplash({ title: 'A Golden Sahur Is Hiding', sub: 'Listen for the little bell. He’s worth double.' });
    }
    announce(
      mode === 'daily'
        ? `Hide ${round + 1} of ${DAILY_ROUNDS.length}. Listen for the tung.`
        : mode === 'rush'
          ? `Level ${round + 1}. ${spec.splash?.title ?? 'Listen for the tung.'}`
          : 'He’s hiding. Listen for the tung.',
    );
    if (document.hidden) pause();
  }

  function attempt(x: number, y: number, penalize: boolean) {
    if (phase !== 'search') return;
    setLantern(x, y);
    updateHeat();
    if (inZone) {
      caught();
      return;
    }
    if (!penalize) return;
    missed(decoys.find((pot) => distTo(pot) <= radius * 1.15));
  }

  function caught() {
    setPhase('caught');
    const seconds = nowS() - roundStart;
    const golden = spec.golden;
    queue.length = 0;
    if (audible()) sound.caught(golden);
    vibrate([25, 40, 90]);

    const before = rankFor(store.load().finds).name;
    const save = store.update((s) => {
      s.finds += 1;
      if (golden) s.golden += 1;
      s.coached = true;
    });
    const after = rankFor(save.finds).name;
    if (after !== before) rankUp = after;
    coach.hidden = true;

    showReveal(golden);
    setText(heatLabel, 'heat', 'Caught!');
    darkTarget = 0.28;
    stage.classList.add('is-caught');
    const anchor = revealTop();

    if (mode === 'rush') {
      catches += 1;
      combo += 1;
      bestCombo = Math.max(bestCombo, combo);
      const points = rushPoints(seconds, combo, golden);
      const bonus = rushTimeBonus(round + 1, golden);
      score += points;
      timeLeft = Math.min(RUSH.max, timeLeft + bonus);
      renderScore();
      const streak = combo > 1 ? `${fmtMultiplier(comboMultiplier(combo))} combo · ` : '';
      popup(anchor.x, anchor.y, `+${numberFormat.format(points)}`, `${streak}+${bonus}s`, golden ? 'gold' : 'good');
      announce(`Caught! Plus ${points} points and ${bonus} seconds.`);
      later(() => {
        round += 1;
        nextRound();
      }, 950);
      return;
    }

    if (mode === 'daily') {
      const total = seconds + roundPenalty;
      dailyTimes.push(total);
      popup(anchor.x, anchor.y, fmtSeconds(total), `Hide ${round + 1} of ${DAILY_ROUNDS.length}`, golden ? 'gold' : 'good');
      announce(`Caught in ${secondsFormat.format(total)} seconds.`);
      if (round + 1 < DAILY_ROUNDS.length) {
        later(() => {
          round += 1;
          nextRound();
        }, 1100);
      } else {
        if (settings().voice && audible()) later(() => sound.say('Tung tung tung sahur!'), 700);
        later(finishDaily, 1600);
      }
      return;
    }

    const best = save.classicBest;
    const isBest = best === null || seconds < best;
    if (isBest) store.update((s) => (s.classicBest = seconds));
    announce(`Caught in ${secondsFormat.format(seconds)} seconds.`);
    if (settings().voice && audible()) later(() => sound.say('Tung tung tung sahur!'), 650);
    later(() => showClassicResult(seconds, isBest && best !== null, golden), 1600);
  }

  function missed(pot?: Spot) {
    misses += 1;
    roundMisses += 1;
    if (audible()) {
      sound.bonk();
      if (pot) sound.klang(sound.time + 0.03, 1, panFor(pot));
    }
    vibrate(70);
    shake();
    flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: 450, easing: 'ease-out' });
    if (pot) showPot(pot);
    const what = pot ? 'That’s a pot!' : 'Not here';

    if (mode === 'rush') {
      timeLeft = Math.max(0, timeLeft - RUSH.missPenalty);
      combo = 0;
      renderScore();
      popup(lx, ly - 40, `−${RUSH.missPenalty}s`, what, 'bad');
      announce(`${what} Minus ${RUSH.missPenalty} seconds.`);
    } else if (mode === 'daily') {
      roundPenalty += DAILY_MISS_PENALTY;
      popup(lx, ly - 40, `+${DAILY_MISS_PENALTY}s`, what, 'bad');
      announce(`${what} Plus ${DAILY_MISS_PENALTY} seconds.`);
    } else {
      popup(lx, ly - 40, 'Nope', what, 'bad');
      announce(`${what}`);
    }

    if (pot) {
      // The pot-banger runs off somewhere else. Math.random keeps the Daily plan intact.
      const moved = makeSpot(0, [pot, target], 0.35, Math.random);
      pot.u = moved.u;
      pot.v = moved.v;
      wander(pot, 0, 0);
    }
  }

  function finishDaily() {
    setPhase('result');
    const total = dailyTimes.reduce((sum, t) => sum + t, 0);
    const grid = dailyTimes.map(dailyEmoji).join('');
    const recorded = !practice && store.recordDaily({ time: total, grid });
    const save = store.load();
    const n = dailyNumber();
    const streak = store.currentStreak(save);
    shareText = `Daily Sahur #${n} 🥁 ${fmtSeconds(total)}\n${grid}`;
    showResult({
      eyebrow: `Daily Sahur #${n}`,
      title: fmtSeconds(total),
      grid,
      sub: practice
        ? 'Practice run. Only your first run each day counts.'
        : recorded
          ? 'Saved. New hiding spots tomorrow.'
          : undefined,
      stats: [
        ['Misses', numberFormat.format(misses)],
        ['Streak', plural(streak, 'day')],
        ['Best Streak', plural(save.daily.bestStreak, 'day')],
      ],
      note: rankUp ? `Rank up! You’re now a ${rankUp}.` : undefined,
      primary: 'Practice Again',
      onPrimary: () => startRun('daily'),
    });
    announce(`Daily done in ${secondsFormat.format(total)} seconds.`);
  }

  function endRush() {
    setPhase('result');
    queue.length = 0;
    if (audible()) sound.dawn();
    dawnSky.style.opacity = '1';
    darkTarget = 0.45;
    const prevBest = store.load().rushBest;
    const isBest = score > prevBest;
    store.update((s) => {
      s.rushBest = Math.max(s.rushBest, score);
      s.rushBestCatches = Math.max(s.rushBestCatches, catches);
    });
    shareText = `I scored ${numberFormat.format(score)} in Sahur Rush and caught Tung Tung Tung Sahur ${catches}× before dawn 🌙🥁 Can you beat it?`;
    showResult({
      eyebrow: 'The Sun Is Up',
      title: numberFormat.format(score),
      sub:
        isBest && prevBest > 0
          ? 'New personal best!'
          : isBest
            ? 'Your first Sahur Rush score.'
            : `Personal best: ${numberFormat.format(prevBest)}`,
      stats: [
        ['Catches', numberFormat.format(catches)],
        ['Best Streak', numberFormat.format(bestCombo)],
        ['Misses', numberFormat.format(misses)],
      ],
      note: rankUp ? `Rank up! You’re now a ${rankUp}.` : undefined,
      primary: 'Play Again',
      onPrimary: () => startRun('rush'),
    });
    announce(`The sun is up. ${plural(score, 'point')}, ${plural(catches, 'catch', 'catches')}.`);
  }

  function showClassicResult(seconds: number, newBest: boolean, golden: boolean) {
    setPhase('result');
    const save = store.load();
    const rank = rankFor(save.finds);
    shareText = `I found Tung Tung Tung Sahur in ${fmtSeconds(seconds)} 🥁 How fast can you find him?`;
    showResult({
      eyebrow: golden ? 'Golden Sahur Found' : 'Found Him',
      title: fmtSeconds(seconds),
      sub: newBest
        ? 'New personal best!'
        : save.classicBest !== null
          ? `Personal best: ${fmtSeconds(save.classicBest)}`
          : undefined,
      stats: [
        ['Misses', numberFormat.format(roundMisses)],
        ['Total Finds', numberFormat.format(save.finds)],
        ['Rank', rank.name],
      ],
      note: rankUp
        ? `Rank up! You’re now a ${rankUp}.`
        : rank.next
          ? `${plural(rank.toNext, 'more find')} to ${rank.next}.`
          : 'You’ve reached the top rank.',
      primary: 'Hide Again',
      onPrimary: () => {
        rankUp = null;
        resultBox.hidden = true;
        round += 1;
        nextRound();
        stage.focus({ preventScroll: true });
      },
    });
  }

  function showResult(view: ResultView) {
    r.eyebrow.textContent = view.eyebrow;
    r.title.textContent = view.title;
    r.sub.textContent = view.sub ?? '';
    r.sub.hidden = !view.sub;
    r.grid.textContent = view.grid ?? '';
    r.grid.hidden = !view.grid;
    r.stats.forEach((el, i) => {
      const stat = view.stats[i];
      el.hidden = !stat;
      if (!stat) return;
      el.querySelector('dt')!.textContent = stat[0];
      el.querySelector('dd')!.textContent = stat[1];
    });
    r.note.textContent = view.note ?? '';
    r.note.hidden = !view.note;
    r.primary.textContent = view.primary;
    r.share.textContent = 'Share';
    resultAction = view.onPrimary;
    splash.hidden = true;
    resultBox.hidden = false;
    r.primary.focus({ preventScroll: true });
  }

  function pause() {
    if (phase !== 'search') return;
    setPhase('paused');
    pauseStart = nowS();
    queue.length = 0;
    sound.cancelSpeech();
    pausedBox.hidden = false;
    if (dialog.open) resumeBtn.focus({ preventScroll: true });
  }

  function resume() {
    if (phase !== 'paused') return;
    const gap = nowS() - pauseStart;
    roundStart += gap;
    decoys.forEach((pot) => (pot.nextHit += gap));
    nextKnock = nowS() + 0.15;
    pausedBox.hidden = true;
    setPhase('search');
    stage.focus({ preventScroll: true });
  }

  /* ---------------- Frame loop ---------------- */

  function frame(ms: number) {
    raf = requestAnimationFrame(frame);
    const t = ms / 1000;
    const dt = clamp(t - lastFrame, 0, 0.05);
    lastFrame = t;

    if (phase === 'search') {
      // He slows down when your lantern is close, so moving targets stay catchable.
      wander(target, dt, 0.25 + 0.75 * smoothstep(radius * 1.2, radius * 3.2, distTo(target)));
      decoys.forEach((pot) => wander(pot, dt, 0));
      updateHeat();
      scheduleKnocks(t);
      scheduleDecoys(t);
      if (mode === 'rush') tickRush(dt);
      renderHud(t);
      announceHeat(t);
    }

    while (queue.length && queue[0].t <= t) onKnock(queue.shift()!, t);
    pulse *= Math.exp(-dt * 9);
    darkness += (darkTarget - darkness) * Math.min(1, dt * 6);
    render();
  }

  function scheduleKnocks(t: number) {
    if (nextKnock < t - 0.05) nextKnock = t;
    const play = audible();
    while (nextKnock < t + LOOKAHEAD) {
      const at = Math.max(nextKnock, t);
      const accent = inZone ? beat % 4 === 0 : beat === 0;
      if (play) sound.tung(sound.time + (at - t), heat, panFor(target), { accent, golden: spec.golden, roll: inZone });
      queue.push({ t: at, heat, roll: inZone, accent });
      if (inZone) {
        nextKnock = at + ROLL_GAP;
        beat = (beat + 1) % 4;
      } else {
        nextKnock = at + gapFor(heat) + (beat >= 2 ? restFor(heat) : 0);
        beat = beat >= 2 ? 0 : beat + 1;
      }
    }
  }

  function scheduleDecoys(t: number) {
    const play = audible();
    for (const pot of decoys) {
      if (pot.nextHit < t - 0.05) pot.nextHit = t;
      while (pot.nextHit < t + LOOKAHEAD) {
        const at = Math.max(pot.nextHit, t);
        if (play) sound.klang(sound.time + (at - t), heatFor(distTo(pot)) * 0.9, panFor(pot));
        pot.hits += 1;
        // "klang-klang ... klang-klang", slightly loose so it never locks to the real drum.
        pot.nextHit = at + (pot.hits % 2 ? 0.22 : 0.9 + Math.random() * 0.3);
      }
    }
  }

  function tickRush(dt: number) {
    timeLeft = Math.max(0, timeLeft - dt);
    const whole = Math.ceil(timeLeft);
    if (whole <= 5 && whole > 0 && whole !== lastWhole) {
      lastWhole = whole;
      if (audible()) sound.tick(whole <= 2);
    }
    if (timeLeft <= 0) endRush();
  }

  function onKnock(knock: Knock, t: number) {
    pulse = Math.min(1.5, pulse + (knock.accent ? 0.9 : 0.55));
    if (knock.accent && knock.heat > 0.45) vibrate(Math.round(6 + 18 * knock.heat));
    if (reduceMotion.matches || t - lastWord < (knock.roll ? 0.2 : 0.14)) return;
    lastWord = t;
    const el = words[wordIndex++ % WORD_POOL];
    const hot = knock.roll || knock.heat > 0.62;
    el.textContent = knock.roll ? 'TUNG!' : hot ? 'TUNG' : 'tung';
    el.classList.toggle('is-hot', hot);
    el.style.fontSize = `${Math.round(11 + 15 * knock.heat)}px`;
    const x = lx + (Math.random() - 0.5) * lightR;
    const y = ly - lightR * (0.3 + Math.random() * 0.35);
    const at = (dy: number, scale: number) => `translate(${x.toFixed(1)}px, ${(y + dy).toFixed(1)}px) translate(-50%, -50%) scale(${scale})`;
    el.animate(
      [
        { opacity: 0, transform: at(8, 0.8) },
        { opacity: 0.35 + 0.6 * knock.heat, transform: at(0, 1), offset: 0.25 },
        { opacity: 0, transform: at(-26, 1) },
      ],
      { duration: 700, easing: 'ease-out' },
    );
  }

  function announceHeat(t: number) {
    if (!usingKeys) return;
    const band = inZone ? 5 : heat > 0.8 ? 4 : heat > 0.62 ? 3 : heat > 0.42 ? 2 : heat > 0.22 ? 1 : 0;
    if (band === lastBand || t - lastBandAt < 0.9) return;
    lastBand = band;
    lastBandAt = t;
    announce(['Cold', 'Cool', 'Warm', 'Hot', 'Burning', 'Right on him. Press Enter.'][band]);
  }

  /* ---------------- Rendering ---------------- */

  let lanternKey = '';
  let eyesKey = '';
  let eyesOpacity = -1;

  function render() {
    const lk = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
    if (lk !== lanternKey) {
      lantern.style.transform = lk;
      lanternKey = lk;
    }
    const ek = `translate3d(${(target.x * W).toFixed(1)}px, ${(target.y * H).toFixed(1)}px, 0)`;
    if (ek !== eyesKey) {
      eyes.style.transform = ek;
      eyesKey = ek;
    }
    // His eyes glint when the lantern is almost on him.
    const d = distTo(target);
    const o = phase === 'search' ? clamp((radius * 1.5 - d) / (radius * 0.5), 0, 1) : 0;
    if (Math.abs(o - eyesOpacity) > 0.01) {
      eyes.style.opacity = o.toFixed(2);
      eyesOpacity = o;
    }
    drawLight();
  }

  function glowColor(): [number, number, number] {
    if (!visualOn() || phase !== 'search') return [255, 181, 71];
    // Cold blue → amber → red-hot.
    const hue = heat < 0.6 ? lerp(212, 38, heat / 0.6) : lerp(38, 6, (heat - 0.6) / 0.4);
    return hsl(hue, 1, 0.62);
  }

  function drawLight() {
    if (!paint) return;
    const s = CANVAS_SCALE;
    const x = lx * s;
    const y = ly * s;
    const size = lightR * s * (1 + 0.09 * pulse);
    paint.globalCompositeOperation = 'source-over';
    paint.clearRect(0, 0, canvas.width, canvas.height);
    paint.fillStyle = `rgba(2, 3, 10, ${darkness.toFixed(3)})`;
    paint.fillRect(0, 0, canvas.width, canvas.height);

    paint.globalCompositeOperation = 'destination-out';
    const hole = paint.createRadialGradient(x, y, size * 0.1, x, y, size);
    hole.addColorStop(0, 'rgba(0, 0, 0, 1)');
    hole.addColorStop(0.5, 'rgba(0, 0, 0, 0.88)');
    hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
    paint.fillStyle = hole;
    paint.fillRect(x - size, y - size, size * 2, size * 2);

    paint.globalCompositeOperation = 'lighter';
    const [cr, cg, cb] = glowColor();
    const strength = (visualOn() && phase === 'search' ? 0.1 + 0.34 * heat : 0.1) * (1 + 0.25 * pulse);
    const glow = paint.createRadialGradient(x, y, 0, x, y, size * 0.95);
    glow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${strength.toFixed(3)})`);
    glow.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
    paint.fillStyle = glow;
    paint.fillRect(x - size, y - size, size * 2, size * 2);
  }

  function renderHud(t: number) {
    if (mode === 'rush') {
      setText(hudTime, 'time', fmtClock(timeLeft));
      dawnBar.style.transform = `scaleX(${(timeLeft / RUSH.max).toFixed(4)})`;
      dawnTrack.classList.toggle('is-low', timeLeft <= 10);
      dawnSky.style.opacity = (clamp(1 - timeLeft / RUSH.start, 0, 1) ** 1.6 * 0.85).toFixed(3);
    } else {
      const elapsed = t - roundStart + roundPenalty + (mode === 'daily' ? dailyTimes.reduce((a, b) => a + b, 0) : 0);
      setText(hudTime, 'time', fmtSeconds(elapsed));
    }
    const showHeat = visualOn();
    if (heatBox.hidden === showHeat) heatBox.hidden = !showHeat;
    if (showHeat) {
      // The bar is a cover over a fixed gradient, so it shrinks from the right.
      heatBar.style.transform = `scaleX(${(1 - Math.max(0.04, heat)).toFixed(3)})`;
      setText(heatLabel, 'heat', inZone ? 'Right on him!' : heatName(heat));
      heatBox.classList.toggle('is-on', inZone);
    }
  }

  function renderScore() {
    if (mode !== 'rush') return;
    setText(hudScore, 'score', numberFormat.format(score));
    setText(hudCombo, 'combo', combo > 1 ? fmtMultiplier(comboMultiplier(combo)) : '');
  }

  function renderRound() {
    const text =
      mode === 'daily' ? `${round + 1}/${DAILY_ROUNDS.length}` : mode === 'rush' ? `Lv ${round + 1}` : round > 0 ? `#${round + 1}` : '';
    setText(hudRound, 'round', text);
    hudRound.hidden = !text;
  }

  function revealTop() {
    const size = revealSize();
    return {
      x: clamp(target.x * W, 80, W - 80),
      y: clamp(target.y * H - size * 0.62, 100, H - 60),
    };
  }

  function showReveal(golden: boolean) {
    const size = revealSize();
    // Keep the whole character on screen.
    const x = clamp(target.x * W, size * 0.52, W - size * 0.5);
    const y = clamp(target.y * H, size * 0.55, H - size * 0.72);
    reveal.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    // Nudge the "TUNG TUNG TUNG SAHUR!" burst inward near the edges.
    reveal.style.setProperty('--burst-shift', `${(clamp(x, 130, W - 130) - x).toFixed(1)}px`);
    revealArt.classList.toggle('tts-golden', golden);
    reveal.hidden = false;
  }

  function showPot(pot: Spot) {
    potEl.style.transform = `translate(${(pot.x * W).toFixed(1)}px, ${(pot.y * H).toFixed(1)}px)`;
    potEl.hidden = false;
    potArt.getAnimations().forEach((a) => a.cancel());
    potArt
      .animate(
        [
          { opacity: 0, transform: 'translate(-50%, -50%) scale(0.6)' },
          { opacity: 1, transform: 'translate(-50%, -50%) scale(1.05)', offset: 0.2 },
          { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.75 },
          { opacity: 0, transform: 'translate(-50%, -50%) scale(0.9)' },
        ],
        { duration: 1100, easing: 'ease-out' },
      )
      .addEventListener('finish', () => (potEl.hidden = true));
  }

  function popup(x: number, y: number, title: string, sub: string, tone: Tone) {
    const el = document.createElement('div');
    el.className = `find-pop is-${tone}`;
    const strong = document.createElement('strong');
    const small = document.createElement('span');
    strong.textContent = title;
    small.textContent = sub;
    el.append(strong, small);
    el.style.left = `${clamp(x, 80, W - 80).toFixed(1)}px`;
    el.style.top = `${clamp(y, 110, H - 50).toFixed(1)}px`;
    fx.append(el);
    const rise = reduceMotion.matches ? 0 : 1;
    el.animate(
      [
        { opacity: 0, transform: `translate(-50%, ${-40 + 10 * rise}%) scale(0.9)` },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.15 },
        { opacity: 1, transform: `translate(-50%, ${-50 - 15 * rise}%)`, offset: 0.7 },
        { opacity: 0, transform: `translate(-50%, ${-50 - 35 * rise}%)` },
      ],
      { duration: 1150, easing: 'ease-out' },
    ).addEventListener('finish', () => el.remove());
  }

  function showSplash(s: Splash) {
    splashTitle.textContent = s.title;
    splashSub.textContent = s.sub;
    splash.hidden = false;
    splash.getAnimations().forEach((a) => a.cancel());
    splash
      .animate(
        [
          { opacity: 0, transform: 'translate(-50%, -8px)' },
          { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.1 },
          { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.85 },
          { opacity: 0, transform: 'translate(-50%, -4px)' },
        ],
        { duration: 2600, easing: 'ease-out' },
      )
      .addEventListener('finish', () => (splash.hidden = true));
  }

  function shake() {
    if (reduceMotion.matches) return;
    stage.animate(
      [
        { transform: 'none' },
        { transform: 'translate(-6px, 2px)' },
        { transform: 'translate(5px, -2px)' },
        { transform: 'translate(-3px, 1px)' },
        { transform: 'none' },
      ],
      { duration: 260, easing: 'ease-out' },
    );
  }

  /* ---------------- Controls ---------------- */

  function syncToggles() {
    const s = settings();
    const forced = !audible();
    soundBtn.setAttribute('aria-pressed', String(s.sound));
    visualBtn.setAttribute('aria-pressed', String(s.visual || forced));
    visualBtn.title = forced && !s.visual ? 'Visual cues stay on while sound is off' : 'Visual cues (V)';
  }

  function showBlocked(reason: 'blocked' | 'unsupported') {
    blocked.hidden = false;
    blocked.disabled = reason === 'unsupported';
    blocked.textContent =
      reason === 'unsupported'
        ? 'This browser can’t play game sound. Visual cues are on.'
        : 'Sound is blocked. Tap here to turn it on.';
  }

  function unlockSound() {
    if (!settings().sound) {
      blocked.hidden = true;
      syncToggles();
      return;
    }
    if (!Sound.supported) {
      showBlocked('unsupported');
      syncToggles();
      return;
    }
    sound.unlock().then((ok) => {
      if (ok) blocked.hidden = true;
      else if (dialog.open) showBlocked('blocked');
      syncToggles();
    });
  }

  const local = (e: PointerEvent) => ({ x: e.clientX - left, y: e.clientY - top });
  const isControl = (el: EventTarget | null) => el instanceof Element && el.closest('button, a, input, label, [data-ui]') !== null;

  stage.addEventListener('pointerdown', (e) => {
    if (isControl(e.target)) return;
    if (phase === 'paused') {
      resume();
      return;
    }
    if (phase !== 'search') return;
    const rect = stage.getBoundingClientRect();
    left = rect.left;
    top = rect.top;
    const { x, y } = local(e);
    usingKeys = false;
    if (e.pointerType === 'mouse') {
      if (e.button === 0) attempt(x, y, true);
      return;
    }
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nice-to-have.
    }
    touch = { id: e.pointerId, x, y, t: performance.now(), moved: 0 };
    setLantern(x, y);
  });

  stage.addEventListener('pointermove', (e) => {
    const { x, y } = local(e);
    if (e.pointerType === 'mouse') {
      setLantern(x, y);
      return;
    }
    if (!touch || e.pointerId !== touch.id) return;
    touch.moved = Math.max(touch.moved, Math.hypot(x - touch.x, y - touch.y));
    setLantern(x, y);
  });

  const endTouch = (e: PointerEvent, cancelled: boolean) => {
    if (!touch || e.pointerId !== touch.id) return;
    const { x, y } = local(e);
    const tap = touch.moved < 12 && performance.now() - touch.t < 450;
    touch = null;
    if (cancelled) return;
    // A quick tap is a guess (misses count). Lifting after a drag only catches if you're on him.
    attempt(x, y, tap);
  };
  stage.addEventListener('pointerup', (e) => endTouch(e, false));
  stage.addEventListener('pointercancel', (e) => endTouch(e, true));
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  stage.addEventListener('keydown', (e) => {
    if (e.target !== stage || e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === 'm') return soundBtn.click();
    if (key === 'v') return visualBtn.click();
    if (key === 'p') return phase === 'paused' ? resume() : pause();
    if (phase !== 'search') return;
    const step = Math.max(10, Math.min(W, H) * 0.035) * (e.shiftKey ? 3 : 1);
    const moves: Record<string, [number, number]> = {
      arrowleft: [-step, 0],
      arrowright: [step, 0],
      arrowup: [0, -step],
      arrowdown: [0, step],
    };
    if (moves[key]) {
      e.preventDefault();
      usingKeys = true;
      setLantern(lx + moves[key][0], ly + moves[key][1]);
    } else if (key === 'enter' || key === ' ') {
      e.preventDefault();
      usingKeys = true;
      attempt(lx, ly, true);
    }
  });

  soundBtn.addEventListener('click', () => {
    const on = !settings().sound;
    store.update((s) => (s.settings.sound = on));
    sound.setEnabled(on);
    unlockSound();
    announce(on ? 'Sound on' : 'Sound off. Visual cues are on.');
  });

  visualBtn.addEventListener('click', () => {
    const on = !settings().visual;
    store.update((s) => (s.settings.visual = on));
    syncToggles();
    announce(on || !audible() ? 'Visual cues on' : 'Visual cues off');
  });

  blocked.addEventListener('click', unlockSound);
  resumeBtn.addEventListener('click', resume);
  $('[data-exit]').addEventListener('click', () => dialog.close());
  r.menu.addEventListener('click', () => dialog.close());
  r.primary.addEventListener('click', () => resultAction());
  r.share.addEventListener('click', async () => {
    try {
      if (navigator.share && coarse.matches) {
        await navigator.share({ text: shareText, url: SHARE_URL });
        return;
      }
      await navigator.clipboard.writeText(`${shareText}\n${SHARE_URL}`);
      r.share.textContent = 'Copied!';
    } catch (err) {
      if ((err as Error).name !== 'AbortError') r.share.textContent = 'Couldn’t Share';
    }
  });

  let historyEntry = false;
  window.addEventListener('popstate', () => {
    if (!historyEntry) return;
    historyEntry = false;
    if (dialog.open) dialog.close();
  });

  dialog.addEventListener('close', () => {
    if (historyEntry) {
      historyEntry = false;
      history.back();
    }
    setPhase('idle');
    timers.forEach(clearTimeout);
    timers.clear();
    cancelAnimationFrame(raf);
    queue.length = 0;
    touch = null;
    sound.cancelSpeech();
    document.documentElement.classList.remove('find-open');
    onExit?.();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });

  new ResizeObserver(() => {
    if (dialog.open) measure();
  }).observe(stage);

  store.subscribe(() => {
    sound.setEnabled(settings().sound);
    syncToggles();
  });

  return {
    open(next: ModeId) {
      // Must run inside the click/tap that opened the game (autoplay rules).
      sound.setEnabled(settings().sound);
      unlockSound();
      if (!dialog.open) dialog.showModal();
      if (!historyEntry) {
        history.pushState({ ...history.state, findGame: true }, '');
        historyEntry = true;
      }
      document.documentElement.classList.add('find-open');
      measure();
      startRun(next);
      syncToggles();
      cancelAnimationFrame(raf);
      lastFrame = performance.now() / 1000;
      raf = requestAnimationFrame(frame);
      stage.focus({ preventScroll: true });
    },
  };
}
