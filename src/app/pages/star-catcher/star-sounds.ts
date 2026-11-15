import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';

export type StarSound =
  | 'start'
  | 'appear'
  | 'move'
  | 'catch'
  | 'golden'
  | 'bounce'
  | 'drain'
  | 'comet'
  | 'finale'
  | 'constellation';

interface Voice {
  readonly frequency: number;
  readonly at: number;
  readonly length: number;
  readonly type: OscillatorType;
  /** Slide to this frequency over the note: whooshes and boings. */
  readonly to?: number;
  readonly volume?: number;
}

const note = (
  frequency: number,
  at: number,
  length = 0.28,
  type: OscillatorType = 'sine',
  to?: number,
  volume?: number,
): Voice => ({ frequency, at, length, type, to, volume });

/** A rising run, one note every `step` seconds. */
const run = (notes: readonly number[], step: number, length = 0.3, type: OscillatorType = 'sine') =>
  notes.map((frequency, index) => note(frequency, index * step, length, type));

const SOUNDS: Record<Exclude<StarSound, 'catch'>, readonly Voice[]> = {
  start: run([523, 659, 784], 0.1),
  // A soft whoosh as a star appears high in the sky.
  appear: [note(1800, 0, 0.45, 'sine', 900, 0.025)],
  move: [note(1320, 0, 0.05, 'sine', undefined, 0.02)],
  // A gold ting, then a harp run.
  golden: [
    note(2637, 0, 0.5),
    ...run([1047, 1319, 1568, 2093], 0.06, 0.4, 'triangle').map((v) => ({ ...v, at: v.at + 0.12 })),
  ],
  bounce: [note(330, 0, 0.18, 'triangle', 196), note(262, 0.16, 0.16, 'triangle', 220)],
  // The stardust is gone: a falling whoosh.
  drain: [note(700, 0, 0.6, 'triangle', 180, 0.05)],
  comet: run([784, 988, 1175, 1568, 1976], 0.05, 0.25, 'triangle'),
  finale: run([659, 784, 988, 1319], 0.09, 0.35),
  constellation: run([523, 659, 784, 1047, 784, 1047, 1319], 0.13, 0.4),
};

/**
 * Synthesised Web Audio for the star catcher. Component-scoped so leaving the game releases the
 * audio context. It shares the effects switch with the other games.
 */
@Injectable()
export class StarSounds {
  private readonly settings = inject(PlaytestStore);
  private context?: AudioContext;
  private readonly voices = new Set<OscillatorNode>();
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.silence();
      void this.context?.close().catch(() => undefined);
    });
  }

  get enabled() {
    return this.settings.audio().effects;
  }

  toggle() {
    this.settings.toggle('effects');
    if (!this.enabled) this.silence();
  }

  /** `closeness` (0 to 1) raises the catch chime: the tighter the catch, the higher it rings. */
  play(kind: StarSound, closeness = 0) {
    if (!this.enabled || this.destroyed || typeof AudioContext === 'undefined') return;
    const voices =
      kind === 'catch'
        ? run([660 * 2 ** (closeness / 2), 880 * 2 ** (closeness / 2)], 0.08, 0.35)
        : SOUNDS[kind];
    void this.schedule(voices).catch(() => undefined);
  }

  private async schedule(voices: readonly Voice[]) {
    this.context ??= new AudioContext();
    const context = this.context;
    if (context.state !== 'running') await context.resume();
    if (this.destroyed || !this.enabled || context.state !== 'running') return;
    const start = context.currentTime + 0.02;
    for (const voice of voices) this.tone(context, voice, start + voice.at);
  }

  private silence() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }

  private tone(context: AudioContext, voice: Voice, time: number) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = voice.type;
    oscillator.frequency.setValueAtTime(voice.frequency, time);
    if (voice.to) oscillator.frequency.exponentialRampToValueAtTime(voice.to, time + voice.length);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(voice.volume ?? 0.07, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + voice.length);
    oscillator.connect(gain);
    gain.connect(context.destination);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(time);
    oscillator.stop(time + voice.length);
  }
}
