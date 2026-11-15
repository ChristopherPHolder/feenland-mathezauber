import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';
import { coinsAt, KEY_START, KEY_STEP } from './lock-reward';

export type LockSound = 'start' | 'hop' | 'thorn' | 'gem' | 'sand' | 'win';
export type LockFanfare = 'open' | 'perfect' | 'fever';

/** One note: when it starts (seconds from now), how long it rings and how loud it is. */
export interface Note {
  readonly frequency: number;
  readonly at: number;
  readonly length: number;
  readonly gain: number;
  readonly wave: OscillatorType;
  /** A quiet octave above, for the shine of a bell or a coin. */
  readonly shine?: boolean;
}

const run = (
  frequencies: readonly number[],
  step: number,
  length: number,
  gain: number,
  wave: OscillatorType = 'sine',
  from = 0,
): Note[] =>
  frequencies.map((frequency, index) => ({
    frequency,
    at: from + index * step,
    length,
    gain,
    wave,
  }));

const cues: Record<LockSound, readonly Note[]> = {
  start: run([523, 784], 0.12, 0.28, 0.07),
  hop: run([660, 880], 0.07, 0.12, 0.07),
  thorn: run([233, 175], 0.07, 0.12, 0.07, 'triangle'),
  gem: run([1319, 1568, 2093], 0.12, 0.28, 0.08),
  sand: run([392, 330, 262], 0.12, 0.28, 0.07, 'triangle'),
  win: run([523, 659, 784, 1047, 1319], 0.12, 0.32, 0.1),
};

const fanfares: Record<LockFanfare, readonly number[]> = {
  open: [523, 659, 784, 1047],
  perfect: [523, 659, 784, 1047, 1319],
  fever: [659, 784, 988, 1319, 1568],
};

/** Each key rings a step higher, so three keys climb up the chord. */
const KEY_BELLS = [1568, 1976, 2349];

/**
 * The sound of a chest opening: the lock clunks, a fanfare plays, a bell rings as each golden
 * key pops into the reward card, and the coins jingle when they arrive.
 */
export function rewardNotes(fanfare: LockFanfare, keys: number): Note[] {
  const clunk: Note[] = [
    { frequency: 147, at: 0, length: 0.09, gain: 0.16, wave: 'triangle' },
    { frequency: 294, at: 0.06, length: 0.12, gain: 0.13, wave: 'triangle' },
  ];
  const notes = fanfares[fanfare];
  const tune = run(notes, 0.08, 0.3, 0.11, 'sine', 0.1).map((note, index) =>
    index === notes.length - 1 ? { ...note, length: 0.6, shine: true } : note,
  );
  const bells = KEY_BELLS.slice(0, keys).map<Note>((frequency, index) => ({
    frequency,
    at: KEY_START + index * KEY_STEP,
    length: 0.55,
    gain: 0.1,
    wave: 'sine',
    shine: true,
  }));
  const jingle = run([2093, 2637, 3136, 2637], 0.05, 0.14, 0.05, 'sine', coinsAt(keys));
  return [...clunk, ...tune, ...bells, ...jingle];
}

/** Component-scoped so leaving the game releases the audio context. Shares the effects switch. */
@Injectable()
export class LockSounds {
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

  play(kind: LockSound) {
    this.schedule(cues[kind]);
  }

  /** The chest-opening celebration, timed to the keys popping into the reward card. */
  reward(fanfare: LockFanfare, keys: number) {
    this.schedule(rewardNotes(fanfare, keys));
  }

  private schedule(notes: readonly Note[]) {
    if (!this.enabled || this.destroyed || typeof AudioContext === 'undefined') return;
    void this.ring(notes).catch(() => undefined);
  }

  private async ring(notes: readonly Note[]) {
    this.context ??= new AudioContext();
    const context = this.context;
    if (context.state !== 'running') await context.resume();
    if (this.destroyed || !this.enabled || context.state !== 'running') return;
    const start = context.currentTime + 0.02;
    for (const note of notes) {
      this.tone(context, note.frequency, note.length, start + note.at, note.gain, note.wave);
      if (note.shine)
        this.tone(context, note.frequency * 2, note.length, start + note.at, note.gain / 3, 'sine');
    }
  }

  private silence() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }

  private tone(
    context: AudioContext,
    frequency: number,
    duration: number,
    time: number,
    peak: number,
    wave: OscillatorType,
  ) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(time);
    oscillator.stop(time + duration);
  }
}
