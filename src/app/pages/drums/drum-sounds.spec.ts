import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { TestBed } from '@angular/core/testing';
import { PlaytestStore } from '../fairy-defense/playtest-store';
import { ClockAnchor, drumTune, DrumSounds, PENTATONIC } from './drum-sounds';

describe('the drum tunes', () => {
  it('gives every level the same song on every visit', () => {
    expect(drumTune(4)).toEqual(drumTune(4));
  });

  it('gives different levels different songs', () => {
    const melodies = new Set(
      Array.from({ length: 12 }, (_, index) => JSON.stringify(drumTune(index + 1).melody)),
    );
    expect(melodies.size).toBe(12);
  });

  it('keeps the melody in the major pentatonic of the key, and plays more notes than rests', () => {
    for (let level = 1; level <= 12; level++) {
      const tune = drumTune(level);
      const notes = tune.melody.filter((note): note is number => note !== null);
      expect(notes.length).toBeGreaterThan(tune.melody.length / 2);
      for (const note of notes) expect(PENTATONIC).toContain((((note - tune.root) % 12) + 12) % 12);
      expect(tune.chords).toHaveLength(4);
      expect(tune.bass).toHaveLength(4);
      expect(tune.melody).toHaveLength(32);
    }
  });
});

describe('the game clock anchor', () => {
  it('starts on the wall clock and follows it', () => {
    const anchor = new ClockAnchor();
    expect(anchor.read('wall', 100, 100)).toBe(100);
    expect(anchor.read('wall', 101.5, 101.5)).toBe(101.5);
  });

  it('switches to the audio clock without a jump and then follows it', () => {
    const anchor = new ClockAnchor();
    anchor.read('wall', 100, 100);
    // The audio clock starts at 0.3 when the wall clock says 100.2.
    expect(anchor.read('audio', 0.3, 100.2)).toBeCloseTo(100.2);
    expect(anchor.read('audio', 1.3, 101.2)).toBeCloseTo(101.2);
    expect(anchor.toSource(101.5)).toBeCloseTo(1.6);
  });

  it('never runs backwards when a suspended context hands back to the wall clock', () => {
    const anchor = new ClockAnchor();
    anchor.read('wall', 100, 100);
    anchor.read('audio', 0, 100);
    const before = anchor.read('audio', 2, 102);
    // The context was suspended at audio time 2; the wall clock moved on to 105.
    const after = anchor.read('wall', 105, 105);
    expect(after).toBeGreaterThanOrEqual(before);
    expect(after).toBeCloseTo(105);
    // Back on audio, which resumed where it froze.
    expect(anchor.read('audio', 2, 105.1)).toBeCloseTo(105.1);
    expect(anchor.read('audio', 2.5, 105.6)).toBeCloseTo(105.6);
  });

  it('holds still rather than stepping back when a source wobbles', () => {
    const anchor = new ClockAnchor();
    anchor.read('wall', 50, 50);
    expect(anchor.read('wall', 49.9, 49.9)).toBe(50);
  });
});

describe('the drum sounds without Web Audio', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [DrumSounds] });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('keeps a game clock on the wall clock', () => {
    const sounds = TestBed.inject(DrumSounds);
    expect(typeof AudioContext).toBe('undefined');
    const start = sounds.now();
    vi.advanceTimersByTime(1500);
    expect(sounds.now() - start).toBeCloseTo(1.5);
    expect(sounds.latency).toBe(0);
  });

  it('turns every call into a quiet no-op', () => {
    const sounds = TestBed.inject(DrumSounds);
    expect(() => {
      sounds.unlock();
      sounds.song({ level: 3, origin: sounds.now(), period: 0.6 });
      sounds.setLayers(4);
      sounds.hit(27);
      sounds.play('bonk');
      sounds.countIn(sounds.now() + 0.5, 0.6);
      sounds.roll(true);
      sounds.hold(true);
      sounds.hold(false);
      sounds.roll(false);
      sounds.pause();
      sounds.resume();
      sounds.stopSong();
    }).not.toThrow();
  });

  it('switches music and effects off together, and back on together', () => {
    const sounds = TestBed.inject(DrumSounds);
    const store = TestBed.inject(PlaytestStore);
    expect(sounds.enabled).toBe(true);
    sounds.toggle();
    expect(sounds.enabled).toBe(false);
    expect(store.audio()).toMatchObject({ music: false, effects: false });
    store.toggle('effects');
    expect(sounds.enabled).toBe(true);
    sounds.toggle();
    expect(store.audio()).toMatchObject({ music: false, effects: false });
    sounds.toggle();
    expect(store.audio()).toMatchObject({ music: true, effects: true });
  });
});
