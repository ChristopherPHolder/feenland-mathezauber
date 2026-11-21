import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';

export type ScalesSound =
  | 'start'
  | 'clunk'
  | 'lift'
  | 'creak'
  | 'level'
  | 'glug'
  | 'splash'
  | 'oops'
  | 'tick'
  | 'bubble'
  | 'trumpet'
  | 'jingle';

/**
 * The kitchen's sounds, synthesised so nothing downloads: a brass weight clunking onto a pan,
 * the beam creaking as it tips, a bell when it sits level (climbing with the streak), jugs
 * glugging, a splash into the pot, the soup bubbling over, the hearty-pot trumpet and a finish
 * jingle. Component-scoped, so leaving the game frees the audio. Shares the sound-effects switch
 * with the other games.
 */
@Injectable()
export class ScalesSounds {
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

  /** `level` lifts the bell with the streak, or the clunk with the weight's size. */
  play(kind: ScalesSound, level = 0) {
    if (!this.enabled || this.destroyed || typeof AudioContext === 'undefined') return;
    void this.schedule(kind, level).catch(() => undefined);
  }

  private async schedule(kind: ScalesSound, level: number) {
    this.context ??= new AudioContext();
    const c = this.context;
    if (c.state !== 'running') await c.resume();
    if (this.destroyed || !this.enabled || c.state !== 'running') return;
    const t = c.currentTime + 0.02;
    switch (kind) {
      case 'start':
        [392, 494, 587, 784].forEach((f, i) => this.tone(f, t + i * 0.09, 0.22, 'triangle', 0.06));
        break;
      case 'clunk': {
        // Heavier weights clunk lower.
        const f = 520 - Math.min(1, level) * 260;
        this.tone(f, t, 0.12, 'triangle', 0.09, f * 0.6);
        this.bell(f * 3.1, t, 0.02);
        break;
      }
      case 'lift':
        this.tone(380, t, 0.1, 'triangle', 0.05, 520);
        break;
      case 'creak':
        this.tone(140, t, 0.45, 'sawtooth', 0.02, 95);
        this.hiss(t + 0.3, 0.12, 400, 0.08);
        break;
      case 'level': {
        const lift = 2 ** (Math.min(level, 6) / 12);
        this.bell(880 * lift, t);
        this.bell(1320 * lift, t + 0.14);
        break;
      }
      case 'glug':
        for (let i = 0; i < 3; i++) this.tone(260 + i * 40, t + i * 0.11, 0.1, 'sine', 0.08, 180);
        break;
      case 'splash':
        this.hiss(t, 0.4, 1200, 0.14, 500);
        this.tone(300, t, 0.2, 'sine', 0.06, 120);
        break;
      case 'oops':
        this.tone(330, t, 0.18, 'triangle', 0.06, 247);
        break;
      case 'tick':
        this.tone(1500, t, 0.04, 'square', 0.02);
        break;
      case 'bubble':
        for (let i = 0; i < 6; i++)
          this.tone(200 + Math.random() * 200, t + i * 0.08, 0.07, 'sine', 0.07, 500);
        break;
      case 'trumpet':
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone(f, t + i * 0.11, i === 3 ? 0.5 : 0.14, 'sawtooth', 0.035),
        );
        break;
      case 'jingle':
        [659, 784, 988, 1318, 1175, 1318].forEach((f, i) => this.bell(f, t + i * 0.12));
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
  private bell(frequency: number, time: number, volume = 0.06) {
    this.tone(frequency, time, 0.6, 'sine', volume);
    this.tone(frequency * 2.76, time, 0.25, 'sine', volume / 4);
  }

  /** Filtered noise: splashes and the creak's settle. */
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
