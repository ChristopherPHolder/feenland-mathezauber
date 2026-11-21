/**
 * The sums each sprite asks. Every question has four choices, exactly one right, and the
 * wrong ones are the near misses a child really makes.
 */
export type DuelSkill =
  | 'add10'
  | 'take10'
  | 'plusMinus20'
  | 'doubles'
  | 'tens100'
  | 'times'
  | 'missing'
  | 'mixed';

export interface DuelQuestion {
  /** The sum as shown, like "7 + 5" or "7 + ? = 12". */
  readonly text: string;
  readonly answer: number;
  /** Four choices in display order; exactly one equals `answer`. */
  readonly choices: readonly number[];
}

export const CHOICES = 4;

export type Random = () => number;

interface Fact {
  readonly text: string;
  readonly answer: number;
}

const int = (random: Random, min: number, max: number) =>
  min + Math.min(max - min, Math.floor(random() * (max - min + 1)));
const pick = <T>(random: Random, items: readonly T[]): T => items[int(random, 0, items.length - 1)];

/** Two numbers that make at most ten, like 3 + 4. */
function add10(random: Random): Fact {
  const sum = int(random, 3, 10);
  const a = int(random, 1, sum - 1);
  return { text: `${a} + ${sum - a}`, answer: sum };
}

/** Taking away within ten, like 9 − 4. */
function take10(random: Random): Fact {
  const a = int(random, 3, 10);
  const b = int(random, 1, a - 1);
  return { text: `${a} − ${b}`, answer: a - b };
}

/** Plus or minus up to 20, often across the ten: 8 + 5 or 15 − 7. */
function plusMinus20(random: Random): Fact {
  if (random() < 0.5) {
    const a = int(random, 2, 12);
    const b = int(random, 2, Math.min(9, 20 - a));
    return { text: `${a} + ${b}`, answer: a + b };
  }
  const a = int(random, 11, 20);
  const b = int(random, 2, 9);
  return { text: `${a} − ${b}`, answer: a - b };
}

/** Doubles up to 10 + 10 and the near doubles beside them. */
function doubles(random: Random): Fact {
  const a = int(random, 2, 10);
  if (random() < 0.5 || a === 10) return { text: `${a} + ${a}`, answer: a + a };
  const b = a + 1;
  return random() < 0.5
    ? { text: `${a} + ${b}`, answer: a + b }
    : { text: `${b} + ${a}`, answer: a + b };
}

/** Whole tens to 100, and adding or taking away tens from a two-digit number: 34 + 20. */
function tens100(random: Random): Fact {
  const roll = random();
  if (roll < 0.35) {
    const a = int(random, 1, 8) * 10;
    const b = int(random, 1, 9 - a / 10) * 10;
    return { text: `${a} + ${b}`, answer: a + b };
  }
  if (roll < 0.6) {
    const a = int(random, 3, 10) * 10;
    const b = int(random, 1, a / 10 - 1) * 10;
    return { text: `${a} − ${b}`, answer: a - b };
  }
  const ones = int(random, 1, 9);
  if (roll < 0.8) {
    const a = int(random, 1, 7) * 10 + ones;
    const b = int(random, 1, Math.floor((100 - a) / 10)) * 10;
    return { text: `${a} + ${b}`, answer: a + b };
  }
  const a = int(random, 3, 9) * 10 + ones;
  const b = int(random, 1, Math.floor(a / 10) - 1) * 10;
  return { text: `${a} − ${b}`, answer: a - b };
}

/** The 2, 5 and 10 times tables. */
function times(random: Random): Fact {
  const row = pick(random, [2, 5, 10]);
  const other = int(random, 2, 10);
  return random() < 0.5
    ? { text: `${row} × ${other}`, answer: row * other }
    : { text: `${other} × ${row}`, answer: row * other };
}

/** A hidden number: 7 + ? = 12, ? + 4 = 11 or 15 − ? = 9. */
function missing(random: Random): Fact {
  const roll = random();
  if (roll < 0.4) {
    const sum = int(random, 6, 20);
    const a = int(random, 1, sum - 2);
    return { text: `${a} + ? = ${sum}`, answer: sum - a };
  }
  if (roll < 0.65) {
    const sum = int(random, 6, 20);
    const b = int(random, 1, sum - 2);
    return { text: `? + ${b} = ${sum}`, answer: sum - b };
  }
  const a = int(random, 6, 20);
  const b = int(random, 2, a - 1);
  return { text: `${a} − ? = ${a - b}`, answer: b };
}

const SKILLS: Readonly<Record<Exclude<DuelSkill, 'mixed'>, (random: Random) => Fact>> = {
  add10,
  take10,
  plusMinus20,
  doubles,
  tens100,
  times,
  missing,
};

function fact(skill: DuelSkill, random: Random): Fact {
  if (skill !== 'mixed') return SKILLS[skill](random);
  // The boss asks a bit of everything, leaning on the later sprites.
  return pick(random, [plusMinus20, doubles, tens100, times, times, missing, missing])(random);
}

/** Near misses: off by one or two, off by a ten, the wrong row of a table, or a digit swap. */
function distractors(random: Random, answer: number, text: string): number[] {
  const big = answer >= 20 || text.includes('×');
  const offsets = big ? [1, -1, 2, -2, 10, -10, 5, -5] : [1, -1, 2, -2, 3, -3];
  const candidates = new Set<number>();
  const swapped = Number(String(answer).split('').reverse().join(''));
  if (swapped !== answer && swapped >= 10 && answer % 10 !== 0) candidates.add(swapped);
  for (const offset of offsets) if (answer + offset >= 0) candidates.add(answer + offset);
  const pool = [...candidates].filter((value) => value !== answer && value <= 100);
  const chosen: number[] = [];
  while (chosen.length < CHOICES - 1 && pool.length) {
    chosen.push(pool.splice(int(random, 0, pool.length - 1), 1)[0]);
  }
  let filler = answer + 4;
  while (chosen.length < CHOICES - 1) {
    if (!chosen.includes(filler)) chosen.push(filler);
    filler++;
  }
  return chosen;
}

function shuffle<T>(random: Random, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = int(random, 0, index);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

/** One question with four shuffled choices; never the same sum twice in a row. */
export function duelQuestion(
  skill: DuelSkill,
  random: Random = Math.random,
  previous?: string,
): DuelQuestion {
  let next = fact(skill, random);
  for (let tries = 0; tries < 8 && next.text === previous; tries++) next = fact(skill, random);
  return {
    text: next.text,
    answer: next.answer,
    choices: shuffle(random, [next.answer, ...distractors(random, next.answer, next.text)]),
  };
}

/** The sum with its question mark: "7 + 5 = ?", or as it is when a number is hidden. */
export function shownSum(text: string): string {
  return text.includes('?') ? text : `${text} = ?`;
}
