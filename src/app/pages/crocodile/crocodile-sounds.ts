import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';
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
  play(kind: 'start' | 'chomp' | 'wrong' | 'win') {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch {
      return; /* The game stays fully playable without Web Audio. */
    }
    const notes = {
      start: [523, 784],
      chomp: [196, 147],
      wrong: [330, 262],
      win: [523, 659, 784, 1047],
    }[kind];
    notes.forEach((frequency, index) =>
      this.tone(frequency, kind === 'chomp' ? 0.16 : 0.3, index * (kind === 'chomp' ? 0.1 : 0.13)),
    );
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
