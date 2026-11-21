import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';
import {
  canPayExactly,
  Denomination,
  EURO,
  fewestCoins,
  fewestFromPurse,
  sortCoins,
  total,
} from './market-money';

/**
 * The Fairy Market: Lumi shops at Olli the otter's little shop with a purse of coins. A level
 * is one money skill (pay exactly, enough?, what's left) practised over a round of purchases
 * that ends with a big buy worth double.
 *
 * Everything here is pure: the goods, the levels, the round generators, the checks, scoring
 * and stars. The page and the scenes only draw what it says.
 */

export type Random = () => number;

/**
 * What the child does on a turn, in order: add up a shopping list ("total"), pay with coins,
 * judge "enough?", type what's left.
 */
export type Step = 'total' | 'pay' | 'enough' | 'left' | 'change' | 'give';
/** How the purse looks: every coin on show, or only a tag with its amount. */
export type Look = 'coins' | 'tag';
/** The skill a level is about; it also picks the level's tip card. */
export type MarketSkill =
  | 'coinByCoin'
  | 'notes'
  | 'enough'
  | 'left'
  | 'spree'
  | 'twoTreats'
  | 'list'
  | 'change10'
  | 'change20'
  | 'till';

/** The animals who come to buy when Lumi works the till. */
export const CUSTOMERS = ['fox', 'rabbit', 'hedgehog', 'squirrel'] as const;
export type Customer = (typeof CUSTOMERS)[number];

/** The treats on Olli's shelves, each with the prices it may carry (whole euros). */
export const GOODS = [
  { id: 'apple', from: 1, to: 3 },
  { id: 'cookie', from: 1, to: 3 },
  { id: 'flower', from: 1, to: 4 },
  { id: 'cupcake', from: 2, to: 5 },
  { id: 'ribbon', from: 2, to: 5 },
  { id: 'honey', from: 3, to: 7 },
  { id: 'ball', from: 4, to: 8 },
  { id: 'book', from: 5, to: 10 },
  { id: 'teddy', from: 6, to: 12 },
  { id: 'wand', from: 8, to: 15 },
  { id: 'kite', from: 10, to: 20 },
  { id: 'dragon', from: 12, to: 20 },
] as const;
export type GoodId = (typeof GOODS)[number]['id'];
export const GOOD_IDS: readonly GoodId[] = GOODS.map((good) => good.id);

/** One treat on a shopping list and its own price, in cents. */
export interface Item {
  readonly good: GoodId;
  readonly price: number;
}

export interface MarketTurn {
  /** The treat on the counter; on a shopping list, the first one. */
  readonly good: GoodId;
  /** In cents: what everything on the counter costs together. */
  readonly price: number;
  /** A shopping list of two or three treats, `good` first; absent for a single treat. */
  readonly items?: readonly Item[];
  /** The note handed over to pay, on change turns: by Lumi, or by the customer at the till. */
  readonly paid?: readonly Denomination[];
  /** The coins in the till drawer Lumi gives change from, when she works the till. */
  readonly till?: readonly Denomination[];
  /** Who is buying, when Lumi works the till. */
  readonly customer?: Customer;
  /** The coins and notes in Lumi's purse before she buys. */
  readonly purse: readonly Denomination[];
  /** What the child does, in order. A turn whose purse is too small stops after "enough". */
  readonly steps: readonly Step[];
  readonly look: Look;
  /** The purse was filled up fresh for this turn (the shopping spree's new pocket money). */
  readonly refill?: boolean;
}

export interface MarketStage {
  readonly stage: number;
  readonly group: MessageKey;
  readonly skill: MarketSkill;
  /** The worked example on the level card. */
  readonly example: string;
  /** Turns in a round, the big buy included. */
  readonly turns: number;
  /** Paying with the fewest coins earns a bonus. */
  readonly fewest?: boolean;
  /** Three stars are needed to master the level. */
  readonly strict?: boolean;
  /** A full round, big buy last. */
  readonly round: (random: Random) => MarketTurn[];
}

/** A small seeded random source, so tests and demos replay the same round. */
export function seeded(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(random: Random, items: readonly T[]): T => items[int(random, 0, items.length - 1)];
const euros = (n: number) => n * EURO;

/** A treat that may cost `price`, never the same as the one before it. */
export function pickGood(random: Random, price: number, previous?: GoodId): GoodId {
  const fits = GOODS.filter((good) => price >= euros(good.from) && price <= euros(good.to));
  const fresh = fits.filter((good) => good.id !== previous);
  return pick(random, fresh.length ? fresh : fits).id;
}

/** `amount` split into the given coins at random, so a purse is not always the tidiest one. */
function randomSplit(
  random: Random,
  amount: number,
  values: readonly Denomination[],
): Denomination[] {
  const coins: Denomination[] = [];
  let left = amount;
  while (left > 0) {
    const fits = values.filter((value) => value <= left);
    const coin = pick(random, fits);
    coins.push(coin);
    left -= coin;
  }
  return coins;
}

/** Level 1: pay with 1 € and 2 € coins, prices up to 10 €. */
function coinByCoinTurn(random: Random, big: boolean, previous?: GoodId): MarketTurn {
  const price = euros(big ? int(random, 9, 12) : int(random, 2, 10));
  const pay = randomSplit(random, price, [200, 100]);
  // A coin or two to spare, so the child has to stop at the price.
  const spare = randomSplit(random, euros(int(random, 1, 3)), [200, 100]);
  return {
    good: pickGood(random, price, previous),
    price,
    purse: sortCoins([...pay, ...spare]),
    steps: ['pay'],
    look: 'coins',
  };
}

/** A coin or note changed into the next smaller ones. */
const BREAK_UP: Record<200 | 500 | 1000, Denomination[]> = {
  200: [100, 100],
  500: [200, 200, 100],
  1000: [500, 200, 200, 100],
};

/** Level 2: notes join in. The purse holds the fewest-coins way and a longer one. */
function notesTurn(random: Random, big: boolean, previous?: GoodId): MarketTurn {
  const price = euros(big ? int(random, 16, 20) : int(random, 6, 18));
  const tidy = fewestCoins(price, [1000, 500, 200, 100])!;
  // One big coin of the tidy way also comes as smaller ones, so both ways are in the purse.
  const bigCoins = tidy.filter((coin) => coin >= 200);
  const broken = bigCoins.length ? BREAK_UP[pick(random, bigCoins) as 200 | 500 | 1000] : [];
  const spare = randomSplit(random, euros(int(random, 1, 3)), [200, 100]);
  const purse = sortCoins([...tidy, ...broken, ...spare]);
  return { good: pickGood(random, price, previous), price, purse, steps: ['pay'], look: 'coins' };
}

/** A purse of the given amount in tidy coins and notes up to 10 €. */
const tidyPurse = (amount: number) => sortCoins(fewestCoins(amount, [1000, 500, 200, 100])!);

/** Level 3: is there enough money? Half the time there isn't; sometimes it is just enough. */
function enoughTurn(random: Random, index: number, big: boolean, previous?: GoodId): MarketTurn {
  const purse = euros(big ? int(random, 14, 20) : int(random, 4, 16));
  const deltas = big ? [-1, 1] : [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  let price = purse + euros(pick(random, deltas));
  price = Math.max(euros(1), Math.min(euros(20), price));
  return {
    good: pickGood(random, price, previous),
    price,
    purse: tidyPurse(purse),
    steps: ['enough'],
    look: index < 3 && !big ? 'coins' : 'tag',
  };
}

/** Level 4: buy one treat and say what is left, purse up to 10 €. */
function leftTurn(random: Random, big: boolean, previous?: GoodId): MarketTurn {
  const purse = euros(big ? 10 : int(random, 5, 10));
  const price = euros(int(random, 1, purse / EURO - 1));
  return {
    good: pickGood(random, price, previous),
    price,
    purse: tidyPurse(purse),
    steps: ['left'],
    look: 'coins',
  };
}

/**
 * Level 5: a shopping spree from 20 €. Each treat asks "enough?", and if so "what's left?";
 * the purse carries on until a treat costs too much, then new pocket money fills it up.
 * The big buy starts fresh with a big treat.
 */
function spreeRound(random: Random, turns: number): MarketTurn[] {
  const round: MarketTurn[] = [];
  let purse = euros(20);
  let refill = true;
  let short = 0;
  for (let index = 0; index < turns - 1; index++) {
    const forceShort = !short && index === turns - 2;
    const tryShort = forceShort || (purse <= euros(9) && random() < 0.35);
    const price =
      tryShort && purse < euros(17)
        ? purse + euros(int(random, 1, 3))
        : euros(int(random, 2, Math.min(9, purse / EURO)));
    const enough = price <= purse;
    round.push({
      good: pickGood(random, price, round.at(-1)?.good),
      price,
      purse: tidyPurse(purse),
      steps: enough ? ['enough', 'left'] : ['enough'],
      look: 'tag',
      refill,
    });
    refill = !enough || purse - price < euros(2);
    purse = refill ? euros(20) : purse - price;
    if (!enough) short++;
  }
  const price = euros(int(random, 11, 19));
  round.push({
    good: pickGood(random, price, round.at(-1)?.good),
    price,
    purse: tidyPurse(euros(20)),
    steps: ['enough', 'left'],
    look: 'tag',
    refill: true,
  });
  return round;
}

/** Different treats for each price on a list, none the same as the last turn's first one. */
function listItems(random: Random, prices: readonly number[], previous?: GoodId): Item[] {
  const items: Item[] = [];
  for (const price of prices) {
    const fits = GOODS.filter((good) => price >= euros(good.from) && price <= euros(good.to));
    const unused = fits.filter((good) => !items.some((item) => item.good === good.id));
    const fresh = unused.filter((good) => good.id !== previous);
    const choice = fresh.length ? fresh : unused.length ? unused : fits;
    items.push({ good: pick(random, choice).id, price });
  }
  return items;
}

/** Level 6: two treats. Add the prices, then pay the total with coins and notes. */
function twoTreatsTurn(random: Random, big: boolean, previous?: GoodId): MarketTurn {
  let a = 0;
  let b = 0;
  do {
    a = big ? int(random, 5, 12) : int(random, 1, 9);
    b = big ? int(random, 4, 10) : int(random, 1, 9);
  } while (big ? a + b < 14 || a + b > 20 : a + b < 5 || a + b > 18);
  const items = listItems(random, [euros(a), euros(b)], previous);
  const price = euros(a + b);
  const tidy = fewestCoins(price, [1000, 500, 200, 100])!;
  const spare = randomSplit(random, euros(int(random, 1, 3)), [200, 100]);
  return {
    good: items[0].good,
    price,
    items,
    purse: sortCoins([...tidy, ...spare]),
    steps: ['total', 'pay'],
    look: 'coins',
  };
}

/** Level 7: a list of three treats from a 20 € purse. Add them up, then say what is left. */
function listTurn(random: Random, big: boolean, previous?: GoodId): MarketTurn {
  let prices: number[] = [];
  do {
    prices = [0, 1, 2].map(() => (big ? int(random, 3, 9) : int(random, 1, 7)));
  } while (
    big
      ? prices.reduce((a, b) => a + b) < 15 || prices.reduce((a, b) => a + b) > 19
      : prices.reduce((a, b) => a + b) > 16
  );
  const items = listItems(random, prices.map(euros), previous);
  return {
    good: items[0].good,
    price: euros(prices.reduce((a, b) => a + b)),
    items,
    purse: tidyPurse(euros(20)),
    steps: ['total', 'left'],
    look: 'tag',
  };
}

/** Level 8: Lumi pays with a 10 € note. How much change comes back? */
function change10Turn(random: Random, big: boolean, previous?: GoodId): MarketTurn {
  const price = euros(big ? int(random, 1, 3) : int(random, 2, 9));
  return {
    good: pickGood(random, price, previous),
    price,
    paid: [1000],
    purse: [1000],
    steps: ['change'],
    look: 'tag',
  };
}

/** Level 9: change from 20 €, mostly from prices that make the count cross 10. */
function change20Turn(random: Random, big: boolean, previous?: GoodId): MarketTurn {
  const teens = [11, 12, 13, 14, 15, 16, 17, 18, 19];
  const price = euros(
    big ? int(random, 3, 7) : random() < 0.6 ? pick(random, teens) : int(random, 3, 9),
  );
  return {
    good: pickGood(random, price, previous),
    price,
    paid: [2000],
    purse: [2000],
    steps: ['change'],
    look: 'tag',
  };
}

/** The till drawer: enough of every coin and note to give any change under 20 €. */
const TILL: readonly Denomination[] = [1000, 500, 200, 200, 100, 100, 100];

/** Level 10: Lumi works the till. A customer pays with a note; Lumi counts out the change. */
function tillTurn(random: Random, big: boolean, previous?: GoodId): MarketTurn {
  const price = euros(big ? int(random, 2, 8) : int(random, 1, 18));
  const note: Denomination = big ? 2000 : price < 500 ? 500 : price < 1000 ? 1000 : 2000;
  return {
    good: pickGood(random, price, previous),
    price,
    paid: [note],
    till: TILL,
    customer: pick(random, CUSTOMERS),
    purse: [],
    steps: ['give'],
    look: 'coins',
  };
}

function eachTurn(
  turns: number,
  make: (index: number, big: boolean, previous?: GoodId) => MarketTurn,
) {
  const round: MarketTurn[] = [];
  for (let index = 0; index < turns; index++)
    round.push(make(index, index === turns - 1, round.at(-1)?.good));
  return round;
}

export const marketStages: readonly MarketStage[] = [
  {
    stage: 1,
    group: 'marketCoins',
    skill: 'coinByCoin',
    example: '2 € + 2 € + 1 €',
    turns: 7,
    round: (random) => eachTurn(7, (_, big, previous) => coinByCoinTurn(random, big, previous)),
  },
  {
    stage: 2,
    group: 'marketCoins',
    skill: 'notes',
    example: '10 € + 5 € + 2 €',
    turns: 7,
    fewest: true,
    round: (random) => eachTurn(7, (_, big, previous) => notesTurn(random, big, previous)),
  },
  {
    stage: 3,
    group: 'marketEnough',
    skill: 'enough',
    example: '9 € · 7 € ✓',
    turns: 8,
    round: (random) =>
      eachTurn(8, (index, big, previous) => enoughTurn(random, index, big, previous)),
  },
  {
    stage: 4,
    group: 'marketLeft',
    skill: 'left',
    example: '10 € − 6 €',
    turns: 7,
    round: (random) => eachTurn(7, (_, big, previous) => leftTurn(random, big, previous)),
  },
  {
    stage: 5,
    group: 'marketLeft',
    skill: 'spree',
    example: '20 € − 7 € − 5 €',
    turns: 7,
    strict: true,
    round: (random) => spreeRound(random, 7),
  },
  {
    stage: 6,
    group: 'marketAdding',
    skill: 'twoTreats',
    example: '4 € + 7 €',
    turns: 7,
    round: (random) => eachTurn(7, (_, big, previous) => twoTreatsTurn(random, big, previous)),
  },
  {
    stage: 7,
    group: 'marketAdding',
    skill: 'list',
    example: '3 € + 5 € + 2 €',
    turns: 6,
    round: (random) => eachTurn(6, (_, big, previous) => listTurn(random, big, previous)),
  },
  {
    stage: 8,
    group: 'marketChange',
    skill: 'change10',
    example: '10 € − 7 €',
    turns: 7,
    round: (random) => eachTurn(7, (_, big, previous) => change10Turn(random, big, previous)),
  },
  {
    stage: 9,
    group: 'marketChange',
    skill: 'change20',
    example: '20 € − 13 €',
    turns: 7,
    round: (random) => eachTurn(7, (_, big, previous) => change20Turn(random, big, previous)),
  },
  {
    stage: 10,
    group: 'marketChange',
    skill: 'till',
    example: '7 € → 10 €',
    turns: 7,
    fewest: true,
    strict: true,
    round: (random) => eachTurn(7, (_, big, previous) => tillTurn(random, big, previous)),
  },
];

export const TOTAL_STAGES = marketStages.length;

export const marketLevels: readonly Level[] = marketStages.map((stage) => ({
  id: `market-${stage.stage}`,
  title: `market${stage.stage}` as MessageKey,
  description: `market${stage.stage}Help` as MessageKey,
  skills: ['money', stage.skill],
  format: 'market',
  group: stage.group,
}));

export function marketStage(id: string | null | undefined): MarketStage | undefined {
  const match = /^market-([1-9]\d*)$/.exec(id ?? '');
  return match ? marketStages.find((stage) => stage.stage === Number(match[1])) : undefined;
}

/** Where a level sits in the list, counting from 1: the number a child sees. */
export function marketPosition(stage: MarketStage): number {
  return marketStages.indexOf(stage) + 1;
}

/** How much is in the purse. */
export const purseTotal = (turn: MarketTurn) => total(turn.purse);
/** Whether the purse covers the price. Just enough is enough. */
export const affordable = (turn: MarketTurn) => turn.price <= purseTotal(turn);
/** What is left after buying. */
export const leftAfter = (turn: MarketTurn) => purseTotal(turn) - turn.price;

export type PayResult = 'ok' | 'short' | 'over';
/** Coins on the tray against the price: short, over, or exactly right. */
export function checkPay(tray: readonly Denomination[], price: number): PayResult {
  const paid = total(tray);
  return paid === price ? 'ok' : paid < price ? 'short' : 'over';
}

/** The tray pays with as few coins as the purse allows. */
export function isFewest(turn: MarketTurn, tray: readonly Denomination[]): boolean {
  const fewest = fewestFromPurse(turn.purse, turn.price);
  return fewest !== null && tray.length === fewest;
}

export type TotalResult = 'ok' | 'oneOnly' | 'missing' | 'off';
/**
 * A typed total for a shopping list. Typing one treat's price, or forgetting one treat on a
 * longer list, get their own help.
 */
export function checkTotal(turn: MarketTurn, typed: number): TotalResult {
  const cents = typed * EURO;
  if (cents === turn.price) return 'ok';
  const items = turn.items ?? [];
  if (items.some((item) => item.price === cents)) return 'oneOnly';
  if (items.length > 2 && items.some((item) => turn.price - item.price === cents)) return 'missing';
  return 'off';
}

/** The change due on a turn paid with a note. */
export const changeDue = (turn: MarketTurn) => total(turn.paid ?? []) - turn.price;

export type ChangeResult = 'ok' | 'added' | 'price' | 'paid' | 'off';
/** A typed change. Adding instead, typing the price or typing the note get their own help. */
export function checkChange(turn: MarketTurn, typed: number): ChangeResult {
  const cents = typed * EURO;
  const paid = total(turn.paid ?? []);
  if (cents === paid - turn.price) return 'ok';
  if (cents === paid + turn.price) return 'added';
  if (cents === turn.price) return 'price';
  if (cents === paid) return 'paid';
  return 'off';
}

/** The change counted out at the till: the fewest coins the drawer allows earn the bonus. */
export function isFewestChange(turn: MarketTurn, tray: readonly Denomination[]): boolean {
  const fewest = fewestFromPurse(turn.till ?? [], changeDue(turn));
  return fewest !== null && tray.length === fewest;
}

export type LeftResult = 'ok' | 'added' | 'price' | 'purse' | 'off';
/**
 * A typed "what's left" answer. The common slips get their own help: adding the price on,
 * typing the price, or typing the whole purse.
 */
export function checkLeft(turn: MarketTurn, typed: number): LeftResult {
  const purse = purseTotal(turn);
  if (typed * EURO === purse - turn.price) return 'ok';
  if (typed * EURO === purse + turn.price) return 'added';
  if (typed * EURO === turn.price) return 'price';
  if (typed * EURO === purse) return 'purse';
  return 'off';
}

/** Every turn can be done: an exact pay is possible, a "what's left" is never negative. */
export function isPlayable(turn: MarketTurn): boolean {
  if (turn.steps.includes('change') && changeDue(turn) <= 0) return false;
  if (turn.steps.includes('give'))
    return changeDue(turn) > 0 && canPayExactly(turn.till ?? [], changeDue(turn));
  if (turn.steps.includes('pay') && !canPayExactly(turn.purse, turn.price)) return false;
  if (turn.steps.includes('left') && !affordable(turn)) return false;
  if (!turn.steps.includes('enough') && !affordable(turn)) return false;
  return true;
}

/**
 * A missed turn comes back two turns later (never as the big buy), with a different treat,
 * so the same numbers get a second go. The shopping spree carries its purse from turn to
 * turn, so it keeps its order.
 */
export function replayMissed(
  stage: MarketStage,
  round: readonly MarketTurn[],
  index: number,
  random: Random,
): MarketTurn[] {
  const target = index + 2;
  if (stage.skill === 'spree' || target >= round.length - 1) return [...round];
  const missed = round[index];
  const copy = [...round];
  // A shopping list comes back as it was; a single treat comes back as another treat.
  copy[target] = missed.items
    ? missed
    : { ...missed, good: pickGood(random, missed.price, round[target - 1]?.good) };
  return copy;
}

/** First-try answers in a row that light Lucky Shopper: double points until a slip. */
export const GOLDEN_STREAK = 3;

export const POINTS = { buy: 10, firstTry: 10, fewest: 5, sunset: 5 } as const;

export interface TurnScore {
  readonly firstTry: boolean;
  readonly fewest: boolean;
  readonly golden: boolean;
  readonly big: boolean;
  /** Bought before the sun went down (only with a timer). */
  readonly sunset: boolean;
}

export function turnPoints(score: TurnScore): number {
  const base =
    POINTS.buy + (score.firstTry ? POINTS.firstTry : 0) + (score.fewest ? POINTS.fewest : 0);
  const doubled = base * (score.golden ? 2 : 1) * (score.big ? 2 : 1);
  return doubled + (score.sunset ? POINTS.sunset : 0);
}

/** Round stars from first-try turns: three quarters earn three, half earn two. */
export function roundStars(firstTries: number, turns: number): 1 | 2 | 3 {
  const share = firstTries / turns;
  return share >= 0.75 ? 3 : share >= 0.5 ? 2 : 1;
}

export function isMastered(stage: MarketStage, stars: number) {
  return stars >= (stage.strict ? 3 : 2);
}

/** How fast the sun goes down: seconds per turn; the whole round's daylight is the sum. */
export const MARKET_PACES = [
  { id: 'off', label: 'paceOff', seconds: 0 },
  { id: 'relaxed', label: 'paceRelaxed', seconds: 35 },
  { id: 'normal', label: 'paceNormal', seconds: 22 },
  { id: 'fast', label: 'paceFast', seconds: 14 },
] as const;
export type MarketPace = (typeof MARKET_PACES)[number]['id'];

/** Daylight for a whole round, in seconds; the spree's two questions a turn get more. */
export function daylightSeconds(pace: MarketPace, stage: MarketStage): number {
  const base = MARKET_PACES.find((item) => item.id === pace)!.seconds;
  return Math.round(base * stage.turns * (stage.skill === 'spree' ? 1.5 : 1));
}

export function parseMarketPace(value: unknown): MarketPace {
  return MARKET_PACES.find((pace) => pace.id === value)?.id ?? 'off';
}
