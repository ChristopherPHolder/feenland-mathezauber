/**
 * The arithmetic of Bramble's kitchen, kept free of Angular and Three.js: what a pan weighs,
 * how far the beam tips, the fewest weights that make an amount, the marks on a scale dial and
 * how amounts are written in each language.
 */

/** How an amount is measured. Litres are counted in millilitres, so `l` and `ml` add up. */
export type Unit = 'block' | 'kg' | 'g' | 'l' | 'ml';

/** The steepest the beam tips, in radians, when one pan rests on the stand. */
export const MAX_TILT = 0.32;
/** Even the smallest difference tips the beam this share of the way, so it is always seen. */
export const MIN_TIP = 0.45;

/**
 * Where the beam settles for a difference (left pan minus right pan, in the level's unit):
 * positive tips the left pan down. Any difference tips it clearly, a bigger one further, up to
 * the stand. `range` is roughly the size of the amounts on the scale.
 */
export function tiltFor(difference: number, range: number): number {
  if (!difference) return 0;
  const share = MIN_TIP + (1 - MIN_TIP) * Math.min(1, Math.abs(difference) / Math.max(1, range));
  return Math.sign(difference) * MAX_TILT * share;
}

/**
 * One step of the beam's swing: a damped spring toward `target`, so it overshoots a little and
 * settles, like a real balance. Returns the new angle and speed.
 */
export function swing(
  angle: number,
  speed: number,
  target: number,
  dt: number,
  stiffness = 38,
  damping = 5.5,
): { angle: number; speed: number } {
  // Small sub-steps keep the spring steady on a slow frame.
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    speed += (-(angle - target) * stiffness - speed * damping) * h;
    angle += speed * h;
  }
  return { angle, speed };
}

/**
 * The fewest weights from `sizes` (as many of each as needed) that make `target` exactly,
 * biggest first, or null when no mix of them can.
 */
export function fewestWeights(target: number, sizes: readonly number[]): number[] | null {
  if (!Number.isInteger(target) || target < 0) return null;
  const coins = [...new Set(sizes)].filter((size) => size > 0).sort((a, b) => b - a);
  const best: (number | null)[] = Array.from({ length: target + 1 }, () => null);
  const pick: number[] = Array.from({ length: target + 1 }, () => 0);
  best[0] = 0;
  for (let amount = 1; amount <= target; amount++)
    for (const coin of coins) {
      const before = amount - coin;
      if (before < 0 || best[before] === null) continue;
      const count = best[before]! + 1;
      if (best[amount] === null || count < best[amount]!) {
        best[amount] = count;
        pick[amount] = coin;
      }
    }
  if (best[target] === null) return null;
  const used: number[] = [];
  for (let amount = target; amount > 0; amount -= pick[amount]) used.push(pick[amount]);
  return used.sort((a, b) => b - a);
}

export const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** A kitchen scale's face: the needle sweeps from 0 at the lower left to `max` at the lower right. */
export interface Dial {
  readonly max: number;
  /** The amount between two neighbouring marks. */
  readonly step: number;
  /** Every how much a mark gets a number. */
  readonly label: number;
}

/** The needle's sweep, in degrees clockwise from straight up. */
export const DIAL_START = -135;
export const DIAL_SWEEP = 270;

export function dialAngle(dial: Dial, value: number): number {
  return DIAL_START + (DIAL_SWEEP * Math.max(0, Math.min(dial.max, value))) / dial.max;
}

export interface DialMark {
  readonly value: number;
  readonly angle: number;
  /** Marks with a number are long. */
  readonly labelled: boolean;
  /** Halfway between two numbers: a middle-length mark. */
  readonly half: boolean;
}

/** Every mark on the dial, from 0 to `max`. */
export function dialMarks(dial: Dial): DialMark[] {
  const marks: DialMark[] = [];
  for (let value = 0; value <= dial.max; value += dial.step) {
    const labelled = value % dial.label === 0;
    marks.push({
      value,
      angle: dialAngle(dial, value),
      labelled,
      half: !labelled && (value * 2) % dial.label === 0,
    });
  }
  return marks;
}

/** Turns a dial angle into an (x, y) point on a circle of `radius` round (cx, cy). */
export function dialPoint(cx: number, cy: number, radius: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + Math.sin(rad) * radius, y: cy - Math.cos(rad) * radius };
}

/** A number for a child: decimal comma where the language uses one, no thousands separator. */
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 2 }).format(
    value,
  );
}

const NBSP = ' ';

/**
 * An amount with its unit, as a recipe writes it: "7 kg", "1 kg" for 1000 g, "1,5 l" in German
 * for 1500 ml, "250 ml". Blocks have no symbol, so their word comes from the messages.
 */
export function formatAmount(
  amount: number,
  unit: Unit,
  locale: string,
  blockWord: (n: string) => string = (n) => n,
): string {
  const n = (value: number) => formatNumber(value, locale);
  switch (unit) {
    case 'block':
      return blockWord(n(amount));
    case 'kg':
      return `${n(amount)}${NBSP}kg`;
    case 'g':
      return amount > 0 && amount % 1000 === 0
        ? `${n(amount / 1000)}${NBSP}kg`
        : `${n(amount)}${NBSP}g`;
    case 'l':
      return `${n(amount / 1000)}${NBSP}l`;
    case 'ml':
      return amount > 0 && amount % 1000 === 0
        ? `${n(amount / 1000)}${NBSP}l`
        : `${n(amount)}${NBSP}ml`;
  }
}

/** The unit word that sits after the answer box for the amounts a child types. */
export function unitSymbol(unit: Unit): string {
  return unit === 'block' ? '' : unit === 'l' ? 'l' : unit;
}
