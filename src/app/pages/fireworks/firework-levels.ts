import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';
import { BOOK_SHAPES, BookShape } from './firework-shapes';

/** A seeded or real source of numbers in [0, 1). */
export type Random = () => number;

/** A small, fast seeded generator, so tests can replay a round. */
export function seeded(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(random: Random, items: readonly T[]): T => items[int(random, 0, items.length - 1)];

// ---------------------------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------------------------

/** How a burst's sparks look. Two-burst fireworks always use one of each. */
export type SparkShape = 'round' | 'star';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** One glowing spark. `burst` is 0 (left or only) or 1 (right); `group` picks its outline. */
export interface Spark extends Point {
  readonly burst: 0 | 1;
  readonly group: number;
}

/** A rounded box around sparks, centred on (x, y) and turned by `angle` radians. */
export interface Box extends Point {
  readonly w: number;
  readonly h: number;
  readonly angle: number;
}

export type PatternKind =
  | 'dice'
  | 'small'
  | 'five'
  | 'tenFrame'
  | 'makeTen'
  | 'twoDice'
  | 'tenAnd'
  | 'double'
  | 'nearMore'
  | 'nearLess'
  | 'twenty';

/**
 * One firework's spark pattern, in spark units (neighbouring sparks are one unit apart), centred
 * on the origin with y pointing up. Renderers scale it to fit their sky.
 */
export interface Pattern {
  readonly kind: PatternKind;
  readonly sparks: readonly Spark[];
  /** Empty places that belong to the structure: a ten-frame's free cells, a near double's gap. */
  readonly empty: readonly (Point & { readonly burst: 0 | 1 })[];
  /** Ten-frame borders, always drawn faintly: they are the structure the child reads. */
  readonly frames: readonly Box[];
  /** One outline per group of sparks: shown after a second miss and on the re-bloom. */
  readonly groups: readonly Box[];
  /** The parts of the number sentence shown after a right answer: [5, 3] reads 5 + 3 = 8. */
  readonly parts: readonly number[];
  readonly bursts: 1 | 2;
  /** The spark shape of burst 0 and burst 1. */
  readonly shapes: readonly [SparkShape, SparkShape];
  /** The number the child gives: the sparks, or for make-ten the empty spaces. */
  readonly answer: number;
  /** Index into the firework colours. */
  readonly hue: number;
}

/** Firework colours on a dusk sky: warm golds, blues, greens and pinks, never a saturated red. */
export const HUES = ['#ffd45c', '#7cc8ff', '#7fe0a6', '#ff9ccf', '#c9a6ff', '#7fe6e0'] as const;

interface Local {
  points: { x: number; y: number; group: number }[];
  empty: { x: number; y: number }[];
  frames: Box[];
  /** Parts as counts per group, in group order. */
  groups: number;
}

const DICE: readonly (readonly (readonly [number, number, number])[])[] = [
  [],
  [[0, 0, 0]],
  [
    [-1, 1, 0],
    [1, -1, 0],
  ],
  [
    [-1, 1, 0],
    [0, 0, 0],
    [1, -1, 0],
  ],
  [
    [-1, 1, 0],
    [-1, -1, 0],
    [1, 1, 1],
    [1, -1, 1],
  ],
  [
    [-1, 1, 0],
    [-1, -1, 0],
    [1, 1, 2],
    [1, -1, 2],
    [0, 0, 1],
  ],
  [
    [-1, 1, 0],
    [-1, 0, 0],
    [-1, -1, 0],
    [1, 1, 1],
    [1, 0, 1],
    [1, -1, 1],
  ],
];

/** A dice face of 1–6 pips, grouped by column (5 reads 2 + 1 + 2), or as one group. */
function dice(n: number, oneGroup = false): Local {
  const points = DICE[n].map(([x, y, group]) => ({ x, y, group: oneGroup ? 0 : group }));
  return { points, empty: [], frames: [], groups: oneGroup ? 1 : groupCount(points) };
}

function groupCount(points: readonly { group: number }[]) {
  return points.reduce((most, p) => Math.max(most, p.group + 1), 0);
}

/** Rows of five, top row first, left to right: 7 is a full row of five and two below it. */
function rows(n: number, perRow = 5, tenGap = 0): Local {
  const points: Local['points'] = [];
  for (let index = 0; index < n; index++) {
    const row = Math.floor(index / perRow);
    // An optional extra gap after every two rows, so tens stand apart.
    points.push({
      x: (index % perRow) - (perRow - 1) / 2,
      y: -(row + Math.floor(row / 2) * tenGap),
      group: row,
    });
  }
  return { points, empty: [], frames: [], groups: Math.ceil(n / perRow) };
}

/** A ten-frame (two rows of five cells) with `n` sparks, filled row by row. */
function tenFrame(n: number, y = 0): Local {
  const points: Local['points'] = [];
  const empty: Local['empty'] = [];
  for (let index = 0; index < 10; index++) {
    const cell = { x: (index % 5) - 2, y: y + (index < 5 ? 0.5 : -0.5) };
    if (index < n) points.push({ ...cell, group: index < 5 ? 0 : 1 });
    else empty.push(cell);
  }
  return {
    points,
    empty,
    frames: [{ x: 0, y, w: 5.2, h: 2.2, angle: 0 }],
    groups: n > 5 ? 2 : 1,
  };
}

/** Small groups of 1–5 in arrangements that are not dice: lines, triangles, squares, clusters. */
function small(n: number, random: Random): Local {
  const choices: (() => Local)[] = [];
  const line = (count: number, gapAfter = -1, group2 = false) => ({
    points: Array.from({ length: count }, (_, i) => ({
      x:
        i - (count - 1) / 2 + (gapAfter >= 0 && i > gapAfter ? 0.6 : 0) - (gapAfter >= 0 ? 0.3 : 0),
      y: 0,
      group: group2 && i > gapAfter ? 1 : 0,
    })),
    empty: [],
    frames: [],
    groups: group2 ? 2 : 1,
  });
  if (n <= 3) choices.push(() => line(n));
  if (n === 3)
    choices.push(() => ({
      points: [
        { x: -0.6, y: -0.45, group: 0 },
        { x: 0.6, y: -0.45, group: 0 },
        { x: 0, y: 0.6, group: 0 },
      ],
      empty: [],
      frames: [],
      groups: 1,
    }));
  if (n === 4) {
    choices.push(() => ({
      points: [
        { x: -0.5, y: 0.5, group: 0 },
        { x: -0.5, y: -0.5, group: 0 },
        { x: 0.5, y: 0.5, group: 1 },
        { x: 0.5, y: -0.5, group: 1 },
      ],
      empty: [],
      frames: [],
      groups: 2,
    }));
    choices.push(() => line(4, 1, true));
  }
  if (n === 5) {
    // A little house: a square of four and one on top.
    choices.push(() => ({
      points: [
        { x: -0.5, y: -0.6, group: 0 },
        { x: 0.5, y: -0.6, group: 0 },
        { x: -0.5, y: 0.4, group: 0 },
        { x: 0.5, y: 0.4, group: 0 },
        { x: 0, y: 1.3, group: 1 },
      ],
      empty: [],
      frames: [],
      groups: 2,
    }));
    choices.push(() => line(5, 1, true));
  }
  if (n >= 2) choices.push(() => cluster(n, random));
  if (n === 1) choices.push(() => line(1));
  return pick(random, choices)();
}

/** A scattered cluster, split into two small heaps once there are more than three. */
function cluster(n: number, random: Random): Local {
  const sizes = n > 3 ? [Math.floor(n / 2), Math.ceil(n / 2)] : [n];
  const points: Local['points'] = [];
  sizes.forEach((size, group) => {
    const cx = sizes.length === 1 ? 0 : group === 0 ? -1.1 : 1.1;
    const start = random() * Math.PI * 2;
    for (let i = 0; i < size; i++) {
      if (size === 1) {
        points.push({ x: cx, y: 0, group });
        continue;
      }
      const angle = start + (i / size) * Math.PI * 2;
      const r = size === 2 ? 0.5 : 0.62;
      points.push({ x: cx + Math.cos(angle) * r, y: Math.sin(angle) * r, group });
    }
  });
  return { points, empty: [], frames: [], groups: sizes.length };
}

/** A full five and 1–5 more, as two rows or as a dice five beside a smaller dice face. */
function five(n: number, random: Random): Local {
  const extra = n - 5;
  if (extra === 0 || random() < 0.5) return rows(n);
  const left = dice(5, true);
  const right = dice(extra, true);
  return {
    points: [
      ...left.points.map((p) => ({ ...p, x: p.x - 1.7 })),
      ...right.points.map((p) => ({ ...p, x: p.x + 1.7, group: 1 })),
    ],
    empty: [],
    frames: [],
    groups: 2,
  };
}

/** What one side of a double looks like: a dice face up to 6, rows of five above. */
function doubleSide(n: number): Local {
  return n <= 6 ? dice(n, true) : rows(n);
}

/** Every group becomes one group (used when a whole burst is one part). */
function asOne(local: Local, group = 0): Local {
  return { ...local, points: local.points.map((p) => ({ ...p, group })), groups: 1 };
}

const DEG = Math.PI / 180;

interface Placed {
  sparks: Spark[];
  empty: (Point & { burst: 0 | 1 })[];
  frames: Box[];
  groups: Box[];
}

/** Rotates, mirrors and tags one burst's local pattern; outlines follow the sparks. */
function place(local: Local, burst: 0 | 1, angle: number, mirror: boolean, groupBase = 0): Placed {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const move = (p: Point) => {
    const x = p.x * cos - p.y * sin;
    const y = p.x * sin + p.y * cos;
    return { x: mirror ? -x : x, y };
  };
  const turn = (box: Box): Box => ({
    ...box,
    ...move(box),
    angle: mirror ? -(box.angle + angle) : box.angle + angle,
  });
  const groups: Box[] = [];
  for (let group = 0; group < local.groups; group++) {
    const members = local.points.filter((p) => p.group === group);
    if (members.length) groups.push(turn(outline(members)));
  }
  return {
    sparks: local.points.map((p) => ({ ...move(p), burst, group: p.group + groupBase })),
    empty: local.empty.map((p) => ({ ...move(p), burst })),
    frames: local.frames.map(turn),
    groups,
  };
}

/** The rounded box around some sparks, in their own (unturned) coordinates. */
function outline(points: readonly Point[]): Box {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const bottom = Math.min(...ys);
  const top = Math.max(...ys);
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    w: right - left + 0.9,
    h: top - bottom + 0.9,
    angle: 0,
  };
}

/** Everything a placed burst covers: sparks, gaps and frames. */
function extent(placed: Placed) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of [...placed.sparks, ...placed.empty]) {
    xs.push(p.x - 0.5, p.x + 0.5);
    ys.push(p.y - 0.5, p.y + 0.5);
  }
  for (const box of placed.frames) {
    const c = Math.abs(Math.cos(box.angle));
    const s = Math.abs(Math.sin(box.angle));
    const hw = (box.w * c + box.h * s) / 2;
    const hh = (box.w * s + box.h * c) / 2;
    xs.push(box.x - hw, box.x + hw);
    ys.push(box.y - hh, box.y + hh);
  }
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    bottom: Math.min(...ys),
    top: Math.max(...ys),
  };
}

function shift(placed: Placed, dx: number, dy: number): Placed {
  const by = <T extends Point>(p: T): T => ({ ...p, x: p.x + dx, y: p.y + dy });
  return {
    sparks: placed.sparks.map(by),
    empty: placed.empty.map(by),
    frames: placed.frames.map(by),
    groups: placed.groups.map(by),
  };
}

/** The gap between two bursts, in spark units: wide enough that they never read as one. */
export const BURST_GAP = 1.8;

/** Puts one or two placed bursts side by side and centres the whole firework on the origin. */
function arrange(bursts: readonly Placed[]): Placed {
  let laid: Placed[] = [];
  if (bursts.length === 1) laid = [bursts[0]];
  else {
    const [a, b] = bursts.map(extent);
    laid = [
      shift(bursts[0], -BURST_GAP / 2 - a.right, -(a.top + a.bottom) / 2),
      shift(bursts[1], BURST_GAP / 2 - b.left, -(b.top + b.bottom) / 2),
    ];
  }
  const all: Placed = {
    sparks: laid.flatMap((p) => p.sparks),
    empty: laid.flatMap((p) => p.empty),
    frames: laid.flatMap((p) => p.frames),
    groups: laid.flatMap((p) => p.groups),
  };
  const box = extent(all);
  return shift(all, -(box.left + box.right) / 2, -(box.top + box.bottom) / 2);
}

/** Nudges every spark a little, keeping the structure easy to read. */
function jitter(sparks: readonly Spark[], random: Random, amount: number): Spark[] {
  return sparks.map((s) => ({
    ...s,
    x: s.x + (random() * 2 - 1) * amount,
    y: s.y + (random() * 2 - 1) * amount,
  }));
}

const JITTER = 0.07;

interface Built {
  readonly kind: PatternKind;
  readonly bursts: readonly Placed[];
  readonly parts: readonly number[];
  readonly answer: number;
}

const QUARTER = [0, 90 * DEG, 180 * DEG, 270 * DEG];
const DICE_TURNS = [0, 45 * DEG, 90 * DEG];
const FRAME_TURNS = [0, 90 * DEG];

/** Builds one pattern of a kind, before colour and jitter. */
function build(kind: PatternKind, random: Random): Built {
  const turn = (choices: readonly number[]) => pick(random, choices);
  const flip = () => random() < 0.5;
  switch (kind) {
    case 'dice': {
      const n = int(random, 1, 6);
      const local = dice(n);
      return {
        kind,
        bursts: [place(local, 0, turn(DICE_TURNS), flip())],
        parts: partsOf(local),
        answer: n,
      };
    }
    case 'small': {
      const n = int(random, 1, 5);
      const local = small(n, random);
      return {
        kind,
        bursts: [place(local, 0, random() * Math.PI * 2, flip())],
        parts: partsOf(local),
        answer: n,
      };
    }
    case 'five': {
      const n = int(random, 5, 10);
      const local = five(n, random);
      return {
        kind,
        bursts: [place(local, 0, turn(FRAME_TURNS), flip())],
        parts: n > 5 ? [5, n - 5] : [5],
        answer: n,
      };
    }
    case 'tenFrame': {
      const n = int(random, 1, 10);
      return {
        kind,
        bursts: [place(tenFrame(n), 0, turn(FRAME_TURNS), false)],
        parts: n > 5 ? [5, n - 5] : [n],
        answer: n,
      };
    }
    case 'makeTen': {
      // A full frame (answer 0) now and then; mostly 1–9 empty spaces.
      const filled = random() < 0.08 ? 10 : int(random, 1, 9);
      return {
        kind,
        bursts: [place(tenFrame(filled), 0, turn(FRAME_TURNS), false)],
        parts: [filled, 10 - filled],
        answer: 10 - filled,
      };
    }
    case 'twoDice': {
      const a = int(random, 1, 6);
      const b = int(random, a === 1 ? 2 : 1, 6);
      return {
        kind,
        bursts: [
          place(dice(a, true), 0, turn(DICE_TURNS), flip()),
          place(dice(b, true), 1, turn(DICE_TURNS), flip(), 1),
        ],
        parts: [a, b],
        answer: a + b,
      };
    }
    case 'tenAnd': {
      const frameRight = random() < 0.5;
      const n = frameRight ? int(random, 1, 10) : int(random, 1, 6);
      const right = frameRight ? asOne(tenFrame(n), 0) : dice(n, true);
      return {
        kind,
        bursts: [
          place(asOne(tenFrame(10)), 0, 0, false),
          place(right, 1, frameRight ? 0 : turn(DICE_TURNS), flip(), 1),
        ],
        parts: [10, n],
        answer: 10 + n,
      };
    }
    case 'double': {
      const n = int(random, 1, 10);
      const side = doubleSide(n);
      const angle = n <= 6 ? turn(DICE_TURNS) : turn(FRAME_TURNS);
      return {
        kind,
        bursts: [place(asOne(side), 0, angle, false), place(asOne(side, 0), 1, angle, true, 1)],
        parts: [n, n],
        answer: 2 * n,
      };
    }
    case 'nearMore':
    case 'nearLess': {
      const more = kind === 'nearMore';
      const n = more ? int(random, 1, 9) : int(random, 2, 10);
      const side = asOne(doubleSide(n));
      const changed = more ? withExtra(side, n) : withGap(side, n);
      const angle = n <= 6 ? 0 : turn(FRAME_TURNS);
      const changedRight = flip();
      const plain = place(side, 0, angle, false);
      const odd = place(changed, 1, angle, true, 1);
      const bursts = changedRight
        ? [plain, odd]
        : [place(changed, 0, angle, false), place(side, 1, angle, true, 2)];
      const m = more ? n + 1 : n - 1;
      return {
        kind,
        bursts,
        parts: changedRight ? [n, m] : [m, n],
        answer: n + m,
      };
    }
    case 'twenty': {
      const n = int(random, 11, 20);
      if (random() < 0.5) {
        const top = tenFrame(10, 1.35);
        const bottom = tenFrame(n - 10, -1.35);
        const local: Local = {
          points: [
            ...top.points.map((p) => ({ ...p, group: 0 })),
            ...bottom.points.map((p) => ({ ...p, group: 1 })),
          ],
          empty: [...top.empty, ...bottom.empty],
          frames: [...top.frames, ...bottom.frames],
          groups: 2,
        };
        return { kind, bursts: [place(local, 0, 0, false)], parts: [10, n - 10], answer: n };
      }
      // Rows of five with a gap after every ten.
      const local = rows(n, 5, 0.6);
      const points = local.points.map((p) => ({ ...p, group: p.group < 2 ? 0 : 1 }));
      return {
        kind,
        bursts: [place({ points, empty: [], frames: [], groups: 2 }, 0, 0, false)],
        parts: [10, n - 10],
        answer: n,
      };
    }
  }
}

function partsOf(local: Local): number[] {
  return Array.from(
    { length: local.groups },
    (_, group) => local.points.filter((p) => p.group === group).length,
  ).filter((n) => n > 0);
}

/** A double side with one more spark in the next natural place: below a dice face, or in the row. */
function withExtra(side: Local, n: number): Local {
  const base = asOne(n <= 6 ? side : rows(n));
  // Below a dice face, clear of it, so it reads as "one more" and not as part of the face.
  const at =
    n <= 6
      ? { x: 0, y: Math.min(...base.points.map((p) => p.y)) - 1.4 }
      : rows(n + 1).points[n];
  // The extra spark is its own group, so the outlines show the double and the one more.
  return { ...base, points: [...base.points, { ...at, group: 1 }], groups: 2 };
}

/** A double side with one spark missing, its place left as a hollow ring. */
function withGap(side: Local, n: number): Local {
  const points = [...side.points];
  // Take the centre pip of an odd dice face, or the last spark of the rows.
  const index =
    n <= 6 && n % 2 === 1 ? points.findIndex((p) => p.x === 0 && p.y === 0) : points.length - 1;
  const [gone] = points.splice(index, 1);
  return { ...side, points, empty: [...side.empty, { x: gone.x, y: gone.y }] };
}

/** A stable fingerprint, so the same picture never comes twice in a row. */
export function signature(pattern: Pattern): string {
  const r = (n: number) => Math.round(n * 2) / 2;
  return `${pattern.kind}:${pattern.answer}:${pattern.sparks
    .map((s) => `${r(s.x)},${r(s.y)}`)
    .sort()
    .join(';')}`;
}

/** Makes one coloured, jittered pattern of a kind. */
export function createPattern(
  kind: PatternKind,
  options: { jitter?: boolean; avoidHue?: number } = {},
  random: Random = Math.random,
): Pattern {
  const built = build(kind, random);
  const placed = arrange(built.bursts.map((b) => b));
  const shapes: [SparkShape, SparkShape] = random() < 0.5 ? ['round', 'star'] : ['star', 'round'];
  let hue = int(random, 0, HUES.length - 1);
  if (hue === options.avoidHue) hue = (hue + 1 + int(random, 0, HUES.length - 2)) % HUES.length;
  return {
    kind: built.kind,
    sparks: options.jitter ? jitter(placed.sparks, random, JITTER) : placed.sparks,
    empty: placed.empty,
    frames: placed.frames,
    groups: placed.groups,
    parts: built.parts,
    bursts: built.bursts.length as 1 | 2,
    shapes,
    answer: built.answer,
    hue,
  };
}

// ---------------------------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------------------------

export interface FireworkLevel {
  readonly level: number;
  /** The topic on the games hub. */
  readonly group: MessageKey;
  /** The pattern kinds the level mixes. */
  readonly kinds: readonly PatternKind[];
  /** The numbers on the spark pad. */
  readonly pad: readonly [number, number];
  /** Jitter sparks a little once the structure is familiar. */
  readonly jitter: boolean;
  /** How the level's look time starts: the pace's usual base, a little shorter, or its shortest. */
  readonly look: 'base' | 'short' | 'shortest';
  /** Stars needed to master the level. */
  readonly mastery: 2 | 3;
  /** The hub card's example. */
  readonly example: string;
  /** The firework shape this level adds to the book. */
  readonly shape: BookShape;
}

export const fireworkLevels: readonly FireworkLevel[] = [
  {
    level: 1,
    group: 'fireworksFirstSparks',
    kinds: ['dice'],
    pad: [1, 10],
    jitter: false,
    look: 'base',
    mastery: 2,
    example: '⚄ → 5',
    shape: BOOK_SHAPES[0],
  },
  {
    level: 2,
    group: 'fireworksFirstSparks',
    kinds: ['small'],
    pad: [1, 10],
    jitter: false,
    look: 'base',
    mastery: 2,
    example: '∴ → 3',
    shape: BOOK_SHAPES[1],
  },
  {
    level: 3,
    group: 'fireworksFives',
    kinds: ['five'],
    pad: [1, 10],
    jitter: true,
    look: 'base',
    mastery: 2,
    example: '5 + 3 = 8',
    shape: BOOK_SHAPES[2],
  },
  {
    level: 4,
    group: 'fireworksFives',
    kinds: ['tenFrame'],
    pad: [1, 10],
    jitter: true,
    look: 'base',
    mastery: 2,
    example: '5 + 2 = 7',
    shape: BOOK_SHAPES[3],
  },
  {
    level: 5,
    group: 'fireworksFives',
    kinds: ['makeTen'],
    pad: [0, 9],
    jitter: true,
    look: 'base',
    mastery: 2,
    example: '8 + □ = 10',
    shape: BOOK_SHAPES[4],
  },
  {
    level: 6,
    group: 'fireworksTwoBursts',
    kinds: ['twoDice'],
    pad: [1, 20],
    jitter: true,
    look: 'base',
    mastery: 2,
    example: '⚃ + ⚂ = 7',
    shape: BOOK_SHAPES[5],
  },
  {
    level: 7,
    group: 'fireworksTwoBursts',
    kinds: ['tenAnd'],
    pad: [1, 20],
    jitter: true,
    look: 'base',
    mastery: 2,
    example: '10 + 4 = 14',
    shape: BOOK_SHAPES[6],
  },
  {
    level: 8,
    group: 'fireworksDoubles',
    kinds: ['double'],
    pad: [1, 20],
    jitter: true,
    look: 'base',
    mastery: 2,
    example: '6 + 6 = 12',
    shape: BOOK_SHAPES[7],
  },
  {
    level: 9,
    group: 'fireworksDoubles',
    kinds: ['nearMore'],
    pad: [1, 20],
    jitter: true,
    look: 'base',
    mastery: 2,
    example: '6 + 7 = 13',
    shape: BOOK_SHAPES[8],
  },
  {
    level: 10,
    group: 'fireworksDoubles',
    kinds: ['double', 'nearMore', 'nearLess'],
    pad: [1, 20],
    jitter: true,
    look: 'base',
    mastery: 2,
    example: '7 + 6 = 13',
    shape: BOOK_SHAPES[9],
  },
  {
    level: 11,
    group: 'fireworksGrandShow',
    kinds: ['twenty'],
    pad: [1, 20],
    jitter: true,
    look: 'short',
    mastery: 2,
    example: '10 + 7 = 17',
    shape: BOOK_SHAPES[10],
  },
  {
    level: 12,
    group: 'fireworksGrandShow',
    kinds: [
      'dice',
      'five',
      'tenFrame',
      'twoDice',
      'tenAnd',
      'double',
      'nearMore',
      'nearLess',
      'twenty',
    ],
    pad: [1, 20],
    jitter: true,
    look: 'shortest',
    mastery: 3,
    example: '1 … 20',
    shape: BOOK_SHAPES[11],
  },
];

export const TOTAL_LEVELS = fireworkLevels.length;

export const fireworkCatalogLevels: readonly Level[] = fireworkLevels.map((level) => ({
  id: `fireworks-${level.level}`,
  title: `fireworks${level.level}` as MessageKey,
  description: `fireworks${level.level}Help` as MessageKey,
  skills: ['subitizing', ...level.kinds],
  format: 'fireworks',
  group: level.group,
}));

export function fireworkLevel(id: string | null | undefined): FireworkLevel | undefined {
  const match = /^fireworks-([1-9]\d*)$/.exec(id ?? '');
  return match ? fireworkLevels.find((level) => level.level === Number(match[1])) : undefined;
}

/** Where a level sits in the list, counting from 1: the number a child sees. */
export function fireworkPosition(level: FireworkLevel): number {
  return fireworkLevels.indexOf(level) + 1;
}

/** The numbers on the spark pad, smallest first. */
export function padNumbers(level: FireworkLevel): number[] {
  const [low, high] = level.pad;
  return Array.from({ length: high - low + 1 }, (_, i) => low + i);
}

/** Twelve fireworks, then the grand finale. */
export const ROUND_LENGTH = 12;
export const FINALE = ROUND_LENGTH;

/**
 * A round's thirteen patterns: twelve fireworks and the grand finale last. The same picture never
 * comes twice in a row, and neither does the same answer or colour.
 */
export function createRound(level: FireworkLevel, random: Random = Math.random): Pattern[] {
  const patterns: Pattern[] = [];
  for (let index = 0; index <= ROUND_LENGTH; index++) {
    const before = patterns.at(-1);
    let pattern: Pattern | undefined;
    for (let attempt = 0; attempt < 60; attempt++) {
      const kind = pick(random, level.kinds);
      const made = createPattern(kind, { jitter: level.jitter, avoidHue: before?.hue }, random);
      pattern = made;
      if (!before) break;
      if (signature(made) === signature(before)) continue;
      if (made.answer === before.answer && attempt < 40) continue;
      break;
    }
    patterns.push(pattern!);
  }
  return patterns;
}

// ---------------------------------------------------------------------------------------------
// Look time
// ---------------------------------------------------------------------------------------------

/** How long a burst holds. Only the look is timed, never the answer. */
export const PACES = [
  { id: 'gentle', label: 'paceGentle', base: 3.0, min: 2.5, max: 4.0, freePeek: true },
  { id: 'glow', label: 'paceGlow', base: 2.0, min: 1.5, max: 2.5, freePeek: false },
  { id: 'pop', label: 'pacePop', base: 1.5, min: 1.0, max: 2.0, freePeek: false },
] as const;

export type FireworkPace = (typeof PACES)[number]['id'];

export function parsePace(value: unknown): FireworkPace {
  return PACES.find((pace) => pace.id === value)?.id ?? 'gentle';
}

export function paceOf(id: FireworkPace) {
  return PACES.find((pace) => pace.id === id)!;
}

/** Two-burst fireworks hold a little longer: there are two pictures to see. */
export const TWO_BURST_EXTRA = 0.4;
/** After a third miss the burst holds this long for the rest of that firework. */
export const SLOW_LOOK = 4;

/** The adaptive look time: shorter after a run of first looks, longer after a miss or a peek. */
export interface Look {
  readonly seconds: number;
  /** First-try right answers in a row since the look last got shorter. */
  readonly run: number;
}

export function startLook(pace: FireworkPace, level: FireworkLevel): Look {
  const { base, min } = paceOf(pace);
  const seconds =
    level.look === 'shortest' ? min : level.look === 'short' ? Math.max(min, base - 0.3) : base;
  return { seconds, run: 0 };
}

const clampLook = (pace: FireworkPace, seconds: number) => {
  const { min, max } = paceOf(pace);
  return Math.round(Math.min(max, Math.max(min, seconds)) * 100) / 100;
};

export type LookEvent = 'firstLook' | 'miss' | 'peek' | 'counted' | 'right';

/** Moves the look time after something happened on a firework. */
export function adaptLook(pace: FireworkPace, look: Look, event: LookEvent): Look {
  switch (event) {
    case 'firstLook': {
      const run = look.run + 1;
      return run >= 3 ? { seconds: clampLook(pace, look.seconds - 0.2), run: 0 } : { ...look, run };
    }
    case 'miss':
    case 'peek':
      return { seconds: clampLook(pace, look.seconds + 0.3), run: 0 };
    case 'counted':
      return { ...look, seconds: clampLook(pace, look.seconds + 0.2) };
    case 'right':
      return { ...look, run: 0 };
  }
}

/** How long this burst of this firework holds. */
export function lookSeconds(look: Look, pattern: Pattern, misses: number): number {
  if (misses >= 3) return SLOW_LOOK;
  return look.seconds + (pattern.bursts === 2 ? TWO_BURST_EXTRA : 0);
}

// ---------------------------------------------------------------------------------------------
// Points, streaks and stars
// ---------------------------------------------------------------------------------------------

/** Five first looks in a row start the Big show: points double until a miss. */
export const BIG_SHOW = 5;
export const BASE_POINTS = 10;
export const FIRST_LOOK_BONUS = 10;
export const SPOTTER_BONUS = 5;
export const FINALE_TIMES = 3;

export function fireworkPoints(hit: { firstLook: boolean; bigShow: boolean; finale: boolean }) {
  const points = BASE_POINTS + (hit.firstLook ? FIRST_LOOK_BONUS : 0);
  return points * (hit.bigShow ? 2 : 1) * (hit.finale ? FINALE_TIMES : 1);
}

/** Stars reward care, not speed: first looks out of the twelve fireworks. Finishing earns one. */
export function roundStars(firstLooks: number): 1 | 2 | 3 {
  return firstLooks >= 10 ? 3 : firstLooks >= 7 ? 2 : 1;
}

export function isMastered(level: FireworkLevel, stars: number): boolean {
  return stars >= level.mastery;
}

// ---------------------------------------------------------------------------------------------
// Help after a miss, and "how did you see it?"
// ---------------------------------------------------------------------------------------------

export type HintKey =
  | 'lookAgain'
  | 'hintDice'
  | 'hintSmall'
  | 'hintFive'
  | 'hintEmpty'
  | 'hintTwo'
  | 'hintTen'
  | 'hintMirror'
  | 'hintDouble'
  | 'hintTens'
  | 'nearMore'
  | 'nearLess';

const KIND_HINTS: Readonly<Record<PatternKind, HintKey>> = {
  dice: 'hintDice',
  small: 'hintSmall',
  five: 'hintFive',
  tenFrame: 'hintFive',
  makeTen: 'hintEmpty',
  twoDice: 'hintTwo',
  tenAnd: 'hintTen',
  double: 'hintMirror',
  nearMore: 'hintDouble',
  nearLess: 'hintDouble',
  twenty: 'hintTens',
};

/**
 * Flick's help after a miss, chosen by the pattern's structure and the try, never by the answer:
 * look again after the first miss, then a question about the structure. A near double answered
 * one off gets the double reminder.
 */
export function hintFor(pattern: Pattern, misses: number, given: number): HintKey {
  if (
    (pattern.kind === 'nearMore' || pattern.kind === 'nearLess') &&
    Math.abs(given - pattern.answer) === 1
  )
    return pattern.kind;
  if (misses <= 1) return 'lookAgain';
  return KIND_HINTS[pattern.kind];
}

/** One answer to "how did you see it?". */
export type Way =
  | { readonly kind: 'parts'; readonly parts: readonly number[] }
  | { readonly kind: 'double'; readonly n: number }
  | { readonly kind: 'doubleMore'; readonly n: number }
  | { readonly kind: 'doubleLess'; readonly n: number }
  | { readonly kind: 'takeAway'; readonly from: number; readonly n: number }
  | { readonly kind: 'empty' }
  | { readonly kind: 'saw' }
  | { readonly kind: 'counted' };

const wayKey = (way: Way) => JSON.stringify(way);

/**
 * Three or four honest ways to have seen a pattern, the pattern's own structure first and "I
 * counted" last. Any choice earns the same spotter bonus.
 */
export function waysToSee(pattern: Pattern, random: Random = Math.random): Way[] {
  const n = pattern.answer;
  const ways: Way[] = [];
  const add = (way: Way) => {
    if (!ways.some((w) => wayKey(w) === wayKey(way))) ways.push(way);
  };
  const [a, b] = pattern.parts;
  switch (pattern.kind) {
    case 'makeTen':
      add({ kind: 'empty' });
      add({ kind: 'takeAway', from: 10, n: a });
      add({ kind: 'parts', parts: [a, b] });
      break;
    case 'double':
      add({ kind: 'double', n: a });
      if (a > 5) add({ kind: 'parts', parts: [10, n - 10] });
      else add({ kind: 'parts', parts: [a, b] });
      break;
    case 'nearMore':
    case 'nearLess': {
      const small = Math.min(a, b);
      add({ kind: 'doubleMore', n: small });
      add({ kind: 'doubleLess', n: small + 1 });
      add({ kind: 'parts', parts: [a, b] });
      break;
    }
    default:
      if (n <= 4 && pattern.bursts === 1) add({ kind: 'saw' });
      if (pattern.parts.length > 1) add({ kind: 'parts', parts: pattern.parts });
      if (n > 5 && n < 10) add({ kind: 'parts', parts: [5, n - 5] });
      if (n >= 6 && n <= 9) add({ kind: 'takeAway', from: 10, n: 10 - n });
      if (n > 10 && n < 20) add({ kind: 'parts', parts: [10, n - 10] });
      if (n === 20) add({ kind: 'double', n: 10 });
      if (n <= 4)
        add({ kind: 'parts', parts: [Math.ceil(n / 2), Math.floor(n / 2)].filter(Boolean) });
      if (n === 5) add({ kind: 'parts', parts: [4, 1] });
      if (pattern.parts.length === 1 && n > 4) add({ kind: 'saw' });
  }
  // Shuffled, so the pattern's own way is not always the first button.
  const mixed = ways.slice(0, 3);
  for (let i = mixed.length - 1; i > 0; i--) {
    const j = int(random, 0, i);
    [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
  }
  return [...mixed, { kind: 'counted' }];
}
