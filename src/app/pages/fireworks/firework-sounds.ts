import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';

export type FireworkSound =
  | 'start'
  | 'whoosh'
  | 'pop'
  | 'aah'
  | 'fizzle'
  | 'peek'
  | 'spotter'
  | 'bigShow'
  | 'finale'
  | 'show';

/** The loudest any voice gets: pops and crackles stay soft, never a bang. */
const PEAK = 0.06;

/**
 * Soft synthesized festival sounds: a rocket whoosh, a soft pop with a crackle, a crowd "aah",
 * a gentle fizzle, the telescope click, a Big-show fanfare and a finale medley. Component-scoped
 * so leaving the game releases the audio context. Shares the effects switch with every game.
 */
@Injectable()
export class FireworkSounds {
  private readonly settings = inject(PlaytestStore);
  private context?: AudioContext;
  private readonly voices = new Set<AudioScheduledSourceNode>();
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

  play(kind: FireworkSound) {
    if (!this.enabled || this.destroyed || typeof AudioContext === 'undefined') return;
    void this.schedule(kind).catch(() => undefined);
  }

  private async schedule(kind: FireworkSound) {
    this.context ??= new AudioContext();
    const c = this.context;
    if (c.state !== 'running') await c.resume();
    if (this.destroyed || !this.enabled || c.state !== 'running') return;
    const now = c.currentTime + 0.02;
    switch (kind) {
      case 'start':
        this.notes(c, [523, 659, 784], now, 0.1, 0.22);
        break;
      case 'whoosh':
        this.noise(c, now, 0.8, 900, 2600, 0.6);
        break;
      case 'pop':
        this.noise(c, now, 0.12, 1800, 1800, 0.7);
        // A few soft crackles as the sparks open.
        for (let i = 0; i < 5; i++) this.noise(c, now + 0.12 + i * 0.07, 0.04, 3500, 3500, 0.35);
        this.notes(c, [880], now + 0.02, 0, 0.3, 0.5);
        break;
      case 'aah':
        this.notes(c, [392, 494, 587], now, 0.05, 0.7, 0.6);
        this.notes(c, [784, 988, 1175], now + 0.1, 0.08, 0.3);
        break;
      case 'fizzle':
        this.noise(c, now, 0.5, 1200, 300, 0.5);
        this.notes(c, [330, 262], now + 0.1, 0.15, 0.25, 0.6, 'triangle');
        break;
      case 'peek':
        this.notes(c, [1568, 2093], now, 0.06, 0.08, 0.6);
        break;
      case 'spotter':
        this.notes(c, [1175, 1568], now, 0.08, 0.14, 0.7);
        break;
      case 'bigShow':
        this.notes(c, [523, 659, 784, 1047, 1319], now, 0.09, 0.25);
        break;
      case 'finale':
        this.notes(c, [392, 523, 659, 784, 1047], now, 0.12, 0.3);
        break;
      case 'show':
        for (let i = 0; i < 6; i++) this.noise(c, now + i * 0.35, 0.12, 1800, 1800, 0.5);
        this.notes(c, [523, 659, 784, 659, 784, 1047, 1319], now, 0.18, 0.32);
        break;
    }
  }

  private silence() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }

  private track(node: AudioScheduledSourceNode, gain: GainNode, filter?: BiquadFilterNode) {
    this.voices.add(node);
    node.onended = () => {
      this.voices.delete(node);
      node.disconnect();
      filter?.disconnect();
      gain.disconnect();
    };
  }

  private notes(
    c: AudioContext,
    frequencies: readonly number[],
    start: number,
    step: number,
    length: number,
    level = 1,
    type: OscillatorType = 'sine',
  ) {
    frequencies.forEach((frequency, index) => {
      const time = start + index * step;
      const oscillator = c.createOscillator();
      const gain = c.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(PEAK * level, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + length);
      oscillator.connect(gain).connect(c.destination);
      this.track(oscillator, gain);
      oscillator.start(time);
      oscillator.stop(time + length);
    });
  }

  /** Filtered noise: a whoosh sweeping from `from` to `to` Hz, or a short pop when they match. */
  private noise(
    c: AudioContext,
    time: number,
    length: number,
    from: number,
    to: number,
    level: number,
  ) {
    const frames = Math.max(1, Math.round(c.sampleRate * length));
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource();
    source.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, time);
    filter.frequency.exponentialRampToValueAtTime(to, time + length);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(PEAK * level, time + Math.min(0.05, length / 3));
    gain.gain.exponentialRampToValueAtTime(0.001, time + length);
    source.connect(filter).connect(gain).connect(c.destination);
    this.track(source, gain, filter);
    source.start(time);
    source.stop(time + length);
  }
}
