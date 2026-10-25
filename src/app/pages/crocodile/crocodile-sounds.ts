import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';
export type CrocodileSound =
  'start' | 'chomp' | 'wrong' | 'win' | 'splash' | 'combo' | 'frenzy' | 'golden' | 'boss' | 'hat';
/** Component-scoped so leaving the game releases the audio context. Shares the effects preference. */
@Injectable()
export class CrocodileSounds {
  private readonly settings = inject(PlaytestStore);
  private context?: AudioContext;
  constructor() {
    inject(DestroyRef).onDestroy(() => void this.context?.close().catch(() => undefined));
  }
  get enabled() {
    return this.settings.audio().effects;
  }
  toggle() {
    this.settings.toggle('effects');
  }
  play(kind: CrocodileSound) {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch {
      return; /* The game stays fully playable without Web Audio. */
    }
    const notes: Record<CrocodileSound, readonly number[]> = {
      start: [523, 784],
      chomp: [196, 147],
      wrong: [330, 262],
      win: [523, 659, 784, 1047],
      splash: [880, 440, 220],
      combo: [659, 880],
      frenzy: [659, 880, 1109, 1319],
      golden: [1047, 1319, 1568],
      boss: [110, 98, 87, 110],
      hat: [784, 988, 1175, 1568],
    };
    const step = kind === 'chomp' || kind === 'splash' ? 0.1 : kind === 'boss' ? 0.22 : 0.13;
    const length = kind === 'chomp' ? 0.16 : kind === 'boss' ? 0.4 : 0.3;
    notes[kind].forEach((frequency, index) => this.tone(frequency, length, index * step));
  }
  private tone(frequency: number, duration: number, delay: number) {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const time = context.currentTime + delay;
    oscillator.type = frequency < 200 ? 'triangle' : 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.07, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + duration);
  }
}
