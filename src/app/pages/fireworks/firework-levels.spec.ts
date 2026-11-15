import { describe, expect, it } from 'vitest';
import { FADE_IN, FADE_OUT, flashesPerSecond, sparkGlow } from './firework-frame';
import {
  adaptLook,
  createPattern,
  createRound,
  fireworkLevel,
  fireworkLevels,
  fireworkPoints,
  hintFor,
  lookSeconds,
  Pattern,
  PatternKind,
  PACES,
  padNumbers,
  roundStars,
  ROUND_LENGTH,
  seeded,
  signature,
  SLOW_LOOK,
  startLook,
  waysToSee,
} from './firework-levels';
import { BOOK_SHAPES, shapePoints } from './firework-shapes';

const KINDS: PatternKind[] = [
  'dice',
  'small',
  'five',
  'tenFrame',
  'makeTen',
  'twoDice',
  'tenAnd',
  'double',
  'nearMore',
  'nearLess',
  'twenty',
];

function many(kind: PatternKind, count = 300, jitter = false): Pattern[] {
  const random = seeded(kind.length * 97 + count);
  return Array.from({ length: count }, () => createPattern(kind, { jitter }, random));
}

const sum = (parts: readonly number[]) => parts.reduce((a, b) => a + b, 0);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe('firework patterns', () => {
  it('shows exactly as many sparks as the parts add up to, for every kind', () => {
    for (const kind of KINDS)
      for (const pattern of many(kind)) {
        if (kind === 'makeTen') {
          expect(pattern.sparks.length + pattern.empty.length).toBe(10);
          expect(pattern.answer).toBe(pattern.empty.length);
          expect(sum(pattern.parts)).toBe(10);
        } else {
          expect(pattern.sparks.length).toBe(pattern.answer);
          expect(sum(pattern.parts)).toBe(pattern.answer);
        }
      }
  });

  it('keeps answers in each kind’s range', () => {
    const ranges: Record<PatternKind, [number, number]> = {
      dice: [1, 6],
      small: [1, 5],
      five: [5, 10],
      tenFrame: [1, 10],
      makeTen: [0, 9],
      twoDice: [2, 12],
      tenAnd: [11, 20],
      double: [2, 20],
      nearMore: [3, 19],
      nearLess: [3, 19],
      twenty: [11, 20],
    };
    for (const kind of KINDS)
      for (const { answer } of many(kind)) {
        expect(answer).toBeGreaterThanOrEqual(ranges[kind][0]);
        expect(answer).toBeLessThanOrEqual(ranges[kind][1]);
      }
  });

  it('never puts two sparks on top of each other, even with jitter', () => {
    for (const kind of KINDS)
      for (const pattern of many(kind, 200, true)) {
        const places = [...pattern.sparks, ...pattern.empty];
        for (let i = 0; i < places.length; i++)
          for (let j = i + 1; j < places.length; j++)
            expect(
              Math.hypot(places[i].x - places[j].x, places[i].y - places[j].y),
            ).toBeGreaterThan(0.6);
      }
  });

  it('always has a full five in a five-structure', () => {
    for (const pattern of many('five')) {
      expect(pattern.parts[0]).toBe(5);
      expect(pattern.sparks.filter((s) => s.group === 0)).toHaveLength(5);
    }
  });

  it('draws doubles as a true mirror image', () => {
    for (const pattern of many('double')) {
      const left = pattern.sparks.filter((s) => s.burst === 0);
      const right = pattern.sparks.filter((s) => s.burst === 1);
      expect(left.length).toBe(right.length);
      // Mirror the left burst about the gap between the bursts: every spark lands on a right one.
      const mid = (Math.max(...left.map((s) => s.x)) + Math.min(...right.map((s) => s.x))) / 2;
      for (const spark of left)
        expect(right.some((r) => near(r.x, 2 * mid - spark.x) && near(r.y, spark.y))).toBe(true);
    }
  });

  it('gives a near double exactly one extra spark, or one gap, on one side', () => {
    for (const pattern of many('nearMore')) {
      const counts = [0, 1].map((b) => pattern.sparks.filter((s) => s.burst === b).length);
      expect(Math.abs(counts[0] - counts[1])).toBe(1);
      expect(pattern.empty).toHaveLength(0);
    }
    for (const pattern of many('nearLess')) {
      const counts = [0, 1].map((b) => pattern.sparks.filter((s) => s.burst === b).length);
      expect(Math.abs(counts[0] - counts[1])).toBe(1);
      expect(pattern.empty).toHaveLength(1);
    }
  });

  it('separates two bursts by space and by spark shape, never by colour alone', () => {
    for (const kind of ['twoDice', 'tenAnd', 'double', 'nearMore'] as const)
      for (const pattern of many(kind)) {
        expect(pattern.bursts).toBe(2);
        expect(pattern.shapes[0]).not.toBe(pattern.shapes[1]);
        const leftEdge = Math.max(...pattern.sparks.filter((s) => s.burst === 0).map((s) => s.x));
        const rightEdge = Math.min(...pattern.sparks.filter((s) => s.burst === 1).map((s) => s.x));
        expect(rightEdge - leftEdge).toBeGreaterThan(1.5);
      }
  });

  it('turns and mirrors pictures without changing the count', () => {
    const shapes = new Set(
      many('dice', 400)
        .filter((p) => p.answer === 6)
        .map(signature),
    );
    expect(shapes.size).toBeGreaterThan(1);
  });

  it('never shows the same picture, answer or colour twice in a row', () => {
    for (const level of fireworkLevels) {
      const round = createRound(level, seeded(level.level));
      expect(round).toHaveLength(ROUND_LENGTH + 1);
      for (let i = 1; i < round.length; i++) {
        expect(signature(round[i])).not.toBe(signature(round[i - 1]));
        expect(round[i].hue).not.toBe(round[i - 1].hue);
      }
      const repeats = round.filter((p, i) => i > 0 && p.answer === round[i - 1].answer);
      expect(repeats.length).toBeLessThanOrEqual(1);
    }
  });

  it('replays the same round from the same seed', () => {
    const level = fireworkLevel('fireworks-7')!;
    expect(createRound(level, seeded(4)).map(signature)).toEqual(
      createRound(level, seeded(4)).map(signature),
    );
  });

  it('only asks for answers that are on the level’s pad', () => {
    for (const level of fireworkLevels) {
      const pad = padNumbers(level);
      for (let seed = 0; seed < 20; seed++)
        for (const pattern of createRound(level, seeded(seed)))
          expect(pad).toContain(pattern.answer);
    }
  });

  it('has twelve levels with stable ids and a book shape each', () => {
    expect(fireworkLevels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(fireworkLevels.map((l) => l.shape)).size).toBe(12);
    expect(fireworkLevel('fireworks-12')?.mastery).toBe(3);
    expect(fireworkLevel('fireworks-13')).toBeUndefined();
    expect(fireworkLevel('fireworks-01')).toBeUndefined();
  });
});

describe('the look time', () => {
  const level = fireworkLevel('fireworks-3')!;

  it('starts at the pace’s base, shorter on the grand show levels', () => {
    expect(startLook('gentle', level).seconds).toBe(3);
    expect(startLook('glow', level).seconds).toBe(2);
    expect(startLook('pop', level).seconds).toBe(1.5);
    expect(startLook('glow', fireworkLevel('fireworks-11')!).seconds).toBe(1.7);
    expect(startLook('glow', fireworkLevel('fireworks-12')!).seconds).toBe(1.5);
  });

  it('shortens after three first looks in a row, and lengthens after a miss or a peek', () => {
    let look = startLook('glow', level);
    look = adaptLook('glow', look, 'firstLook');
    look = adaptLook('glow', look, 'firstLook');
    expect(look.seconds).toBe(2);
    look = adaptLook('glow', look, 'firstLook');
    expect(look.seconds).toBe(1.8);
    expect(adaptLook('glow', look, 'miss').seconds).toBe(2.1);
    expect(adaptLook('glow', look, 'peek').seconds).toBe(2.1);
    expect(adaptLook('glow', look, 'miss').run).toBe(0);
  });

  it('stays inside the pace’s range', () => {
    for (const pace of PACES) {
      let look = startLook(pace.id, level);
      for (let i = 0; i < 40; i++) look = adaptLook(pace.id, look, 'firstLook');
      expect(look.seconds).toBe(pace.min);
      for (let i = 0; i < 40; i++) look = adaptLook(pace.id, look, 'miss');
      expect(look.seconds).toBe(pace.max);
    }
  });

  it('holds two bursts a little longer, and slows right down after a third miss', () => {
    const look = startLook('pop', level);
    const one = createPattern('dice', {}, seeded(1));
    const two = createPattern('twoDice', {}, seeded(1));
    expect(lookSeconds(look, two, 0)).toBeGreaterThan(lookSeconds(look, one, 0));
    expect(lookSeconds(look, one, 3)).toBe(SLOW_LOOK);
  });
});

describe('flash safety', () => {
  const STEP = 1 / 120;

  function trace(events: readonly number[], look: number, length: number) {
    return Array.from({ length: Math.round(length / STEP) }, (_, i) => {
      const t = i * STEP;
      const started = events.filter((at) => at <= t);
      return started.length ? sparkGlow(t - started.at(-1)!, look) : 0;
    });
  }

  it('glows up and dims smoothly, never cutting in or out', () => {
    expect(FADE_IN).toBeGreaterThanOrEqual(0.25);
    expect(FADE_OUT).toBeGreaterThanOrEqual(0.5);
    for (let t = 0; t < 3; t += STEP)
      expect(Math.abs(sparkGlow(t + STEP, 1) - sparkGlow(t, 1))).toBeLessThan(0.1);
  });

  it('stays at three flashes a second or fewer, even with the shortest look and quick peeks', () => {
    // A burst, a peek as soon as it has faded, a miss and its re-burst, then the next firework.
    const look = Math.min(...PACES.map((p) => p.min));
    const fadeDone = look + FADE_OUT;
    const events = [0, fadeDone, 2 * fadeDone, 3 * fadeDone + 0.2];
    expect(flashesPerSecond(trace(events, look, 8), STEP)).toBeLessThanOrEqual(3);
  });

  it('counts a real strobe as more than three flashes', () => {
    const strobe = Array.from({ length: 240 }, (_, i) => (Math.floor(i / 12) % 2 ? 1 : 0));
    expect(flashesPerSecond(strobe, STEP)).toBeGreaterThan(3);
  });
});

describe('points, stars and help', () => {
  it('pays a first-look bonus, doubles in the Big show and triples in the finale', () => {
    expect(fireworkPoints({ firstLook: false, bigShow: false, finale: false })).toBe(10);
    expect(fireworkPoints({ firstLook: true, bigShow: false, finale: false })).toBe(20);
    expect(fireworkPoints({ firstLook: true, bigShow: true, finale: false })).toBe(40);
    expect(fireworkPoints({ firstLook: true, bigShow: false, finale: true })).toBe(60);
  });

  it('gives stars for first looks, and one for finishing', () => {
    expect(roundStars(12)).toBe(3);
    expect(roundStars(10)).toBe(3);
    expect(roundStars(7)).toBe(2);
    expect(roundStars(0)).toBe(1);
  });

  it('helps by structure and try, never by the answer', () => {
    const tenFrame = createPattern('tenFrame', {}, seeded(3));
    expect(hintFor(tenFrame, 1, 99)).toBe('lookAgain');
    expect(hintFor(tenFrame, 2, 99)).toBe('hintFive');
    // The same structure gets the same help whatever its count.
    const others = many('tenFrame', 30).map((p) => hintFor(p, 2, 0));
    expect(new Set(others)).toEqual(new Set(['hintFive']));
    expect(hintFor(createPattern('double', {}, seeded(1)), 2, 0)).toBe('hintMirror');
  });

  it('reminds a near double answered one off to look for the extra spark', () => {
    const pattern = createPattern('nearMore', {}, seeded(5));
    expect(hintFor(pattern, 1, pattern.answer + 1)).toBe('nearMore');
    expect(hintFor(pattern, 1, pattern.answer - 1)).toBe('nearMore');
    expect(hintFor(pattern, 1, pattern.answer + 3)).toBe('lookAgain');
  });

  it('offers three or four honest ways to have seen it, "I counted" last', () => {
    for (const kind of KINDS)
      for (const pattern of many(kind, 40)) {
        const ways = waysToSee(pattern, seeded(2));
        expect(ways.length).toBeGreaterThanOrEqual(2);
        expect(ways.length).toBeLessThanOrEqual(4);
        expect(ways.at(-1)).toEqual({ kind: 'counted' });
        for (const way of ways)
          if (way.kind === 'parts')
            expect(sum(way.parts)).toBe(kind === 'makeTen' ? 10 : pattern.answer);
      }
  });
});

describe('the firework book', () => {
  it('draws every shape inside its box', () => {
    for (const shape of BOOK_SHAPES)
      for (const point of shapePoints(shape, 60)) {
        expect(Math.abs(point.x)).toBeLessThanOrEqual(1.3);
        expect(Math.abs(point.y)).toBeLessThanOrEqual(1.3);
      }
  });
});
