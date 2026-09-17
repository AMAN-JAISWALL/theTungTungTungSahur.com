/** Wires the menu poster (modes, settings, stats) to the game dialog. */
import { Sound } from './audio';
import { createGame } from './engine';
import { dailyNumber, MODE_IDS, MODES, rankFor, todayKey, type ModeId } from './modes';
import * as store from './store';
import type { Save, Settings } from './store';

const root = document.querySelector<HTMLElement>('[data-find]');
const dialog = document.querySelector<HTMLDialogElement>('[data-find-dialog]');

if (root && dialog) {
  const sound = new Sound();
  const numberFormat = new Intl.NumberFormat('en-US');
  const radios = [...root.querySelectorAll<HTMLInputElement>('input[name="mode"]')];
  const playLabel = root.querySelector<HTMLElement>('[data-play-label]');
  const blurb = root.querySelector<HTMLElement>('[data-mode-blurb]');
  const testStatus = root.querySelector<HTMLElement>('[data-test-status]');
  const game = createGame(dialog, sound, () => render(store.load()));

  const isMode = (value: unknown): value is ModeId => MODE_IDS.includes(value as ModeId);
  const selected = (): ModeId => {
    const value = radios.find((r) => r.checked)?.value;
    return isMode(value) ? value : 'classic';
  };

  const select = (mode: ModeId) => {
    radios.forEach((r) => (r.checked = r.value === mode));
    if (playLabel) playLabel.textContent = MODES[mode].name;
    if (blurb) blurb.textContent = MODES[mode].blurb;
  };

  // ?mode=rush preselects a mode, so links can point at one.
  const fromUrl = new URLSearchParams(location.search).get('mode');
  select(isMode(fromUrl) ? fromUrl : store.load().mode);

  radios.forEach((radio) =>
    radio.addEventListener('change', () => {
      const mode = selected();
      select(mode);
      store.update((s) => (s.mode = mode));
      const url = new URL(location.href);
      url.searchParams.set('mode', mode);
      history.replaceState(history.state, '', url);
    }),
  );

  root.querySelector('[data-play]')?.addEventListener('click', () => game.open(selected()));

  document.querySelectorAll<HTMLElement>('[data-find-start]').forEach((button) =>
    button.addEventListener('click', () => {
      const mode = button.dataset.findStart;
      if (!isMode(mode)) return;
      select(mode);
      store.update((s) => (s.mode = mode));
      game.open(mode);
    }),
  );

  root.querySelector('[data-test-sound]')?.addEventListener('click', async () => {
    if (!store.load().settings.sound) store.update((s) => (s.settings.sound = true));
    sound.setEnabled(true);
    const ok = await sound.unlock();
    if (ok) sound.sample();
    if (testStatus) {
      testStatus.textContent = ok
        ? 'You should hear tung, tung, tung: left, middle, right. Nothing? Check your volume or silent mode.'
        : 'Sound is blocked on this device. Turn on Visual Cues to play without it.';
    }
  });

  root.querySelectorAll<HTMLInputElement>('[data-setting]').forEach((input) => {
    const key = input.dataset.setting as keyof Settings;
    input.addEventListener('change', () => store.update((s) => (s.settings[key] = input.checked)));
  });

  const setText = (selector: string, text: string) => {
    const el = root.querySelector(selector);
    if (el && el.textContent !== text) el.textContent = text;
  };

  function render(save: Save) {
    root!.querySelectorAll<HTMLInputElement>('[data-setting]').forEach((input) => {
      input.checked = save.settings[input.dataset.setting as keyof Settings];
    });

    const rank = rankFor(save.finds);
    setText('[data-stat="rank"]', rank.name);
    setText(
      '[data-stat="rank-next"]',
      rank.next ? `${rank.toNext} more ${rank.toNext === 1 ? 'find' : 'finds'} to ${rank.next}` : 'Top rank reached. Legendary.',
    );
    const bar = root!.querySelector<HTMLElement>('[data-stat-bar]');
    if (bar) bar.style.transform = `scaleX(${rank.progress.toFixed(3)})`;

    setText('[data-stat="finds"]', numberFormat.format(save.finds));
    setText('[data-stat="golden"]', numberFormat.format(save.golden));
    setText('[data-stat="rush"]', save.rushBest ? numberFormat.format(save.rushBest) : '—');
    setText('[data-stat="streak"]', numberFormat.format(store.currentStreak(save)));

    const today = save.daily.results[todayKey()];
    setText('[data-mode-meta="daily"]', today ? `#${dailyNumber()} · done` : `#${dailyNumber()} · 5 hides`);
  }

  store.subscribe(render);
}
