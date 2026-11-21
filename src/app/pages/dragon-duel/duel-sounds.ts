import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';

export type DuelSound = 'start' | 'attack' | 'critical' | 'giggle' | 'zap' | 'win' | 'nap';

const NOTES: Readonly<Record<DuelSound, readonly number[]>> = {
  start: [392, 523, 659],
  attack: [523, 784],
  critical: [523, 784, 1047, 1319],
  giggle: [880, 784, 880],
  zap: [220, 165, 131],
  win: [523, 659, 784, 1047, 1319],
  nap: [392, 330, 262],
};

/** Little synth jingles for the duel. Component-scoped; shares the sound-effects switch. */
@Injectable()
export class DuelSounds {
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

  play(kind: DuelSound) {
    if (!this.enabled || this.destroyed || typeof AudioContext === 'undefined') return;
    void this.schedule(kind).catch(() => undefined);
  }

  private async schedule(kind: DuelSound) {
    this.context ??= new AudioContext();
    const context = this.context;
    if (context.state !== 'running') await context.resume();
    if (this.destroyed || !this.enabled || context.state !== 'running') return;
    const quick = kind === 'giggle' || kind === 'attack';
    const step = quick ? 0.08 : 0.11;
    const start = context.currentTime + 0.02;
    NOTES[kind].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === 'zap' || kind === 'nap' ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      const at = start + index * step;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.08, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.24);
      oscillator.connect(gain);
      gain.connect(context.destination);
      this.voices.add(oscillator);
      oscillator.onended = () => {
        this.voices.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(at);
      oscillator.stop(at + 0.26);
    });
  }

  private silence() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }
}
