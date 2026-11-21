/** A fraction such as 3⁄4: `n` equal pieces of a whole cut into `d`. */
export interface Fraction {
  readonly n: number;
  readonly d: number;
}

export const frac = (n: number, d: number): Fraction => ({ n, d });

/** The same numerator and denominator, written the same way (2⁄4 is not 1⁄2 here). */
export const sameFraction = (a: Fraction, b: Fraction) => a.n === b.n && a.d === b.d;

/** The same amount: 1⁄2 and 2⁄4 are equivalent. */
export const equivalent = (a: Fraction, b: Fraction) => a.n * b.d === b.n * a.d;

/** -1 when `a` is less, 0 when they are the same amount, 1 when `a` is more. */
export function compareFractions(a: Fraction, b: Fraction): -1 | 0 | 1 {
  const left = a.n * b.d;
  const right = b.n * a.d;
  return left < right ? -1 : left > right ? 1 : 0;
}

export const isUnit = (f: Fraction) => f.n === 1;

/** `f` of a group of `total`, when it shares out evenly; otherwise null. */
export function fractionOfSet(f: Fraction, total: number): number | null {
  if (f.d <= 0 || total % f.d !== 0) return null;
  return (total / f.d) * f.n;
}

/** The precomposed glyph for a fraction when Unicode has one, else "n⁄d". */
export function fractionGlyph(f: Fraction): string {
  const glyphs: Record<string, string> = {
    '1/2': '½',
    '1/3': '⅓',
    '2/3': '⅔',
    '1/4': '¼',
    '3/4': '¾',
    '1/5': '⅕',
    '2/5': '⅖',
    '3/5': '⅗',
    '4/5': '⅘',
    '1/6': '⅙',
    '5/6': '⅚',
    '1/8': '⅛',
    '3/8': '⅜',
    '5/8': '⅝',
    '7/8': '⅞',
    '1/10': '⅒',
  };
  return glyphs[`${f.n}/${f.d}`] ?? `${f.n}⁄${f.d}`;
}

/** How a food can be cut: round (a pie or cake, cut from the middle) or a strip (a bar or ribbon). */
export type Shape = 'round' | 'strip';

/**
 * Cut marks on a food. A strip has marks 1 … TICKS − 1 between its ends; a round food has
 * marks 0 … TICKS − 1 around its rim, and the mark at the top (0) is always cut.
 */
export const TICKS = 12;

/**
 * The size of every piece the cuts make, in marks, starting from the left end of a strip or from
 * the top of a round food going clockwise. A round food with only its top cut is one piece.
 */
export function pieceSizes(shape: Shape, cuts: readonly number[], ticks = TICKS): number[] {
  if (shape === 'strip') {
    const marks = [...new Set(cuts)].filter((c) => c > 0 && c < ticks).sort((a, b) => a - b);
    const edges = [0, ...marks, ticks];
    return edges.slice(1).map((edge, index) => edge - edges[index]);
  }
  const marks = [...new Set([0, ...cuts])].filter((c) => c >= 0 && c < ticks).sort((a, b) => a - b);
  if (marks.length < 2) return [ticks];
  return marks.map((mark, index) => (marks[index + 1] ?? marks[0] + ticks) - mark);
}

/** Whether the cuts make `parts` pieces and whether every piece is the same size. */
export function checkShare(sizes: readonly number[], parts: number) {
  const equal = sizes.every((size) => size === sizes[0]);
  return { count: sizes.length === parts, equal, fair: sizes.length === parts && equal };
}

/** The smallest and the biggest piece, for showing them side by side after an uneven cut. */
export function extremes(sizes: readonly number[]): [number, number] {
  return [Math.min(...sizes), Math.max(...sizes)];
}

/** Equal sizes for `parts` pieces, as shares of the whole. */
export const equalSizes = (parts: number) => Array.from({ length: parts }, () => 1 / parts);

/**
 * Sizes for `parts` pieces that are clearly not the same, as shares of the whole: one piece
 * takes a bite from its neighbour. `at` picks which pair, `bite` how much (0.3 to 0.6 of a piece).
 */
export function unevenSizes(parts: number, at = 0, bite = 0.45): number[] {
  const sizes = equalSizes(parts);
  const i = ((at % parts) + parts) % parts;
  const j = (i + 1) % parts;
  const amount = Math.max(0.3, Math.min(0.6, bite)) / parts;
  sizes[i] += amount;
  sizes[j] -= amount;
  return sizes;
}
