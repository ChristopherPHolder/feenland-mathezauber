import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';

export type GondolaSound =
  | 'start'
  | 'hop'
  | 'door'
  | 'bell'
  | 'bounce'
  | 'jam'
  | 'chime'
  | 'slip'
  | 'brrr'
  | 'whistle'
  | 'swap'
  | 'win';

interface Voice {
  readonly notes: readonly number[];
  readonly step: number;
  readonly length: number;
  readonly wave: OscillatorType;
  /** Each note slides to this share of its pitch, for boings and whooshes. */
  readonly slide?: number;
}

const voices: Record<GondolaSound, Voice> = {
  start: { notes: [523, 659, 784], step: 0.1, length: 0.25, wave: 'sine' },
  hop: { notes: [392, 587], step: 0.08, length: 0.16, wave: 'sine', slide: 1.5 },
  door: { notes: [147, 110], step: 0.06, length: 0.14, wave: 'triangle' },
  bell: { notes: [1319, 1319, 988], step: 0.16, length: 0.5, wave: 'sine' },
  bounce: { notes: [330, 220], step: 0.12, length: 0.22, wave: 'triangle', slide: 0.5 },
  jam: { notes: [196, 196], step: 0.14, length: 0.1, wave: 'square' },
  chime: { notes: [784, 988, 1175], step: 0.09, length: 0.3, wave: 'sine' },
  slip: { notes: [392, 349], step: 0.14, length: 0.24, wave: 'triangle' },
  brrr: { notes: [262, 247, 233, 220], step: 0.06, length: 0.12, wave: 'triangle' },
  whistle: { notes: [1568, 2093], step: 0.18, length: 0.32, wave: 'sine', slide: 1.12 },
  swap: { notes: [659, 523], step: 0.08, length: 0.14, wave: 'sine' },
  win: { notes: [523, 659, 784, 1047, 1319], step: 0.12, length: 0.32, wave: 'sine' },
};

/**
 * Synthesized gondola sounds: hop boings, the door clunk, the departure bell, a summit chime
 * that climbs with the streak, a soft brrr for cold cocoa, the express whistle and a jingle.
 * Component-scoped so leaving the game releases the audio context; it follows the effects
 * switch and unlocks on the first tap (the start button).
 */
@Injectable()
export class GondolaSounds {
  private readonly settings = inject(PlaytestStore);
  private context?: AudioContext;
  private readonly playing = new Set<OscillatorNode>();
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

  /** `lift` raises the pitch by semitones, so the summit chime climbs with the streak. */
  play(kind: GondolaSound, lift = 0) {
    if (!this.enabled || this.destroyed || typeof AudioContext === 'undefined') return;
    void this.schedule(kind, lift).catch(() => undefined);
  }

  private async schedule(kind: GondolaSound, lift: number) {
    this.context ??= new AudioContext();
    const context = this.context;
    if (context.state !== 'running') await context.resume();
    if (this.destroyed || !this.enabled || context.state !== 'running') return;
    const voice = voices[kind];
    const shift = 2 ** (Math.min(lift, 12) / 12);
    const start = context.currentTime + 0.02;
    voice.notes.forEach((frequency, index) =>
      this.tone(context, voice, frequency * shift, start + index * voice.step),
    );
  }

  private silence() {
    for (const voice of this.playing) voice.stop();
    this.playing.clear();
  }

  private tone(context: AudioContext, voice: Voice, frequency: number, time: number) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = voice.wave;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (voice.slide)
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * voice.slide,
        time + voice.length,
      );
    const peak = voice.wave === 'square' ? 0.03 : 0.07;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + voice.length);
    oscillator.connect(gain);
    gain.connect(context.destination);
    this.playing.add(oscillator);
    oscillator.onended = () => {
      this.playing.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(time);
    oscillator.stop(time + voice.length);
  }
}
