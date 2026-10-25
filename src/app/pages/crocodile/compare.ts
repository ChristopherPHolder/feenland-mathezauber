import type { CrocMessageKey } from './crocodile-messages';
export type Relation = '<' | '>' | '=';
export interface Side {
  /** Display text such as `12` or `7 + 6`. */
  readonly text: string;
  readonly value: number;
}
export interface Comparison {
  readonly left: Side;
  readonly right: Side;
  readonly answer: Relation;
}
export type PondKind = 'pond' | 'numbers' | 'sums' | 'equations' | 'big';
export interface Pond {
  readonly number: number;
  readonly kind: PondKind;
  readonly max: number;
  readonly title: CrocMessageKey;
  readonly example: string;
}
export const ROUND_SIZE = 10;
export const ponds: readonly Pond[] = [
  { number: 1, kind: 'pond', max: 10, title: 'pond1', example: '3 ○ 7' },
  { number: 2, kind: 'numbers', max: 20, title: 'pond2', example: '16 ○ 13' },
  { number: 3, kind: 'sums', max: 20, title: 'pond3', example: '7 + 6 ○ 14' },
  { number: 4, kind: 'equations', max: 20, title: 'pond4', example: '16 − 7 ○ 3 + 5' },
  { number: 5, kind: 'big', max: 100, title: 'pond5', example: '47 ○ 74' },
];
export function relation(left: number, right: number): Relation {
  return left === right ? '=' : left > right ? '>' : '<';
}
/** Stars reward first-try answers; a round can always be replayed for more. */
export function starsFor(firstTry: number): 0 | 1 | 2 | 3 {
  return firstTry >= ROUND_SIZE ? 3 : firstTry >= 8 ? 2 : firstTry >= 6 ? 1 : 0;
}
export function createRound(pond: Pond, random = Math.random): readonly Comparison[] {
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const seen = new Set<string>();
  const round: Comparison[] = [];
  while (round.length < ROUND_SIZE) {
    const roll = random();
    const answer: Relation = roll < 0.25 ? '=' : roll < 0.625 ? '<' : '>';
    const comparison = build(pond, answer, int, random);
    const key = `${comparison.left.text}|${comparison.right.text}`;
    if (seen.has(key) && seen.size < 40) continue;
    seen.add(key);
    round.push(comparison);
  }
  return round;
}
type Int = (min: number, max: number) => number;
function build(pond: Pond, answer: Relation, int: Int, random: () => number): Comparison {
  const [bigger, smaller] = pair(pond, answer, int, random);
  const [left, right] = answer === '>' ? [bigger, smaller] : [smaller, bigger];
  return { left, right, answer };
}
/** Returns the bigger side first (both equal for `=`). */
function pair(pond: Pond, answer: Relation, int: Int, random: () => number): [Side, Side] {
  if (pond.kind === 'pond' || pond.kind === 'numbers') {
    const min = pond.kind === 'pond' ? 0 : 1;
    const a = int(min, pond.max);
    if (answer === '=') return [plain(a), plain(a)];
    const gap = int(1, pond.kind === 'pond' ? 4 : 6);
    const b = a + gap <= pond.max ? a + gap : a - gap;
    return b > a ? [plain(b), plain(a)] : [plain(a), plain(b)];
  }
  if (pond.kind === 'big') {
    const a = int(10, 99);
    if (answer === '=') return [plain(a), plain(a)];
    // Half the time only the ones differ, so tens are compared first and then ones.
    const sameTens = random() < 0.5;
    let b = sameTens
      ? Math.floor(a / 10) * 10 + (((a % 10) + int(1, 8)) % 10)
      : ((Math.floor(a / 10) + int(1, 7)) % 9) * 10 + 10 + int(0, 9);
    if (b === a) b = a === 99 ? 98 : a + 1;
    return b > a ? [plain(b), plain(a)] : [plain(a), plain(b)];
  }
  const value = int(answer === '=' ? 2 : 3, pond.max);
  const first = expression(value, pond.max, int, random);
  if (answer === '=')
    return pond.kind === 'sums'
      ? shuffle([first, plain(value)], random)
      : [first, expression(value, pond.max, int, random, first.text)];
  const gap = int(1, 4);
  const other = value - gap >= 1 ? value - gap : value + gap;
  const second =
    pond.kind === 'sums' ? plain(other) : expression(other, pond.max, int, random, first.text);
  return other > value ? [second, first] : [first, second];
}
function plain(value: number): Side {
  return { text: `${value}`, value };
}
function shuffle(sides: [Side, Side], random: () => number): [Side, Side] {
  return random() < 0.5 ? sides : [sides[1], sides[0]];
}
/** An addition or subtraction equal to `value`, never written the same way as `avoid`. */
function expression(value: number, max: number, int: Int, random: () => number, avoid = ''): Side {
  let side = plain(value);
  for (let attempt = 0; attempt < 12; attempt++) {
    if (random() < 0.4 && value < max) {
      const minuend = value + int(1, max - value);
      side = { text: `${minuend} − ${minuend - value}`, value };
    } else {
      const addend = int(1, value - 1);
      side = { text: `${addend} + ${value - addend}`, value };
    }
    if (side.text !== avoid) break;
  }
  return side;
}
