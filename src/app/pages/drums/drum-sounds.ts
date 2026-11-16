import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { PlaytestStore } from '../fairy-defense/playtest-store';

export type DrumEffect =
  | 'start'
  | 'bonk'
  | 'layerUp'
  | 'layerDown'
  | 'verse'
  | 'solo'
  | 'win'
  | 'tap';

/** How often the scheduler wakes, and how far ahead it books notes on the audio clock. */
const TICK_MS = 25;
const LOOKAHEAD = 0.12;
/** A drumroll's stroke spacing, in seconds. */
const ROLL_GAP = 0.065;
/** Steps per bar: the song moves in eighth notes, four beats a bar. */
const STEPS = 8;
/** Bars in a tune's loop. */
const LOOP_BARS = 4;

/** Major pentatonic: no note in it clashes with another, so a random melody always sounds kind. */
export const PENTATONIC = [0, 2, 4, 7, 9] as const;

/** Keys the levels cycle through, as MIDI root notes (C, D, F, G, A♭-free and child-friendly). */
const KEYS = [60, 62, 65, 67, 64, 57] as const;

/** Chord loops as scale degrees in semitones: I–V–vi–IV and friends. */
const LOOPS: readonly (readonly number[])[] = [
  [0, 7, 9, 5],
  [0, 5, 7, 5],
  [9, 5, 0, 7],
  [0, 9, 5, 7],
];

/** One level's original tune: a four-bar chord loop, its bass, and a 32-step pentatonic melody. */
export interface DrumTune {
  readonly root: number;
  /** MIDI notes of each bar's triad, in the octave above the root. */
  readonly chords: readonly (readonly number[])[];
  /** MIDI bass note per bar. */
  readonly bass: readonly number[];
  /** MIDI note or a rest per eighth step over the whole loop. */
  readonly melody: readonly (number | null)[];
}

/** A small seeded PRNG (mulberry32), so a level's tune is the same on every visit. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isMinor = (degree: number) => degree === 2 || degree === 4 || degree === 9;

/** The tune for a level (1–12). Deterministic: the same level always plays the same song. */
export function drumTune(level: number): DrumTune {
  const random = seeded(Math.imul(Math.max(1, Math.floor(level)), 2654435761) ^ 0x5eed);
  const root = KEYS[(Math.max(1, level) - 1) % KEYS.length];
  const loop = LOOPS[Math.floor(random() * LOOPS.length)];
  const chords = loop.map((degree) => [
    root + degree,
    root + degree + (isMinor(degree) ? 3 : 4),
    root + degree + 7,
  ]);
  const bass = loop.map((degree) => root + degree - 24);
  // A ladder of two pentatonic octaves above the root; the melody walks up and down it.
  const ladder = [0, 12].flatMap((octave) => PENTATONIC.map((step) => root + 12 + octave + step));
  const inScale = (note: number) =>
    PENTATONIC.includes(((((note - root) % 12) + 12) % 12) as (typeof PENTATONIC)[number]);
  let rung = Math.floor(random() * 5) + 2;
  const melody: (number | null)[] = [];
  for (let step = 0; step < STEPS * LOOP_BARS; step++) {
    const beat = step % STEPS;
    const bar = Math.floor(step / STEPS);
    if (step === STEPS * LOOP_BARS - 2) {
      // The loop comes home to the root before it starts again.
      melody.push(root + 12);
      continue;
    }
    if (beat === 0) {
      // Downbeats land on a chord tone that is also pentatonic, so the tune follows the chords.
      const tones = ladder.filter((note) =>
        chords[bar].some((tone) => (note - tone) % 12 === 0 && inScale(tone)),
      );
      if (tones.length) {
        const near = tones.reduce((best, note) =>
          Math.abs(note - ladder[rung]) < Math.abs(best - ladder[rung]) ? note : best,
        );
        rung = ladder.indexOf(near);
        melody.push(near);
        continue;
      }
    }
    const rest = beat % 2 === 0 ? 0.2 : 0.6;
    if (random() < rest) {
      melody.push(null);
      continue;
    }
    rung = Math.max(0, Math.min(ladder.length - 1, rung + Math.floor(random() * 5) - 2));
    melody.push(ladder[rung]);
  }
  return { root, chords, bass, melody };
}

export const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

export type ClockSource = 'audio' | 'wall';

/**
 * Keeps one continuous game clock over two sources: the audio clock while the AudioContext runs,
 * the wall clock otherwise. On every switch it re-anchors: the new source picks up where the old
 * one left off, plus the wall time that passed since the last reading, so the clock never jumps
 * and never runs backwards.
 */
export class ClockAnchor {
  private source?: ClockSource;
  private offset = 0;
  private last = 0;
  private lastWall = 0;

  /** The game time now, read from `source` (whose current value is `sourceTime`). */
  read(source: ClockSource, sourceTime: number, wallTime: number): number {
    if (source !== this.source) {
      const estimate =
        this.source === undefined ? wallTime : this.last + Math.max(0, wallTime - this.lastWall);
      this.offset = estimate - sourceTime;
      this.source = source;
    }
    const value = Math.max(this.last, sourceTime + this.offset);
    this.last = value;
    this.lastWall = wallTime;
    return value;
  }

  /** A game time on the current source's own clock, e.g. for `AudioContext` scheduling. */
  toSource(gameTime: number): number {
    return gameTime - this.offset;
  }
}

/** Safari's `navigator.audioSession` (iOS 17+), which lets Web Audio play with the mute switch on. */
interface AudioSessionNavigator {
  audioSession: { type: string };
}
function hasAudioSession(value: unknown): value is AudioSessionNavigator {
  if (!value || typeof value !== 'object' || !('audioSession' in value)) return false;
  const session = (value as { audioSession: unknown }).audioSession;
  return !!session && typeof session === 'object' && 'type' in session;
}

/** A 44-byte WAV with no samples: playing it once unlocks audio on iOS before audioSession. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

interface Song {
  readonly level: number;
  readonly origin: number;
  readonly period: number;
  readonly tune: DrumTune;
}

type Bus = 'music' | 'fx';

/**
 * The mushroom drums' music and sounds. The song is a beat grid on the audio clock: a lookahead
 * scheduler books each eighth note a moment before it sounds, so the beat stays steady however
 * busy the page is, and `now()` gives the game the same clock so Pom lands on the drum hits.
 * Instruments join in layers as the streak grows. Component-scoped so leaving the game releases
 * the audio context; music and effects follow the Settings switches.
 */
@Injectable()
export class DrumSounds {
  private readonly settings = inject(PlaytestStore);
  private readonly document = inject(DOCUMENT);
  private readonly anchor = new ClockAnchor();
  private context?: AudioContext;
  private master?: GainNode;
  private buses?: Record<Bus, GainNode>;
  private noiseBuffer?: AudioBuffer;
  private readonly voices: Record<Bus, Set<AudioScheduledSourceNode>> = {
    music: new Set(),
    fx: new Set(),
  };
  private scheduler?: ReturnType<typeof setInterval>;
  private current?: Song;
  private nextStep = 0;
  private bars = 0;
  private layers = 1;
  private held = false;
  private heldVoices: { gain: GainNode; sources: AudioScheduledSourceNode[] } | null = null;
  private rolling = false;
  private nextRoll = 0;
  private rollStart = 0;
  private paused = false;
  private unlocked = false;
  private destroyed = false;

  readonly now = (): number => {
    const wall = Date.now() / 1000;
    const context = this.context;
    if (context && context.state === 'running')
      return this.anchor.read('audio', context.currentTime, wall);
    return this.anchor.read('wall', wall, wall);
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearInterval(this.scheduler);
      this.silence('music');
      this.silence('fx');
      this.release(0);
      void this.context?.close().catch(() => undefined);
    });
  }

  get latency(): number {
    const context = this.context;
    if (!context) return 0;
    return context.outputLatency || context.baseLatency || 0;
  }

  get enabled(): boolean {
    const audio = this.settings.audio();
    return audio.music || audio.effects;
  }

  private get music() {
    return this.settings.audio().music;
  }

  private get effects() {
    return this.settings.audio().effects;
  }

  toggle() {
    const on = !this.enabled;
    const audio = this.settings.audio();
    if (audio.music !== on) this.settings.toggle('music');
    if (audio.effects !== on) this.settings.toggle('effects');
    if (!on) {
      this.silence('music');
      this.silence('fx');
      this.release(0.05);
      this.rolling = false;
    } else if (this.held) {
      this.sustain();
    }
  }

  unlock() {
    if (this.destroyed || typeof AudioContext === 'undefined') return;
    try {
      const navigator = this.document.defaultView?.navigator;
      if (hasAudioSession(navigator)) {
        navigator.audioSession.type = 'playback';
      } else if (!this.unlocked && typeof Audio !== 'undefined') {
        const silent = new Audio(SILENT_WAV);
        void silent.play()?.catch(() => undefined);
      }
      this.unlocked = true;
      this.ensure();
      if (this.context && this.context.state !== 'running' && !this.paused)
        void this.context.resume().catch(() => undefined);
    } catch {
      // Sound is a bonus: the game is fully playable with the countdown ring and visual beat.
    }
  }

  song(options: { level: number; origin: number; period: number }) {
    const { level, origin, period } = options;
    if (!(period > 0)) return;
    const same = this.current?.level === level;
    this.current = {
      level,
      origin,
      period,
      tune: same && this.current ? this.current.tune : drumTune(level),
    };
    if (!same) this.bars = 0;
    this.realign();
    this.ensure();
  }

  setLayers(layers: number) {
    this.layers = Math.max(1, Math.min(5, Math.round(layers)));
  }

  hold(on: boolean) {
    if (on === this.held) return;
    this.held = on;
    if (on) {
      this.silence('music');
      this.sustain();
    } else {
      this.release(0.3);
      this.realign();
    }
  }

  stopSong() {
    this.current = undefined;
    this.held = false;
    this.release(0.2);
    this.silence('music');
  }

  hit(value: number, at?: number) {
    this.withAudio('fx', at, (time) => {
      const root = this.current?.tune.root ?? 60;
      const digit = ((Math.round(value) % 10) + 10) % 10;
      const note = root - 12 + Math.floor(digit / 5) * 12 + PENTATONIC[digit % 5];
      const hz = midiToHz(note);
      this.tone('fx', 'sine', hz * 1.6, time, 0.32, 0.13, 0.004, hz);
      this.noise('fx', time, 0.05, 0.05, 'bandpass', 1800);
    });
  }

  play(effect: DrumEffect, at?: number) {
    this.withAudio('fx', at, (time) => this.effect(effect, time));
  }

  roll(on: boolean) {
    if (on === this.rolling) return;
    this.rolling = on;
    if (on) {
      const now = this.now();
      this.rollStart = now;
      this.nextRoll = now + 0.02;
      this.ensure();
    }
  }

  countIn(from: number, period: number) {
    for (let beat = 0; beat < 4; beat++) {
      this.withAudio('fx', from + beat * period, (time) => {
        const accent = beat === 0;
        this.tone('fx', 'square', accent ? 1760 : 1320, time, 0.05, 0.04, 0.002);
        this.noise('fx', time, 0.03, 0.04, 'highpass', 4000);
      });
    }
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.silence('music');
    this.silence('fx');
    if (this.context && this.master) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setValueAtTime(0, this.context.currentTime);
      void this.context.suspend().catch(() => undefined);
    }
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    const context = this.context;
    if (!context || !this.master) return;
    void context
      .resume()
      .then(() => {
        if (this.paused || !this.master) return;
        this.master.gain.setValueAtTime(0.9, context.currentTime);
        this.realign();
      })
      .catch(() => undefined);
  }

  /** Creates the audio graph and the scheduler on first use. */
  private ensure() {
    if (this.destroyed || typeof AudioContext === 'undefined') return;
    try {
      if (!this.context) {
        const context = new AudioContext();
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.ratio.value = 4;
        const master = context.createGain();
        master.gain.value = 0.9;
        master.connect(compressor);
        compressor.connect(context.destination);
        const bus = (level: number) => {
          const gain = context.createGain();
          gain.gain.value = level;
          gain.connect(master);
          return gain;
        };
        this.context = context;
        this.master = master;
        this.buses = { music: bus(0.8), fx: bus(1) };
      }
      this.scheduler ??= setInterval(() => this.tick(), TICK_MS);
    } catch {
      this.context = undefined;
    }
  }

  /** Starts the grid at the next eighth step from now, so no past notes pile up. */
  private realign() {
    const song = this.current;
    if (!song) return;
    const half = song.period / 2;
    this.nextStep = Math.max(0, Math.ceil((this.now() - song.origin) / half - 1e-6));
  }

  private tick() {
    const context = this.context;
    if (!context || this.paused || this.destroyed || context.state !== 'running') return;
    const now = this.now();
    const horizon = now + LOOKAHEAD;
    if (this.rolling) {
      while (this.nextRoll < horizon) {
        if (this.effects) {
          // The roll swells while Pom waits, so the wait is felt, not just seen.
          const swell = Math.min(1, (this.nextRoll - this.rollStart) / 2);
          this.noise('fx', this.at(this.nextRoll), 0.05, 0.015 + swell * 0.03, 'highpass', 1500);
        }
        this.nextRoll += ROLL_GAP;
      }
    }
    const song = this.current;
    if (!song || this.held) return;
    const half = song.period / 2;
    for (;;) {
      const time = song.origin + this.nextStep * half;
      if (time >= horizon) break;
      const beat = this.nextStep % STEPS;
      if (beat === 0) this.bars++;
      if (time >= now - 0.02 && this.music) this.step(song, beat, this.at(time), half);
      this.nextStep++;
    }
  }

  /** One eighth note of the song, with every layer that is playing. */
  private step(song: Song, beat: number, time: number, half: number) {
    const bar = Math.max(0, this.bars - 1) % LOOP_BARS;
    const { tune } = song;
    const chord = tune.chords[bar];
    // Layer 1, drums: kick on 1 and 3, snare on 2 and 4, a hat on every eighth.
    if (beat === 0 || beat === 4) this.kick(time);
    if (beat === 2 || beat === 6) {
      this.noise('music', time, 0.14, 0.05, 'highpass', 1200);
      this.tone('music', 'triangle', 190, time, 0.08, 0.04, 0.002);
    }
    this.noise('music', time, 0.04, beat % 2 ? 0.012 : 0.02, 'highpass', 7000);
    // Layer 2, bass: the chord's root on the beats that matter.
    if (this.layers >= 2 && (beat === 0 || beat === 3 || beat === 4))
      this.tone('music', 'triangle', midiToHz(tune.bass[bar]), time, half * 1.6, 0.08, 0.01);
    // Layer 3, a flute-like lead with a little vibrato.
    const note = tune.melody[bar * STEPS + beat];
    if (this.layers >= 3 && note !== null) this.flute(midiToHz(note), time, half * 1.5);
    // Layer 4, bells: a high sparkle arpeggio on the off-beats.
    if (this.layers >= 4 && beat % 2 === 1) {
      const tone = chord[Math.floor(beat / 2) % chord.length] + 24;
      this.bell(midiToHz(tone), time);
    }
    // Layer 5, a choir-like pad holding the bar's chord.
    if (this.layers >= 5 && beat === 0) this.pad(chord, time, half * STEPS);
  }

  /** The sustained chord of a held beat, until `release`. */
  private sustain() {
    const context = this.context;
    const bus = this.buses?.music;
    if (!context || !bus || !this.music || this.heldVoices || context.state !== 'running') return;
    const tune = this.current?.tune ?? drumTune(1);
    const chord = tune.chords[Math.max(0, this.bars - 1) % LOOP_BARS];
    const time = context.currentTime;
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.05, time + 0.25);
    filter.connect(gain);
    gain.connect(bus);
    const sources = chord.flatMap((note) =>
      [-6, 6].map((detune) => {
        const oscillator = context.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.value = midiToHz(note);
        oscillator.detune.value = detune;
        oscillator.connect(filter);
        oscillator.start(time);
        return oscillator;
      }),
    );
    this.heldVoices = { gain, sources };
  }

  private release(fade: number) {
    const held = this.heldVoices;
    this.heldVoices = null;
    if (!held || !this.context) return;
    const time = this.context.currentTime;
    try {
      held.gain.gain.cancelScheduledValues(time);
      held.gain.gain.setValueAtTime(held.gain.gain.value, time);
      held.gain.gain.linearRampToValueAtTime(0, time + fade);
      for (const source of held.sources) {
        source.stop(time + fade + 0.02);
        source.onended = () => source.disconnect();
      }
      setTimeout(() => held.gain.disconnect(), (fade + 0.1) * 1000);
    } catch {
      /* The context is already closed. */
    }
  }

  private effect(effect: DrumEffect, time: number) {
    const arpeggio = (notes: readonly number[], gap: number, length: number, peak = 0.07) =>
      notes.forEach((hz, index) =>
        this.tone('fx', 'sine', hz, time + index * gap, length, peak, 0.01),
      );
    switch (effect) {
      case 'start':
        arpeggio([523, 659, 784, 1047], 0.08, 0.25);
        break;
      case 'bonk':
        // Soft and round: a mistake should sound like a mushroom, not a buzzer.
        this.tone('fx', 'sine', 220, time, 0.28, 0.1, 0.005, 95);
        this.noise('fx', time, 0.08, 0.03, 'lowpass', 600);
        break;
      case 'layerUp':
        arpeggio([659, 784, 988], 0.06, 0.2, 0.06);
        break;
      case 'layerDown':
        arpeggio([587, 440], 0.1, 0.25, 0.05);
        break;
      case 'verse':
        arpeggio([523, 659, 784, 1047, 784, 1047], 0.1, 0.3);
        this.kick(time);
        break;
      case 'solo':
        [0, 1, 2, 3].forEach((index) =>
          this.tone('fx', 'sine', 180 + index * 60, time + index * 0.09, 0.2, 0.11, 0.003, 120),
        );
        this.noise('fx', time + 0.36, 0.8, 0.04, 'highpass', 3000);
        break;
      case 'win': {
        // A roll that speeds up, then a cymbal crash and a big chord.
        let at = time;
        for (let gap = 0.12; at < time + 0.9; gap = Math.max(0.04, gap * 0.9)) {
          this.noise('fx', at, 0.05, 0.02 + ((at - time) / 0.9) * 0.03, 'highpass', 1500);
          at += gap;
        }
        this.noise('fx', time + 0.95, 1.4, 0.05, 'highpass', 3000);
        this.kick(time + 0.95);
        [523, 659, 784, 1047].forEach((hz) =>
          this.tone('fx', 'triangle', hz, time + 0.95, 1.2, 0.04, 0.02),
        );
        break;
      }
      case 'tap':
        this.tone('fx', 'sine', 1200, time, 0.06, 0.08, 0.002, 900);
        break;
    }
  }

  private kick(time: number) {
    this.tone('music', 'sine', 140, time, 0.2, 0.15, 0.003, 45);
  }

  private flute(hz: number, time: number, length: number) {
    const context = this.context;
    const bus = this.buses?.music;
    if (!context || !bus) return;
    const oscillator = context.createOscillator();
    const vibrato = context.createOscillator();
    const depth = context.createGain();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = hz;
    vibrato.frequency.value = 5.5;
    depth.gain.value = hz * 0.004;
    vibrato.connect(depth);
    depth.connect(oscillator.frequency);
    this.envelope(gain, time, length, 0.045, 0.04);
    oscillator.connect(gain);
    gain.connect(bus);
    this.run('music', vibrato, time, time + length + 0.05, [depth]);
    this.run('music', oscillator, time, time + length + 0.05, [gain]);
  }

  private bell(hz: number, time: number) {
    this.tone('music', 'sine', hz, time, 0.6, 0.025, 0.003);
    // An inharmonic partial is what makes a sine sound like a bell.
    this.tone('music', 'sine', hz * 2.76, time, 0.25, 0.008, 0.003);
  }

  private pad(chord: readonly number[], time: number, length: number) {
    const context = this.context;
    const bus = this.buses?.music;
    if (!context || !bus) return;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    filter.connect(bus);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.03, time + Math.min(0.5, length * 0.3));
    gain.gain.linearRampToValueAtTime(0.0001, time + length);
    gain.connect(filter);
    chord.forEach((note, index) =>
      [-7, 7].forEach((detune, side) => {
        const oscillator = context.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.value = midiToHz(note);
        oscillator.detune.value = detune;
        oscillator.connect(gain);
        const last = index === chord.length - 1 && side === 1;
        this.run('music', oscillator, time, time + length + 0.05, last ? [gain, filter] : []);
      }),
    );
  }

  private tone(
    bus: Bus,
    type: OscillatorType,
    hz: number,
    time: number,
    length: number,
    peak: number,
    attack: number,
    glideTo?: number,
  ) {
    const context = this.context;
    const output = this.buses?.[bus];
    if (!context || !output) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(hz, time);
    if (glideTo) oscillator.frequency.exponentialRampToValueAtTime(glideTo, time + length * 0.6);
    this.envelope(gain, time, length, peak, attack);
    oscillator.connect(gain);
    gain.connect(output);
    this.run(bus, oscillator, time, time + length + 0.05, [gain]);
  }

  private noise(
    bus: Bus,
    time: number,
    length: number,
    peak: number,
    filterType: BiquadFilterType,
    frequency: number,
  ) {
    const context = this.context;
    const output = this.buses?.[bus];
    if (!context || !output) return;
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer ??= this.makeNoise(context);
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    const gain = context.createGain();
    this.envelope(gain, time, length, peak, 0.002);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    this.run(bus, source, time, time + length + 0.05, [filter, gain]);
  }

  private envelope(gain: GainNode, time: number, length: number, peak: number, attack: number) {
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(attack + 0.01, length));
  }

  /** Starts and stops a source, tracks it so pause can cut it, and frees its nodes after. */
  private run(
    bus: Bus,
    source: AudioScheduledSourceNode,
    start: number,
    stop: number,
    nodes: readonly AudioNode[],
  ) {
    const voices = this.voices[bus];
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
      for (const node of nodes) node.disconnect();
    };
    source.start(start);
    source.stop(stop);
  }

  private makeNoise(context: AudioContext) {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    const random = seeded(7);
    for (let index = 0; index < data.length; index++) data[index] = random() * 2 - 1;
    return buffer;
  }

  private silence(bus: Bus) {
    for (const voice of this.voices[bus]) {
      try {
        voice.stop();
      } catch {
        /* Not started yet or already stopped. */
      }
    }
    this.voices[bus].clear();
  }

  /** A game time on the audio clock; never in the past, which Web Audio would play at once. */
  private at(gameTime: number) {
    const context = this.context;
    if (!context) return 0;
    return Math.max(context.currentTime, this.anchor.toSource(gameTime));
  }

  /** Runs `schedule` with an audio time once the context runs, if that kind of sound is on. */
  private withAudio(bus: Bus, at: number | undefined, schedule: (time: number) => void) {
    if (this.destroyed || this.paused || typeof AudioContext === 'undefined') return;
    if (!(bus === 'fx' ? this.effects : this.music)) return;
    this.ensure();
    const context = this.context;
    if (!context) return;
    const go = () => {
      if (this.destroyed || this.paused || context.state !== 'running') return;
      this.now();
      schedule(this.at(at ?? this.now()));
    };
    if (context.state === 'running') go();
    else
      void context
        .resume()
        .then(go)
        .catch(() => undefined);
  }
}
