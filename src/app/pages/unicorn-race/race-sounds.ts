import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';
export type RaceSound =
  'count' | 'go' | 'gallop' | 'rainbow' | 'stumble' | 'overtake' | 'win' | 'finish';
/** Component-scoped so leaving the race releases the audio context. Shares the effects preference. */
@Injectable()
export class RaceSounds {
  private readonly settings = inject(PlaytestStore);
  private context?: AudioContext;
  private readonly voices = new Set<OscillatorNode>();
  private nextStart = 0;
  private generation = 0;
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
  /** Creates or resumes the context inside a user gesture so later cues are allowed to play. */
  unlock() {
    if (!this.enabled || this.destroyed) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch {
      /* The race is fully playable without audio. */
    }
  }
  play(kind: RaceSound) {
    if (!this.enabled || this.destroyed) return;
    // A new answer cue replaces stale feedback; fanfares queue after the cue.
    if (kind === 'gallop' || kind === 'stumble' || kind === 'count' || kind === 'go')
      this.silence();
    void this.schedule(kind, this.generation).catch(() => undefined);
  }
  private async schedule(kind: RaceSound, generation: number) {
    this.context ??= new AudioContext();
    const context = this.context;
    if (context.state !== 'running') await context.resume();
    if (
      this.destroyed ||
      !this.enabled ||
      generation !== this.generation ||
      context.state !== 'running'
    )
      return;
    const notes: Record<RaceSound, readonly number[]> = {
      count: [440],
      go: [660, 880],
      gallop: [523, 659, 784],
      rainbow: [659, 784, 988, 1319],
      stumble: [262, 175],
      overtake: [784, 1047],
      win: [523, 659, 784, 1047, 1319],
      finish: [392, 494, 587, 784],
    };
    const answer = kind === 'gallop' || kind === 'stumble';
    const step = answer ? 0.12 : kind === 'count' || kind === 'go' ? 0.2 : 0.14;
    const length = answer ? 0.13 : kind === 'count' ? 0.18 : 0.3;
    const start = Math.max(context.currentTime + 0.02, this.nextStart);
    notes[kind].forEach((frequency, index) =>
      this.tone(context, frequency, length, start + index * step, kind === 'stumble'),
    );
    this.nextStart = start + (notes[kind].length - 1) * step + length + 0.06;
  }
  private silence() {
    this.generation++;
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
    this.nextStart = 0;
  }
  private tone(
    context: AudioContext,
    frequency: number,
    duration: number,
    time: number,
    wrong: boolean,
  ) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wrong || frequency < 200 ? 'triangle' : 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.07, time + 0.02);
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
