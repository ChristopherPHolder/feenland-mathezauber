import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';

export type PotionSound =
  'start' | 'pick' | 'pour' | 'fizzle' | 'moon' | 'brew' | 'perfect' | 'fever' | 'sand' | 'win';

const notes: Record<PotionSound, readonly number[]> = {
  start: [523, 784],
  pick: [880],
  pour: [587, 740, 880],
  fizzle: [311, 233, 175],
  moon: [1568, 2093],
  brew: [523, 659, 784],
  perfect: [659, 784, 988, 1319],
  fever: [784, 988, 1175, 1568],
  sand: [392, 330, 262],
  win: [523, 659, 784, 1047, 1319],
};

/** Component-scoped so leaving the game releases the audio context. Shares the effects switch. */
@Injectable()
export class PotionSounds {
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

  play(kind: PotionSound) {
    if (!this.enabled || this.destroyed || typeof AudioContext === 'undefined') return;
    void this.schedule(kind).catch(() => undefined);
  }

  private async schedule(kind: PotionSound) {
    this.context ??= new AudioContext();
    const context = this.context;
    if (context.state !== 'running') await context.resume();
    if (this.destroyed || !this.enabled || context.state !== 'running') return;
    const quick = kind === 'pick' || kind === 'pour';
    const step = quick ? 0.07 : 0.12;
    const length = quick ? 0.12 : 0.28;
    const start = context.currentTime + 0.02;
    notes[kind].forEach((frequency, index) =>
      this.tone(
        context,
        frequency,
        length,
        start + index * step,
        kind === 'fizzle' || kind === 'sand',
      ),
    );
  }

  private silence() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }

  private tone(
    context: AudioContext,
    frequency: number,
    duration: number,
    time: number,
    low: boolean,
  ) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = low ? 'triangle' : 'sine';
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
