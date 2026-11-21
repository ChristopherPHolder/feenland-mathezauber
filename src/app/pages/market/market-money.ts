/**
 * Money in the Fairy Market: euro values drawn in the game's own style (never replicas of
 * real coins or notes). Amounts are whole euros in the first levels; cents come later, so
 * every amount is kept in cents from the start.
 */

/** Every coin and note the market knows, in cents. */
export const DENOMINATIONS = [2000, 1000, 500, 200, 100, 50, 20, 10] as const;
export type Denomination = (typeof DENOMINATIONS)[number];

/** Notes are wider than coins and coloured by value. */
export function isNote(value: Denomination): boolean {
  return value >= 500;
}

/** One euro in cents. */
export const EURO = 100;

export function total(coins: readonly Denomination[]): number {
  return coins.reduce((sum, coin) => sum + coin, 0);
}

/** Coins from biggest to smallest, the way a till lays them out. */
export function sortCoins(coins: readonly Denomination[]): Denomination[] {
  return [...coins].sort((a, b) => b - a);
}

/**
 * The fewest coins and notes that make `amount` from the given set of values. The euro's
 * 1-2-5 series makes the greedy choice the best one.
 */
export function fewestCoins(
  amount: number,
  values: readonly Denomination[] = DENOMINATIONS,
): Denomination[] | null {
  const coins: Denomination[] = [];
  let left = amount;
  for (const value of [...values].sort((a, b) => b - a)) {
    while (left >= value) {
      coins.push(value);
      left -= value;
    }
  }
  return left === 0 ? coins : null;
}

/**
 * Whether some of `purse` adds up to exactly `amount`. Purses are small (at most a dozen
 * coins), so a reachable-sums set is quick.
 */
export function canPayExactly(purse: readonly Denomination[], amount: number): boolean {
  let reachable = new Set([0]);
  for (const coin of purse) {
    const next = new Set(reachable);
    for (const sum of reachable) next.add(sum + coin);
    reachable = next;
  }
  return reachable.has(amount);
}

/** The fewest coins from `purse` that pay `amount` exactly, or null when it cannot be done. */
export function fewestFromPurse(purse: readonly Denomination[], amount: number): number | null {
  // Fewest coins per reachable sum: a small knapsack over the purse.
  let best = new Map<number, number>([[0, 0]]);
  for (const coin of purse) {
    const next = new Map(best);
    for (const [sum, count] of best) {
      const reach = sum + coin;
      if (reach > amount) continue;
      if (!next.has(reach) || next.get(reach)! > count + 1) next.set(reach, count + 1);
    }
    best = next;
  }
  return best.get(amount) ?? null;
}

/**
 * An amount as the reader writes money: "€6" in English, "6 €" in German, French and
 * Spanish. Whole euros drop the cents.
 */
export function formatMoney(cents: number, locale: string): string {
  const whole = cents % EURO === 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / EURO);
}

/** The value printed on a coin or note: "1", "20", or "50" for 50 cent. */
export function faceValue(value: Denomination): string {
  return value >= EURO ? String(value / EURO) : String(value);
}

/** The unit under the face value: € for euros, c for cents. */
export function faceUnit(value: Denomination): '€' | 'c' {
  return value >= EURO ? '€' : 'c';
}
