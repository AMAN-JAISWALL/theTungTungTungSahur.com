/**
 * Every sound is synthesized with the Web Audio API: nothing to download,
 * and the first knock plays instantly. Schedule times are AudioContext seconds.
 */

export interface TungOptions {
  accent?: boolean;
  golden?: boolean;
  /** Short, tight hits for the drumroll. */
  roll?: boolean;
}

type Wave = OscillatorType;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const db = (value: number) => 10 ** (value / 20);

export class Sound {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private on = true;

  static get supported(): boolean {
    return typeof window !== 'undefined' && typeof window.AudioContext === 'function';
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Current AudioContext time. */
  get time(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** Creates or resumes the audio context. Call it inside a click, tap or key handler. */
  unlock(): Promise<boolean> {
    if (!Sound.supported) return Promise.resolve(false);
    try {
      if (!this.ctx) {
        // Keep playing when an iPhone's ring switch is on silent (Safari 16.4+).
        const nav = navigator as Navigator & { audioSession?: { type: string } };
        if (nav.audioSession) nav.audioSession.type = 'playback';

        const ctx = new AudioContext({ latencyHint: 'interactive' });
        const bus = new GainNode(ctx, { gain: this.on ? 1 : 0 });
        const limiter = new DynamicsCompressorNode(ctx, {
          threshold: -10,
          knee: 6,
          ratio: 8,
          attack: 0.002,
          release: 0.12,
        });
        bus.connect(limiter).connect(ctx.destination);
        this.ctx = ctx;
        this.bus = bus;
        this.noise = makeNoise(ctx);
        if ('speechSynthesis' in window) speechSynthesis.getVoices();
      }
      const ctx = this.ctx;
      // A silent blip finishes the unlock on older iOS versions.
      const blip = new AudioBufferSourceNode(ctx, { buffer: ctx.createBuffer(1, 1, ctx.sampleRate) });
      blip.connect(ctx.destination);
      blip.start();
      if (ctx.state === 'running') return Promise.resolve(true);
      return ctx.resume().then(
        () => ctx.state === 'running',
        () => false,
      );
    } catch {
      return Promise.resolve(false);
    }
  }

  setEnabled(on: boolean): void {
    this.on = on;
    if (this.ctx && this.bus) this.bus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.015);
    if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
  }

  /**
   * One wooden "tung".
   * @param heat 0 (far) to 1 (on him): louder, brighter and higher.
   * @param pan -1 (left) to 1 (right).
   */
  tung(at: number, heat: number, pan: number, options: TungOptions = {}): void {
    const { ctx, bus } = this;
    if (!ctx || !bus) return;
    const h = clamp(heat, 0, 1);
    const f0 = 176 * 2 ** (h * 0.45) * (options.accent ? 0.9 : 1);
    const decay = options.roll ? 0.07 : 0.1 + 0.08 * (1 - h);
    const level = db(-26 + 26 * h) * (options.accent ? 1 : 0.78);

    const out = this.chain(bus, level, 350 * 26 ** h, pan);
    const golden = options.golden === true;
    // Hollow body with a fast pitch drop: "t-ung". The longest partial releases the chain.
    this.partial(out.input, 'sine', f0 * 1.6, f0, at, 0.9, decay * 1.7, 0.03, golden ? undefined : out.release);
    this.partial(out.input, 'sine', f0 * 2.4, f0 * 2.32, at, 0.3, decay * 0.6, 0.02);
    if (!options.roll) this.partial(out.input, 'triangle', f0 * 4.1, f0 * 3.9, at, 0.12, 0.025, 0.01);
    this.click(out.input, at, 2400, 0.45, 0.012);
    // Golden Sahur rings like a little bell.
    if (golden) this.partial(out.input, 'sine', f0 * 7.02, f0 * 7.02, at + 0.004, 0.12, 0.5, 0, out.release);
  }

  /** Metallic pot lid, for decoys. `level` works like heat. */
  klang(at: number, level: number, pan: number): void {
    const { ctx, bus } = this;
    if (!ctx || !bus) return;
    const h = clamp(level, 0, 1);
    const out = this.chain(bus, db(-30 + 26 * h) * 0.75, 600 * 14 ** h, pan);
    const f = 530;
    const partials: [number, number, number][] = [
      [1, 0.5, 0.45],
      [2.76, 0.32, 0.3],
      [5.4, 0.2, 0.18],
      [8.93, 0.12, 0.12],
    ];
    partials.forEach(([ratio, peak, decay], i) =>
      this.partial(out.input, 'sine', f * ratio, f * ratio * 0.995, at, peak, decay, 0.05, i === 0 ? out.release : undefined),
    );
    this.click(out.input, at, 4200, 0.35, 0.02);
  }

  /** Dull thud for a miss. */
  bonk(): void {
    const { ctx, bus } = this;
    if (!ctx || !bus) return;
    const t = ctx.currentTime + 0.01;
    this.partial(bus, 'sine', 150, 52, t, 0.75, 0.22, 0.12);
    this.click(bus, t, 380, 0.5, 0.05);
  }

  /** Drumroll, big hit and a short fanfare. */
  caught(golden: boolean): void {
    const { ctx, bus } = this;
    if (!ctx || !bus) return;
    const t = ctx.currentTime + 0.02;
    [0, 0.085, 0.16, 0.225, 0.28, 0.33].forEach((dt, i) =>
      this.tung(t + dt, 0.82 + i * 0.03, i % 2 ? 0.3 : -0.3, { roll: true, golden }),
    );
    this.tung(t + 0.42, 1, 0, { accent: true, golden });
    this.partial(bus, 'sine', 110, 55, t + 0.42, 0.55, 0.35, 0.18);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.partial(bus, 'triangle', f, f, t + 0.52 + i * 0.07, 0.14, 0.32, 0),
    );
    if (golden) {
      [1567.98, 2093, 2637.02, 3135.96].forEach((f, i) =>
        this.partial(bus, 'sine', f, f, t + 0.86 + i * 0.05, 0.07, 0.6, 0),
      );
    }
  }

  /** Countdown blip. */
  tick(urgent: boolean): void {
    if (!this.ctx || !this.bus) return;
    const f = urgent ? 1320 : 990;
    this.partial(this.bus, 'sine', f, f, this.ctx.currentTime + 0.01, 0.16, 0.07, 0);
  }

  /** Two-note chime for a new level. */
  chime(): void {
    if (!this.ctx || !this.bus) return;
    const t = this.ctx.currentTime + 0.02;
    [783.99, 1174.66].forEach((f, i) => this.partial(this.bus!, 'triangle', f, f, t + i * 0.09, 0.12, 0.3, 0));
  }

  /** Gentle descending tune when the sun comes up. */
  dawn(): void {
    if (!this.ctx || !this.bus) return;
    const t = this.ctx.currentTime + 0.05;
    [659.25, 523.25, 440, 349.23].forEach((f, i) =>
      this.partial(this.bus!, 'triangle', f, f * 0.99, t + i * 0.17, 0.15, i === 3 ? 0.9 : 0.35, 0.05),
    );
  }

  /** "Tung, tung, tung" from left, center and right, for the sound check. */
  sample(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.05;
    [-0.8, 0, 0.8].forEach((pan, i) => this.tung(t + i * 0.24, 0.7, pan, { accent: i === 0 }));
  }

  /** Speech is a bonus: an Indonesian voice if the device has one. */
  say(text: string): void {
    if (!this.on || !('speechSynthesis' in window)) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('id'));
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      utterance.rate = 1.15;
      utterance.pitch = 0.7;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    } catch {
      // Ignore: some browsers expose the API without voices.
    }
  }

  cancelSpeech(): void {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  /** gain → lowpass → pan → bus, disconnected once the hit has rung out. */
  private chain(bus: AudioNode, gain: number, cutoff: number, pan: number) {
    const ctx = this.ctx!;
    const input = new GainNode(ctx, { gain });
    const tone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: cutoff, Q: 0.6 });
    const panner = new StereoPannerNode(ctx, { pan: clamp(pan, -1, 1) });
    input.connect(tone).connect(panner).connect(bus);
    return { input, release: () => panner.disconnect() };
  }

  private partial(
    dest: AudioNode,
    type: Wave,
    from: number,
    to: number,
    at: number,
    peak: number,
    decay: number,
    bend: number,
    onEnd?: () => void,
  ): void {
    const ctx = this.ctx!;
    const osc = new OscillatorNode(ctx, { type, frequency: from });
    if (bend > 0 && to !== from) {
      osc.frequency.setValueAtTime(from, at);
      osc.frequency.exponentialRampToValueAtTime(to, at + bend);
    }
    const env = new GainNode(ctx, { gain: 0 });
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.002);
    env.gain.setTargetAtTime(0, at + 0.002, decay / 4);
    osc.connect(env).connect(dest);
    osc.start(at);
    osc.stop(at + decay * 1.25 + 0.03);
    osc.onended = () => {
      env.disconnect();
      onEnd?.();
    };
  }

  private click(dest: AudioNode, at: number, frequency: number, peak: number, decay: number): void {
    const ctx = this.ctx!;
    if (!this.noise) return;
    const src = new AudioBufferSourceNode(ctx, { buffer: this.noise });
    const band = new BiquadFilterNode(ctx, { type: 'bandpass', frequency, Q: 1.1 });
    const env = new GainNode(ctx, { gain: 0 });
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.001);
    env.gain.setTargetAtTime(0, at + 0.001, decay / 4);
    src.connect(band).connect(env).connect(dest);
    src.start(at, Math.random() * 0.1);
    src.stop(at + decay * 1.3 + 0.02);
    src.onended = () => env.disconnect();
  }
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
