import { describe, expect, it } from 'vitest';
import { Mushroom } from './drum-patterns';
import { answer, asking, DrumPlay, shift, skip, startPlay, Step, tick } from './drum-round';

/** A tiny round: 0, 10, 20 shown, then 30 and 40 to answer, a solo 5 → 7 to answer. */
function mushrooms(): Mushroom[] {
  const item = (value: number, given: boolean, verse: number, step: number, fresh = false) => ({
    value,
    given,
    verse,
    step,
    fresh,
    seed: value + 1,
  });
  return [
    item(0, true, 0, 0, true),
    item(10, true, 0, 10),
    item(20, true, 0, 10),
    item(30, false, 0, 10),
    item(40, false, 0, 10),
    item(5, true, 3, 0, true),
    item(7, false, 3, 2),
  ];
}

const BEAT = 0.5;
const BAR = BEAT * 4;

function begin(timed = true): Step {
  return startPlay(mushrooms(), { timed, beat: BEAT, grace: 0.4 }, 0);
}

/** Ticks until the next question is asked, returning the time it was asked. */
function untilAsked(play: DrumPlay, from: number): { play: DrumPlay; time: number } {
  for (let time = from; time < from + 30; time += 0.05) {
    play = tick(play, time).play;
    if (asking(play) !== null) return { play, time };
  }
  throw new Error('never asked');
}

describe('mushroom drums timing', () => {
  it('shows a title bar, lets Pom hop the demo on the beat, then asks', () => {
    const { play } = begin();
    expect(play.phase).toBe('banner');
    // The count-in lasts one bar, then two hops of two beats each.
    const asked = untilAsked(play, 0);
    expect(asking(asked.play)).toBe(3);
    expect(asked.play.askedAt).toBeCloseTo(BAR + 2 * 2 * BEAT);
    expect(asked.play.landing).toBeCloseTo(asked.play.askedAt + BAR);
  });

  it('lands an early right answer on the beat and scores it on the beat and first try', () => {
    const asked = untilAsked(begin().play, 0);
    const step = answer(asked.play, 30, asked.play.askedAt + 0.5);
    expect(step.play.hop?.end).toBeCloseTo(asked.play.landing);
    expect(step.events).toContainEqual(
      expect.objectContaining({ kind: 'right', onBeat: true, firstTry: true, points: 20 }),
    );
    expect(step.events.some((event) => event.kind === 'regrid')).toBe(false);
    const landed = tick(step.play, asked.play.landing + 0.01);
    expect(landed.play.at).toBe(3);
    expect(landed.play.stats.hits).toBe(1);
    // The next question starts right on the landing beat.
    expect(asking(landed.play)).toBe(4);
    expect(landed.play.askedAt).toBeCloseTo(asked.play.landing);
  });

  it('lets Pom wait on the edge when the answer is late, never failing', () => {
    const asked = untilAsked(begin().play, 0);
    const late = tick(asked.play, asked.play.landing + 0.1);
    expect(late.play.waiting).toBe(true);
    expect(late.events).toContainEqual({ kind: 'late', index: 3 });
    const step = answer(late.play, 30, asked.play.landing + 1.5);
    expect(step.events).toContainEqual(
      expect.objectContaining({ kind: 'right', onBeat: false, firstTry: true, points: 15 }),
    );
    // The beat starts again from the landing.
    expect(step.events).toContainEqual({ kind: 'regrid', origin: step.play.hop!.end });
  });

  it('counts an answer inside the grace window as on the beat', () => {
    const asked = untilAsked(begin().play, 0);
    const late = tick(asked.play, asked.play.landing + 0.2).play;
    const step = answer(late, 30, asked.play.landing + 0.3);
    expect(step.events).toContainEqual(expect.objectContaining({ kind: 'right', onBeat: true }));
  });

  it('holds the beat on a wrong answer and costs only the first-try bonus', () => {
    const asked = untilAsked(begin().play, 0);
    const wrong = answer(asked.play, 31, asked.play.askedAt + 0.2);
    expect(wrong.play.held).toBe(true);
    expect(wrong.play.stats.bonks).toBe(1);
    // Held: no waiting, however long the child thinks.
    expect(tick(wrong.play, asked.play.landing + 5).play.waiting).toBe(false);
    const right = answer(wrong.play, 30, asked.play.landing + 5);
    expect(right.events).toContainEqual(
      expect.objectContaining({ kind: 'right', onBeat: false, firstTry: false, points: 10 }),
    );
    expect(right.play.stats.firstTry).toBe(0);
  });

  it('adds an instrument for four good answers and takes one away for a miss', () => {
    let play = begin(false).play;
    let time = 0;
    const many: Mushroom[] = [mushrooms()[0]];
    for (let index = 1; index <= 9; index++)
      many.push({ value: index * 10, given: false, verse: 0, step: 10, fresh: false, seed: index });
    play = { ...play, mushrooms: many };
    const layers: number[] = [];
    for (let index = 1; index <= 9; index++) {
      const asked = untilAsked(play, time);
      time = asked.time;
      const value = index === 6 ? 1 : index * 10;
      let step = answer(asked.play, value, time);
      if (index === 6) step = answer(step.play, index * 10, time);
      play = step.play;
      layers.push(play.stats.layers);
      time += 1;
    }
    expect(layers).toEqual([1, 1, 1, 2, 2, 1, 1, 1, 1]);
  });

  it('opens the solo with its own title and pays double', () => {
    let play = untilAsked(begin(false).play, 0).play;
    play = answer(play, 30, 5).play;
    play = untilAsked(play, 5).play;
    play = answer(play, 40, 8).play;
    const titled = tick(play, 9);
    expect(titled.events).toContainEqual({ kind: 'banner', verse: 3, from: expect.any(Number) });
    const solo = untilAsked(titled.play, 9);
    const step = answer(solo.play, 7, solo.time);
    expect(step.events).toContainEqual(expect.objectContaining({ kind: 'right', points: 30 }));
    const done = tick(step.play, solo.time + 2);
    expect(done.play.phase).toBe('done');
    // The solo is a bonus: only verse questions count for stars.
    expect(done.play.stats.firstTry).toBe(2);
    // The streak counts verse drums only, so it never tops the first-try tile.
    expect(done.play.stats.bestStreak).toBe(2);
  });

  it('skips the title and demo straight to the first question', () => {
    const step = skip(begin().play, 0.3);
    expect(asking(step.play)).toBe(3);
    expect(step.play.at).toBe(2);
    expect(step.play.landing).toBeCloseTo(0.3 + BAR);
  });

  it('shifts every time after a pause', () => {
    const asked = untilAsked(begin().play, 0).play;
    const later = shift(asked, 10);
    expect(later.landing).toBeCloseTo(asked.landing + 10);
    expect(tick(later, asked.landing + 1).play.waiting).toBe(false);
  });

  it('ignores taps while no question is asked', () => {
    const { play } = begin();
    expect(answer(play, 30, 0.1).play).toBe(play);
  });
});
