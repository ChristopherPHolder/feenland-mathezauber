import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';

export type MarketSound =
  | 'start'
  | 'coin'
  | 'back'
  | 'till'
  | 'nope'
  | 'slip'
  | 'chime'
  | 'putBack'
  | 'sunset'
  | 'win';

interface Voice {
  readonly notes: readonly number[];
  readonly step: number;
  readonly length: number;
  readonly wave: OscillatorType;
  /** Each note slides to this share of its pitch, for boings and whooshes. */
  readonly slide?: number;
}

const voices: Record<MarketSound, Voice> = {
  start: { notes: [523, 659, 784], step: 0.1, length: 0.25, wave: 'sine' },
  coin: { notes: [1976, 2637], step: 0.05, length: 0.12, wave: 'triangle' },
  back: { notes: [1760, 1319], step: 0.05, length: 0.1, wave: 'triangle' },
  till: { notes: [1568, 2093, 2637], step: 0.07, length: 0.4, wave: 'sine' },
  nope: { notes: [440, 392], step: 0.12, length: 0.2, wave: 'triangle' },
  slip: { notes: [392, 349], step: 0.14, length: 0.24, wave: 'triangle' },
  chime: { notes: [784, 988, 1175], step: 0.09, length: 0.3, wave: 'sine' },
  putBack: { notes: [523, 392], step: 0.1, length: 0.18, wave: 'sine', slide: 0.8 },
  sunset: { notes: [659, 587, 523, 440], step: 0.18, length: 0.4, wave: 'sine' },
  win: { notes: [523, 659, 784, 1047, 1319], step: 0.12, length: 0.32, wave: 'sine' },
};

/**
 * Synthesized market sounds: coin clinks, the till's ka-ching, a soft "not quite", a chime
 * that climbs with the streak, a falling tune at sunset and a jingle at the end.
 * Component-scoped so leaving the game releases the audio context; it follows the effects
 * switch and unlocks on the first tap (the start button).
 */
@Injectable()
export class MarketSounds {
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

  /** `lift` raises the pitch by semitones, so the chime climbs with the streak. */
  play(kind: MarketSound, lift = 0) {
    if (!this.enabled || this.destroyed || typeof AudioContext === 'undefined') return;
    void this.schedule(kind, lift).catch(() => undefined);
  }

  private async schedule(kind: MarketSound, lift: number) {
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
