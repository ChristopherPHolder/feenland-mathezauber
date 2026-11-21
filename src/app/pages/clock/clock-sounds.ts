import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';

export type ClockSound =
  | 'start'
  | 'tick'
  | 'tock'
  | 'bell'
  | 'chime'
  | 'flutter'
  | 'slip'
  | 'puff'
  | 'golden'
  | 'win';

interface Voice {
  readonly notes: readonly number[];
  readonly step: number;
  readonly length: number;
  readonly wave: OscillatorType;
  /** Each note slides to this share of its pitch. */
  readonly slide?: number;
  readonly peak?: number;
}

const voices: Record<ClockSound, Voice> = {
  start: { notes: [392, 523, 659, 784], step: 0.1, length: 0.3, wave: 'sine' },
  tick: { notes: [1760], step: 0, length: 0.04, wave: 'square', peak: 0.02 },
  tock: { notes: [1320], step: 0, length: 0.05, wave: 'square', peak: 0.02 },
  // A bronze bell: a low strike with a long hum and an overtone.
  bell: { notes: [392, 784, 392], step: 0.02, length: 1.6, wave: 'sine', peak: 0.09 },
  chime: { notes: [784, 988, 1175, 1568], step: 0.09, length: 0.35, wave: 'sine' },
  flutter: {
    notes: [880, 1175, 988, 1319],
    step: 0.05,
    length: 0.08,
    wave: 'triangle',
    slide: 1.3,
  },
  slip: { notes: [392, 330], step: 0.14, length: 0.24, wave: 'triangle' },
  puff: { notes: [220, 160], step: 0.08, length: 0.3, wave: 'triangle', slide: 0.6 },
  golden: { notes: [1047, 1319, 1568, 2093], step: 0.08, length: 0.3, wave: 'sine' },
  win: { notes: [523, 659, 784, 1047, 784, 1047, 1319], step: 0.12, length: 0.34, wave: 'sine' },
};

/**
 * Synthesized tower sounds: soft ticks while the hands move, the bronze bell for a right time,
 * a chime that climbs with the streak, the flutter of a creature flying up, a puff when the
 * candle goes out and the end-of-day tune. Component-scoped so leaving the game releases the
 * audio context; it follows the effects switch and unlocks on the first tap (the start button).
 */
@Injectable()
export class ClockSounds {
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
  play(kind: ClockSound, lift = 0) {
    if (!this.enabled || this.destroyed || typeof AudioContext === 'undefined') return;
    void this.schedule(kind, lift).catch(() => undefined);
  }

  private async schedule(kind: ClockSound, lift: number) {
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
    const peak = voice.peak ?? (voice.wave === 'square' ? 0.03 : 0.07);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.01);
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
