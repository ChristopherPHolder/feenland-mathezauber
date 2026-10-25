import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrocodileSounds } from './crocodile-sounds';

function oscillatorStub() {
  return {
    type: 'sine',
    frequency: { value: 0 },
    connect: vi.fn().mockReturnThis(),
    start: vi.fn<(time: number) => void>(),
    stop: vi.fn<(time?: number) => void>(),
    disconnect: vi.fn().mockReturnThis(),
    onended: () => {},
  };
}
class FakeAudioContext {
  state = 'running';
  currentTime = 10;
  destination = {};
  oscillators: ReturnType<typeof oscillatorStub>[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  close = vi.fn(async () => undefined);
  createOscillator() {
    const oscillator = oscillatorStub();
    this.oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn().mockReturnThis(),
    };
  }
}

describe('crocodile answer sounds', () => {
  let context: FakeAudioContext;
  beforeEach(() => {
    localStorage.clear();
    context = new FakeAudioContext();
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          return context;
        }
      },
    );
    TestBed.configureTestingModule({ providers: [CrocodileSounds] });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });
  it('uses rising success notes and lower falling mistake notes', async () => {
    const sounds = TestBed.inject(CrocodileSounds);
    sounds.play('chomp');
    await Promise.resolve();
    const success = context.oscillators.map((o) => o.frequency.value);
    expect(success.length).toBeGreaterThan(1);
    expect(success.at(-1)).toBeGreaterThan(success[0]);
    context.oscillators = [];
    sounds.play('wrong');
    await Promise.resolve();
    const wrong = context.oscillators.map((o) => o.frequency.value);
    expect(wrong.at(-1)).toBeLessThan(wrong[0]);
    expect(Math.max(...wrong)).toBeLessThan(Math.min(...success));
  });
  it('waits for suspended audio before scheduling feedback', async () => {
    context.state = 'suspended';
    context.resume.mockImplementation(async () => {
      await Promise.resolve();
      context.state = 'running';
    });
    TestBed.inject(CrocodileSounds).play('wrong');
    await vi.waitFor(() => expect(context.oscillators).toHaveLength(2));
  });
  it('plays bonuses after the answer and interrupts old feedback on a new answer', async () => {
    const sounds = TestBed.inject(CrocodileSounds);
    sounds.play('chomp');
    sounds.play('combo');
    await Promise.resolve();
    const notes = context.oscillators;
    const answerEnd = Math.max(...notes.slice(0, 3).map((o) => o.stop.mock.calls[0][0]!));
    expect(notes[3].start.mock.calls[0][0]).toBeGreaterThanOrEqual(answerEnd);
    sounds.play('wrong');
    await Promise.resolve();
    expect(notes[0].stop).toHaveBeenLastCalledWith();
  });
  it('uses the same rising success pattern for equal answers', () => {
    TestBed.inject(CrocodileSounds).play('splash');
    const notes = context.oscillators.map((o) => o.frequency.value);
    expect(notes).toHaveLength(3);
    expect(notes[1]).toBeGreaterThan(notes[0]);
    expect(notes[2]).toBeGreaterThan(notes[1]);
  });
  it('discards pending feedback when muted while audio resumes', async () => {
    let resume!: () => void;
    context.state = 'suspended';
    context.resume.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resume = () => {
            context.state = 'running';
            resolve();
          };
        }),
    );
    const sounds = TestBed.inject(CrocodileSounds);
    sounds.play('wrong');
    sounds.toggle();
    resume();
    await Promise.resolve();
    expect(context.oscillators).toHaveLength(0);
  });
  it('keeps the game playable when browser audio fails', async () => {
    context.state = 'suspended';
    context.resume.mockRejectedValue(new Error('Audio unavailable'));
    expect(() => TestBed.inject(CrocodileSounds).play('chomp')).not.toThrow();
    await Promise.resolve();
    expect(context.oscillators).toHaveLength(0);
  });
});
