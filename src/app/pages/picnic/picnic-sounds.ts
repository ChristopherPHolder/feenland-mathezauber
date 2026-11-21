import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';

export type PicnicSound =
  | 'start'
  | 'snip'
  | 'unsnip'
  | 'share'
  | 'munch'
  | 'heart'
  | 'oops'
  | 'deal'
  | 'ants'
  | 'trumpet'
  | 'jingle';

/**
 * The picnic's sounds, synthesised so nothing downloads: scissors snipping, slices sliding to
 * the plates, munching, a heart bell that climbs with the streak, a wobble for a slip, berries
 * plinking onto plates, the ants' little march when they arrive, the golden-spoon fanfare and a
 * finish jingle. Component-scoped, so leaving the game frees the audio. Shares the sound switch
 * with the other games.
 */
@Injectable()
export class PicnicSounds {
  private readonly settings = inject(PlaytestStore);
  private context?: AudioContext;
  private noise?: AudioBuffer;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      void this.context?.close().catch(() => undefined);
    });
  }

  get enabled() {
    return this.settings.audio().effects;
  }

  toggle() {
    this.settings.toggle('effects');
  }

  /** `level` lifts the heart bell with the streak; for deal it is the handful. */
  play(kind: PicnicSound, level = 0) {
    if (!this.enabled || this.destroyed || typeof AudioContext === 'undefined') return;
    void this.schedule(kind, level).catch(() => undefined);
  }

  private async schedule(kind: PicnicSound, level: number) {
    this.context ??= new AudioContext();
    const c = this.context;
    if (c.state !== 'running') await c.resume();
    if (this.destroyed || !this.enabled || c.state !== 'running') return;
    const t = c.currentTime + 0.02;
    switch (kind) {
      case 'start':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.09, 0.2, 'triangle', 0.06));
        break;
      case 'snip':
        this.hiss(t, 0.05, 3400, 0.16);
        this.hiss(t + 0.07, 0.05, 3000, 0.12);
        break;
      case 'unsnip':
        this.tone(520, t, 0.1, 'sine', 0.05, 390);
        break;
      case 'share':
        this.hiss(t, 0.3, 700, 0.06, 2000);
        [659, 784].forEach((f, i) => this.tone(f, t + 0.1 + i * 0.08, 0.14, 'sine', 0.06));
        break;
      case 'munch':
        for (let i = 0; i < 3; i++) this.hiss(t + i * 0.12, 0.06, 900 + i * 200, 0.14);
        break;
      case 'heart': {
        const lift = 2 ** (Math.min(level, 6) / 12);
        this.bell(880 * lift, t);
        this.bell(1318 * lift, t + 0.12);
        break;
      }
      case 'oops':
        this.tone(330, t, 0.14, 'triangle', 0.06, 290);
        this.tone(300, t + 0.15, 0.2, 'triangle', 0.06, 240);
        break;
      case 'deal':
        for (let i = 0; i < Math.min(4, Math.max(1, level)); i++)
          this.tone(1200 + i * 140, t + i * 0.05, 0.08, 'sine', 0.05);
        break;
      case 'ants':
        for (let i = 0; i < 6; i++)
          this.tone(i % 2 ? 1500 : 1700, t + i * 0.07, 0.03, 'square', 0.015);
        break;
      case 'trumpet':
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone(f, t + i * 0.11, i === 3 ? 0.5 : 0.14, 'sawtooth', 0.035),
        );
        break;
      case 'jingle':
        [784, 988, 1175, 1568, 1318, 1568].forEach((f, i) => this.bell(f, t + i * 0.12));
        break;
    }
  }

  private tone(
    frequency: number,
    time: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.07,
    slideTo?: number,
  ) {
    const c = this.context!;
    const oscillator = c.createOscillator();
    const gain = c.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, time + duration);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain).connect(c.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }

  /** A bell: a pure tone with a soft overtone and a long ring. */
  private bell(frequency: number, time: number) {
    this.tone(frequency, time, 0.6, 'sine', 0.06);
    this.tone(frequency * 2.76, time, 0.25, 'sine', 0.015);
  }

  /** Filtered noise: snips, munching and sliding plates. */
  private hiss(time: number, duration: number, frequency: number, volume: number, to?: number) {
    const c = this.context!;
    this.noise ??= (() => {
      const buffer = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      return buffer;
    })();
    const source = c.createBufferSource();
    source.buffer = this.noise;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, time);
    if (to) filter.frequency.exponentialRampToValueAtTime(to, time + duration);
    filter.Q.value = 1.2;
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(filter).connect(gain).connect(c.destination);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(time);
    source.stop(time + duration + 0.02);
  }
}
