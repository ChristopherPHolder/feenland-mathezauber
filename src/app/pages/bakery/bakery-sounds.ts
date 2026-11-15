import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';

export type BakerySound =
  | 'start'
  | 'knife'
  | 'chop'
  | 'slide'
  | 'pop'
  | 'oops'
  | 'oven'
  | 'ding'
  | 'crunch'
  | 'boing'
  | 'timer'
  | 'trumpet'
  | 'jingle';

/**
 * The bakery's sounds, synthesised so nothing downloads: a knife chop, trays sliding, the oven
 * door, a bake ding that climbs with the streak, the dragon's crunch, the twins' boing-boing,
 * the timer's ding-ding, the golden-oven trumpet and a finish jingle. Component-scoped, so
 * leaving the game frees the audio. Shares the sound-effects switch with the other games.
 */
@Injectable()
export class BakerySounds {
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

  /** `level` lifts the bake ding with the streak. */
  play(kind: BakerySound, level = 0) {
    if (!this.enabled || this.destroyed || typeof AudioContext === 'undefined') return;
    void this.schedule(kind, level).catch(() => undefined);
  }

  private async schedule(kind: BakerySound, level: number) {
    this.context ??= new AudioContext();
    const c = this.context;
    if (c.state !== 'running') await c.resume();
    if (this.destroyed || !this.enabled || c.state !== 'running') return;
    const t = c.currentTime + 0.02;
    switch (kind) {
      case 'start':
        [523, 659, 784].forEach((f, i) => this.tone(f, t + i * 0.1, 0.22));
        break;
      case 'knife':
        this.tone(1320, t, 0.05, 'triangle', 0.04);
        break;
      case 'chop':
        this.hiss(t, 0.07, 2600, 0.18);
        this.tone(140, t, 0.12, 'sine', 0.12, 70);
        break;
      case 'slide':
        this.hiss(t, 0.35, 900, 0.07, 2400);
        break;
      case 'pop':
        this.tone(660, t, 0.12, 'sine', 0.08, 990);
        break;
      case 'oops':
        this.tone(330, t, 0.18, 'triangle', 0.06, 247);
        break;
      case 'oven':
        this.tone(110, t, 0.35, 'sawtooth', 0.025, 82);
        this.hiss(t + 0.25, 0.12, 500, 0.08);
        break;
      case 'ding': {
        const lift = 2 ** (Math.min(level, 6) / 12);
        this.bell(1046 * lift, t);
        this.bell(1318 * lift, t + 0.12);
        break;
      }
      case 'crunch':
        for (let i = 0; i < 4; i++) this.hiss(t + i * 0.09, 0.05, 1800 + i * 300, 0.16);
        break;
      case 'boing':
        this.tone(300, t, 0.2, 'sine', 0.09, 620);
        this.tone(340, t + 0.22, 0.2, 'sine', 0.09, 700);
        break;
      case 'timer':
        this.bell(1568, t);
        this.bell(1568, t + 0.28);
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

  /** Filtered noise: knife chops, crunches and sliding trays. */
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
