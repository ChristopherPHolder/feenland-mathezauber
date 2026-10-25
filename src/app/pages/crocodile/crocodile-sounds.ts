import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';
export type CrocodileSound =
  'start' | 'chomp' | 'wrong' | 'win' | 'splash' | 'combo' | 'frenzy' | 'golden' | 'boss' | 'hat';
/** Component-scoped so leaving the game releases the audio context. Shares the effects preference. */
@Injectable()
export class CrocodileSounds {
  private readonly settings = inject(PlaytestStore);
  private context?: AudioContext;
  private readonly voices = new Set<OscillatorNode>();
  private nextStart = 0;
  private generation = 0;
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
  play(kind: CrocodileSound) {
    if (!this.enabled || this.destroyed) return;
    // A new answer replaces stale feedback; reward jingles follow the answer cue.
    if (kind === 'chomp' || kind === 'splash' || kind === 'wrong' || kind === 'start')
      this.silence();
    void this.schedule(kind, this.generation).catch(() => undefined);
  }
  private async schedule(kind: CrocodileSound, generation: number) {
    this.context ??= new AudioContext();
    const context = this.context;
    if (context.state !== 'running') await context.resume();
    if (
      this.destroyed ||
      !this.enabled ||
      generation !== this.generation ||
      context.state !== 'running'
    )
      return;
    const notes: Record<CrocodileSound, readonly number[]> = {
      start: [523, 784],
      chomp: [523, 659, 784],
      wrong: [262, 175],
      win: [523, 659, 784, 1047],
      splash: [659, 784, 1047],
      combo: [659, 880],
      frenzy: [659, 880, 1109, 1319],
      golden: [1047, 1319, 1568],
      boss: [110, 98, 87, 110],
      hat: [784, 988, 1175, 1568],
    };
    const answer = kind === 'chomp' || kind === 'splash' || kind === 'wrong';
    const step = answer ? 0.16 : kind === 'boss' ? 0.22 : 0.13;
    const length = answer ? 0.14 : kind === 'boss' ? 0.4 : 0.3;
    const start = Math.max(context.currentTime + 0.02, this.nextStart);
    notes[kind].forEach((frequency, index) =>
      this.tone(context, frequency, length, start + index * step, kind === 'wrong'),
    );
    this.nextStart = start + (notes[kind].length - 1) * step + length + 0.06;
  }
  private silence() {
    this.generation++;
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
    this.nextStart = 0;
  }
  private tone(
    context: AudioContext,
    frequency: number,
    duration: number,
    time: number,
    wrong: boolean,
  ) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wrong || frequency < 200 ? 'triangle' : 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.07, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(time);
    oscillator.stop(time + duration);
  }
}
