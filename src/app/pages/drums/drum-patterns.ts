import type { Level } from '../../core/catalog';
import type { Locale, MessageKey } from '../../core/messages';

export type Random = () => number;

/** The help card a level shows after a second miss: its rule, told with other numbers. */
export type DrumRule =
  | 'tens'
  | 'tensBack'
  | 'fives'
  | 'fivesBack'
  | 'twos'
  | 'twosBack'
  | 'odd'
  | 'ones'
  | 'onesBack'
  | 'threes'
  | 'fours'
  | 'newTen'
  | 'backTen'
  | 'hundred';

/** One run of mushrooms: a path that counts on or back, or the call-and-response verse. */
export interface VerseSpec {
  readonly kind: 'path' | 'call';
  /** Signed steps; a path picks one, every call picks its own. */
  readonly steps: readonly number[];
  /** Where a path starts, or a call's first number, for the picked step. */
  readonly start: (random: Random, step: number) => number;
  /** Questions in the verse; a path stops early rather than leave the level's range. */
  readonly answers: number;
  /** Pom hops the first two steps by himself first, so the child sees the pattern. */
  readonly demo: boolean;
}

/** One level of the mushroom drums. */
export interface DrumStage {
  readonly stage: number;
  /** The topic the level sits in on the games hub. */
  readonly group: MessageKey;
  /** The worked example on the level card: "7, 17, 27 …". */
  readonly example: string;
  /** The smallest and largest number on a mushroom. */
  readonly min: number;
  readonly max: number;
  /** Answer buttons per mushroom. */
  readonly choices: 3 | 4;
  readonly verses: readonly [VerseSpec, VerseSpec, VerseSpec];
  /** Steps for the drum solo. */
  readonly solo: readonly number[];
  /** Mastery needs three stars rather than two. */
  readonly strict?: boolean;
}

export const VERSES = 3;
export const SOLO_LENGTH = 4;
/** Calls in the call-and-response verse; every fourth asks for the number before. */
export const CALLS = 8;

const int = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(random: Random, items: readonly T[]): T => items[int(random, 0, items.length - 1)];
/** A random multiple of `step` from `min` to `max`. */
const multiple = (random: Random, step: number, min: number, max: number) =>
  step * int(random, Math.ceil(min / step), Math.floor(max / step));
/** A number from `min` to `max` that is not a multiple of `step`. */
function offPattern(random: Random, step: number, min: number, max: number) {
  for (let tries = 0; tries < 50; tries++) {
    const value = int(random, min, max);
    if (value % step !== 0) return value;
  }
  return min + 1;
}

const fixed = (value: number) => () => value;

const path = (
  steps: readonly number[],
  start: VerseSpec['start'],
  answers: number,
  demo = true,
): VerseSpec => ({ kind: 'path', steps, start, answers, demo });
const call = (steps: readonly number[], start: VerseSpec['start']): VerseSpec => ({
  kind: 'call',
  steps,
  start,
  answers: CALLS,
  demo: true,
});

export const drumStages: readonly DrumStage[] = [
  {
    stage: 1,
    group: 'drumsBigSteps',
    example: '0, 10, 20 …',
    min: 0,
    max: 100,
    choices: 3,
    verses: [
      path([10], fixed(0), 8),
      path([10], fixed(0), 10, false),
      call([10], (random) => multiple(random, 10, 0, 80)),
    ],
    solo: [10],
  },
  {
    stage: 2,
    group: 'drumsBigSteps',
    example: '0, 5, 10 …',
    min: 0,
    max: 100,
    choices: 3,
    verses: [
      path([5], fixed(0), 8),
      path([5], fixed(50), 8),
      call([5], (random) => multiple(random, 5, 0, 90)),
    ],
    solo: [5],
  },
  {
    stage: 3,
    group: 'drumsBigSteps',
    example: '0, 2, 4 …',
    min: 0,
    max: 60,
    choices: 3,
    verses: [
      path([2], fixed(0), 10),
      path([2], fixed(30), 10),
      call([2], (random) => multiple(random, 2, 0, 56)),
    ],
    solo: [2],
  },
  {
    stage: 4,
    group: 'drumsOffTens',
    example: '3, 13, 23 …',
    min: 0,
    max: 99,
    choices: 4,
    verses: [
      path([10], (random) => int(random, 1, 9), 7),
      path([10], (random) => int(random, 1, 9), 9, false),
      call([10], (random) => offPattern(random, 10, 1, 79)),
    ],
    solo: [10],
  },
  {
    stage: 5,
    group: 'drumsOffTens',
    example: '25, 27, 29, 31 …',
    min: 0,
    max: 99,
    choices: 4,
    verses: [
      path([2], (random) => 2 * int(random, 0, 4) + 1, 10),
      path([2], (random) => 2 * int(random, 15, 30) + 1, 10, false),
      call([2], (random) => 2 * int(random, 0, 47) + 1),
    ],
    solo: [2],
  },
  {
    stage: 6,
    group: 'drumsOffTens',
    example: '3, 8, 13, 18 …',
    min: 0,
    max: 99,
    choices: 4,
    verses: [
      path([5], (random) => offPattern(random, 5, 1, 9), 10),
      path([5], (random) => offPattern(random, 5, 21, 44), 10, false),
      call([5], (random) => offPattern(random, 5, 1, 89)),
    ],
    solo: [5],
  },
  {
    stage: 7,
    group: 'drumsBackwards',
    example: '97, 87, 77 …',
    min: 0,
    max: 99,
    choices: 4,
    verses: [
      path([-10], (random) => int(random, 91, 99), 7),
      path([-10], (random) => int(random, 91, 99), 9, false),
      call([-10], (random) => offPattern(random, 10, 21, 99)),
    ],
    solo: [-10],
  },
  {
    stage: 8,
    group: 'drumsBackwards',
    example: '40, 38, 36 …',
    min: 0,
    max: 100,
    choices: 4,
    verses: [
      path([-2], (random) => multiple(random, 2, 40, 60), 10),
      path([-5], (random) => multiple(random, 5, 90, 100), 10),
      call([-2, -5], (random, step) => multiple(random, -step, 20, 100)),
    ],
    solo: [-2, -5],
  },
  {
    stage: 9,
    group: 'drumsBackwards',
    example: '52, 51, 50, 49 …',
    min: 0,
    max: 99,
    choices: 4,
    verses: [
      // Starts a few above a ten, so the run crosses back over it.
      path([-1], (random) => 10 * int(random, 3, 8) + int(random, 5, 7), 10),
      path([-10], (random) => int(random, 90, 99), 7),
      // Calls start just above a ten, or anywhere for tens.
      call([-1, -10], (random, step) =>
        step === -1 ? 10 * int(random, 2, 9) + int(random, 1, 2) : int(random, 30, 99),
      ),
    ],
    solo: [-1, -10],
  },
  {
    stage: 10,
    group: 'drumsTables',
    example: '0, 3, 6, 9 …',
    min: 0,
    max: 36,
    choices: 4,
    verses: [
      path([3], fixed(0), 10),
      path([-3], fixed(30), 8),
      call([3, -3], (random) => multiple(random, 3, 0, 30)),
    ],
    solo: [3],
  },
  {
    stage: 11,
    group: 'drumsTables',
    example: '0, 4, 8, 12 …',
    min: 0,
    max: 48,
    choices: 4,
    verses: [
      path([4], fixed(0), 10),
      path([-4], fixed(40), 8),
      call([4, -4], (random) => multiple(random, 4, 0, 40)),
    ],
    solo: [4],
  },
  {
    stage: 12,
    group: 'drumsMaster',
    example: '87, 97, 107 …',
    min: 0,
    max: 120,
    choices: 4,
    verses: [
      // Tens past 100 from an awkward start, the move behind 87 + 20.
      path(
        [10, 5],
        (random, step) =>
          step === 10 ? offPattern(random, 10, 11, 29) : offPattern(random, 5, 51, 64),
        8,
      ),
      path(
        [-2, -3, -4, -5, -10],
        (random, step) => (step === -10 ? int(random, 101, 119) : int(random, 60, 100)),
        10,
      ),
      call([2, 3, 4, 5, 10, -2, -3, -4, -5, -10], (random) => int(random, 20, 110)),
    ],
    solo: [10, 5, -10],
    strict: true,
  },
];

export const TOTAL_STAGES = drumStages.length;

export const drumLevels: readonly Level[] = drumStages.map((stage) => ({
  id: `drums-${stage.stage}`,
  title: `drums${stage.stage}` as MessageKey,
  description: `drums${stage.stage}Help` as MessageKey,
  skills: ['skip-counting', stage.stage >= 7 && stage.stage <= 9 ? 'counting-back' : 'counting-on'],
  format: 'drums',
  group: stage.group,
}));

export function drumStage(id: string | null | undefined): DrumStage | undefined {
  const match = /^drums-([1-9]\d*)$/.exec(id ?? '');
  return match ? drumStages.find((stage) => stage.stage === Number(match[1])) : undefined;
}

/** One mushroom of a round. */
export interface Mushroom {
  readonly value: number;
  /** Pom hops it by himself: a demo hop or a called number. */
  readonly given: boolean;
  /** The first mushroom of a run: a verse, a call or the solo starts here. */
  readonly fresh: boolean;
  /** Signed step from the mushroom before it; 0 when fresh. */
  readonly step: number;
  /** 0, 1, 2 for the verses, 3 for the drum solo. */
  readonly verse: number;
  /** A pattern break: the call asks for the number before. */
  readonly before?: boolean;
  /** Seeds the order of the answer buttons, so they keep still while the child thinks. */
  readonly seed: number;
}

/** A run of numbers from `start` by `step`, `count` long, or null if it leaves the range. */
function run(start: number, step: number, count: number, min: number, max: number) {
  const values = Array.from({ length: count }, (_, index) => start + index * step);
  return values.every((value) => value >= min && value <= max) ? values : null;
}

/** The numbers of a path verse: the start, the demo hops, then the questions. */
function pathValues(spec: VerseSpec, stage: DrumStage, random: Random) {
  const lead = spec.demo ? 3 : 1;
  for (let tries = 0; tries < 60; tries++) {
    const step = pick(random, spec.steps);
    const start = spec.start(random, step);
    // Stop early rather than leave the range: 0 to 100 in tens has room for eight after the demo.
    for (let answers = spec.answers; answers >= 4; answers--) {
      const values = run(start, step, lead + answers, stage.min, stage.max);
      if (values) return { values, step };
    }
  }
  throw new Error(`No room for a verse on drums level ${stage.stage}`);
}

/** Builds the mushrooms of one verse. */
export function buildVerse(stage: DrumStage, verse: number, random: Random): readonly Mushroom[] {
  const spec = stage.verses[verse];
  const seed = () => Math.floor(random() * 1e9);
  if (spec.kind === 'path') {
    const { values, step } = pathValues(spec, stage, random);
    const lead = spec.demo ? 3 : 1;
    return values.map((value, index) => ({
      value,
      given: index < lead,
      fresh: index === 0,
      step: index === 0 ? 0 : step,
      verse,
      seed: seed(),
    }));
  }
  const mushrooms: Mushroom[] = [];
  let last: number | null = null;
  for (let index = 0; index < spec.answers; index++) {
    const before = index % 4 === 3;
    let values: number[] | null = null;
    let step = 0;
    for (let tries = 0; tries < 60 && !values; tries++) {
      step = pick(random, spec.steps);
      const start = spec.start(random, step);
      const candidate = run(start, step, 3, stage.min, stage.max);
      // A fresh start each call, never the same as the call before: it breaks the chant.
      if (candidate && candidate[0] !== last) values = candidate;
    }
    if (!values) throw new Error(`No room for a call on drums level ${stage.stage}`);
    last = values[0];
    // "Before" calls are played in reverse: 55, 50, then the number before 50.
    const ordered = before ? [...values].reverse() : values;
    const signed = before ? -step : step;
    ordered.forEach((value, at) =>
      mushrooms.push({
        value,
        given: at < 2,
        fresh: at === 0,
        step: at === 0 ? 0 : signed,
        verse,
        ...(before && at === 2 ? { before: true } : {}),
        seed: seed(),
      }),
    );
  }
  return mushrooms;
}

/** The drum solo: four quick mushrooms worth double, from a fresh start. */
export function buildSolo(stage: DrumStage, random: Random): readonly Mushroom[] {
  for (let tries = 0; tries < 80; tries++) {
    const step = pick(random, stage.solo);
    const start = int(random, stage.min, stage.max);
    const values = run(start, step, SOLO_LENGTH + 1, stage.min, stage.max);
    if (!values) continue;
    return values.map((value, index) => ({
      value,
      given: index === 0,
      fresh: index === 0,
      step: index === 0 ? 0 : step,
      verse: VERSES,
      seed: Math.floor(random() * 1e9),
    }));
  }
  throw new Error(`No room for the drum solo on drums level ${stage.stage}`);
}

/** The whole round: three verses and the drum solo, in the order Pom meets them. */
export function buildRound(stage: DrumStage, random: Random = Math.random): readonly Mushroom[] {
  return [
    ...buildVerse(stage, 0, random),
    ...buildVerse(stage, 1, random),
    ...buildVerse(stage, 2, random),
    ...buildSolo(stage, random),
  ];
}

/** Questions in a round's verses (the solo is a bonus and not counted for stars). */
export function verseQuestions(mushrooms: readonly Mushroom[]) {
  return mushrooms.filter((mushroom) => !mushroom.given && mushroom.verse < VERSES).length;
}

const tensOf = (value: number) => Math.floor(value / 10);

/** True when the step moves into a new ten: 28 → 30, 31 → 29, 95 → 100. */
export function crossesTen(from: number, to: number) {
  return tensOf(from) !== tensOf(to);
}

/** A small seeded random, so a mushroom's buttons come out the same every time. */
export function seeded(seed: number): Random {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The wrong answers a child really gives, most telling first:
 * - in German the ones come first ("siebenundzwanzig"), so 27 and 72 swap;
 * - in French 70–79 and 90–99 start with the ten before ("soixante-dix-sept"), so 77 becomes 67;
 * - at a ten, the old ten repeats ("twenty-ten", 30 → 39 counting back);
 * - the next number instead of the next step (37 → 38 in tens);
 * - a ten skipped or repeated (37 → 57 or 37 → 37);
 * - the wrong way (27 → 17 counting on).
 */
export function traps(current: number, answer: number, locale: Locale): number[] {
  const step = answer - current;
  const sign = Math.sign(step) || 1;
  const list: number[] = [];
  if (locale === 'de' && answer >= 12 && answer <= 98 && answer % 10 !== 0) {
    const swapped = (answer % 10) * 10 + tensOf(answer);
    if (swapped !== answer) list.push(swapped);
  }
  if (locale === 'fr' && ((answer >= 71 && answer <= 79) || (answer >= 91 && answer <= 99)))
    list.push(answer - 10);
  if (Math.abs(step) < 10 && crossesTen(current, answer)) {
    // Stays in the old ten: 28 → 20 instead of 30; 31 → 39 instead of 29.
    list.push(answer - 10 * sign);
  }
  if (Math.abs(step) > 1) list.push(current + sign);
  if (Math.abs(step) === 1) list.push(answer + 10 * sign, answer - 10 * sign);
  list.push(answer + 10 * sign);
  if (Math.abs(step) === 10) list.push(current);
  list.push(current - step);
  list.push(answer + step);
  list.push(answer - 1, answer + 1, answer + 2 * sign);
  return list;
}

/** The answer buttons for a mushroom: the answer and the likeliest traps, shuffled. */
export function choicesFor(
  mushroom: Mushroom,
  previous: number,
  count: number,
  locale: Locale,
): number[] {
  const answer = mushroom.value;
  const picked: number[] = [answer];
  for (const value of traps(previous, answer, locale)) {
    if (picked.length === count) break;
    if (value >= 0 && value <= 130 && !picked.includes(value)) picked.push(value);
  }
  const random = seeded(mushroom.seed);
  for (let index = picked.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [picked[index], picked[other]] = [picked[other], picked[index]];
  }
  return picked;
}

/** Which rule card helps on this mushroom: a ten crossing first, then the level's step. */
export function ruleFor(previous: number, answer: number): DrumRule {
  const step = answer - previous;
  if (Math.abs(step) < 10 && crossesTen(previous, answer)) {
    if (step > 0 && answer >= 100 && previous < 100) return 'hundred';
    return step > 0 ? 'newTen' : 'backTen';
  }
  switch (step) {
    case 10:
      return 'tens';
    case -10:
      return 'tensBack';
    case 5:
      return 'fives';
    case -5:
      return 'fivesBack';
    case 2:
      return previous % 2 ? 'odd' : 'twos';
    case -2:
      return 'twosBack';
    case 1:
      return 'ones';
    case -1:
      return 'onesBack';
    case 3:
    case -3:
      return 'threes';
    case 4:
    case -4:
      return 'fours';
    default:
      return step > 0 ? 'tens' : 'onesBack';
  }
}

/** Example runs for each rule card. A card never uses a run that holds the answer. */
const RULE_RUNS: Readonly<Record<DrumRule, readonly (readonly number[])[]>> = {
  tens: [
    [4, 14, 24],
    [6, 16, 26],
    [31, 41, 51],
  ],
  tensBack: [
    [86, 76, 66],
    [53, 43, 33],
    [98, 88, 78],
  ],
  fives: [
    [20, 25, 30],
    [65, 70, 75],
    [3, 8, 13],
  ],
  fivesBack: [
    [50, 45, 40],
    [85, 80, 75],
    [35, 30, 25],
  ],
  twos: [
    [10, 12, 14],
    [42, 44, 46],
    [66, 68, 70],
  ],
  twosBack: [
    [20, 18, 16],
    [54, 52, 50],
    [88, 86, 84],
  ],
  odd: [
    [11, 13, 15],
    [47, 49, 51],
    [83, 85, 87],
  ],
  ones: [
    [41, 42, 43],
    [76, 77, 78],
    [15, 16, 17],
  ],
  onesBack: [
    [43, 42, 41],
    [77, 76, 75],
    [18, 17, 16],
  ],
  threes: [
    [3, 6, 9],
    [15, 18, 21],
    [24, 27, 30],
  ],
  fours: [
    [4, 8, 12],
    [16, 20, 24],
    [28, 32, 36],
  ],
  newTen: [
    [29, 30],
    [59, 60],
    [79, 80],
  ],
  backTen: [
    [40, 39],
    [70, 69],
    [20, 19],
  ],
  hundred: [
    [98, 99, 100],
    [90, 100, 110],
    [95, 100, 105],
  ],
};

/** The example run a rule card shows: never one with the answer or the number Pom is on. */
export function ruleRun(rule: DrumRule, previous: number, answer: number): readonly number[] {
  const runs = RULE_RUNS[rule];
  return (
    runs.find((values) => !values.includes(answer) && !values.includes(previous)) ??
    runs.find((values) => !values.includes(answer)) ??
    runs[0]
  );
}

/** After a third miss, one more wrong button greys out per miss; two choices always stay. */
export function greyedOut(
  choices: readonly number[],
  answer: number,
  misses: number,
  seed: number,
) {
  const wrong = choices.filter((value) => value !== answer);
  const greyable = Math.max(0, Math.min(misses - 2, choices.length - 2));
  const random = seeded(seed ^ 0x5bd1e995);
  for (let index = wrong.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [wrong[index], wrong[other]] = [wrong[other], wrong[index]];
  }
  return wrong.slice(0, greyable);
}

/** The tempo the intro offers; free play has no beat at all. */
export type DrumTempo = 'free' | 'slow' | 'medium' | 'quick';

export const DRUM_TEMPOS: readonly { readonly id: DrumTempo; readonly bpm: number }[] = [
  { id: 'free', bpm: 0 },
  { id: 'slow', bpm: 75 },
  { id: 'medium', bpm: 95 },
  { id: 'quick', bpm: 120 },
];

/** Free play still has music, at an easy pace with nothing measured against it. */
export const FREE_BPM = 80;

export function parseDrumTempo(value: unknown): DrumTempo {
  return DRUM_TEMPOS.some((tempo) => tempo.id === value) ? (value as DrumTempo) : 'free';
}

/** Seconds per beat, and per mushroom (a bar of four beats). */
export function beatSeconds(tempo: DrumTempo) {
  const bpm = DRUM_TEMPOS.find((entry) => entry.id === tempo)?.bpm || FREE_BPM;
  return 60 / bpm;
}
export function barSeconds(tempo: DrumTempo) {
  return beatSeconds(tempo) * 4;
}

/**
 * How long after Pom lands an answer still counts as on the beat. Children of six to eight tap
 * far less precisely than adults, so this grades the answer, not rhythm precision.
 */
export const GRACE_SECONDS = 0.4;

/** Points for one right answer. */
export function drumPoints(options: {
  readonly firstTry: boolean;
  readonly onBeat: boolean;
  readonly solo: boolean;
}) {
  const base = 10 + (options.firstTry ? 5 : 0) + (options.onBeat ? 5 : 0);
  return options.solo ? base * 2 : base;
}

/** First-try, on-beat answers in a row that add an instrument to the song. */
export const LAYER_RUN = 4;

/** Round stars from first-try answers in the verses: 32 of 36 earns three, 24 two. */
export function drumStars(firstTry: number, questions: number): 1 | 2 | 3 {
  if (questions <= 0) return 1;
  const share = firstTry / questions;
  return share >= 32 / 36 ? 3 : share >= 24 / 36 ? 2 : 1;
}

export function isMastered(stage: DrumStage, stars: number) {
  return stars >= (stage.strict ? 3 : 2);
}
