import { describe, expect, it } from 'vite-plus/test';
import {
  affordable,
  checkLeft,
  changeDue,
  checkChange,
  checkNeed,
  checkPay,
  checkPlan,
  isFewestChange,
  checkTotal,
  daylightSeconds,
  GOODS,
  isFewest,
  isPlayable,
  leftAfter,
  marketLevels,
  marketStage,
  marketStages,
  MarketTurn,
  pickGood,
  purseTotal,
  replayMissed,
  roundStars,
  seeded,
  turnPoints,
  withPlan,
} from './market-levels';
import { EURO } from './market-money';

const euros = (n: number) => n * EURO;
const rounds = (stage: number, count = 200) =>
  Array.from({ length: count }, (_, seed) => marketStage(`market-${stage}`)!.round(seeded(seed)));

describe('market levels', () => {
  it('lists twelve levels with stable ids and a topic each', () => {
    expect(marketLevels.map((level) => level.id)).toEqual([
      'market-1',
      'market-2',
      'market-3',
      'market-4',
      'market-5',
      'market-6',
      'market-7',
      'market-8',
      'market-9',
      'market-10',
      'market-11',
      'market-12',
    ]);
    expect(marketLevels.every((level) => level.group)).toBe(true);
    expect(marketStage('market-99')).toBeUndefined();
  });

  it('makes every turn of every level playable, with the right number of turns', () => {
    for (const stage of marketStages)
      for (const round of rounds(stage.stage)) {
        expect(round).toHaveLength(stage.turns);
        for (const turn of round) expect(isPlayable(turn)).toBe(true);
      }
  });

  it('prices every treat inside its own price range, never the same treat twice in a row', () => {
    for (const stage of marketStages)
      for (const round of rounds(stage.stage, 50))
        round.forEach((turn, index) => {
          for (const item of turn.items ?? [{ good: turn.good, price: turn.price }]) {
            const good = GOODS.find((entry) => entry.id === item.good)!;
            expect(item.price).toBeGreaterThanOrEqual(euros(good.from));
            expect(item.price).toBeLessThanOrEqual(euros(good.to));
          }
          if (index > 0 && !['spree', 'jar', 'party'].includes(stage.skill))
            expect(turn.good).not.toBe(round[index - 1].good);
        });
  });

  it('keeps level 1 to 1 € and 2 € coins and prices up to 10 € (12 € for the big buy)', () => {
    for (const round of rounds(1))
      round.forEach((turn, index) => {
        expect(turn.purse.every((coin) => coin === 100 || coin === 200)).toBe(true);
        expect(turn.price).toBeLessThanOrEqual(index === round.length - 1 ? euros(12) : euros(10));
        expect(purseTotal(turn)).toBeGreaterThan(turn.price);
      });
  });

  it('always lets level 2 be paid with the fewest coins and notes', () => {
    for (const round of rounds(2))
      for (const turn of round) {
        expect(turn.price).toBeLessThanOrEqual(euros(20));
        expect(turn.purse.some((coin) => coin >= 500)).toBe(true);
      }
  });

  it('asks "enough?" on level 3 with both answers and some just-enough purses', () => {
    const turns = rounds(3).flat();
    const yes = turns.filter(affordable);
    expect(yes.length).toBeGreaterThan(turns.length * 0.35);
    expect(turns.length - yes.length).toBeGreaterThan(turns.length * 0.25);
    expect(turns.some((turn) => turn.price === purseTotal(turn))).toBe(true);
    // The purse shows its coins on the first three, then only its tag.
    for (const round of rounds(3, 20)) {
      expect(round.slice(0, 3).every((turn) => turn.look === 'coins')).toBe(true);
      expect(round.slice(3).every((turn) => turn.look === 'tag')).toBe(true);
    }
  });

  it('keeps "what is left" on level 4 within 10 € and never zero or below', () => {
    for (const turn of rounds(4).flat()) {
      expect(purseTotal(turn)).toBeLessThanOrEqual(euros(10));
      expect(leftAfter(turn)).toBeGreaterThan(0);
    }
  });

  it('carries the purse through the shopping spree and refills it after "not enough"', () => {
    let shortRounds = 0;
    for (const round of rounds(5)) {
      expect(round[0].purse.reduce((a, b) => a + b, 0)).toBe(euros(20));
      let short = false;
      for (let index = 1; index < round.length - 1; index++) {
        const before = round[index - 1];
        const turn = round[index];
        if (!turn.refill) expect(purseTotal(turn)).toBe(leftAfter(before));
        if (!affordable(before)) {
          expect(turn.refill).toBe(true);
          short = true;
        }
        expect(turn.steps).toEqual(affordable(turn) ? ['enough', 'left'] : ['enough']);
      }
      if (short || !affordable(round.at(-2)!)) shortRounds++;
      const big = round.at(-1)!;
      expect(purseTotal(big)).toBe(euros(20));
      expect(big.price).toBeGreaterThan(euros(10));
    }
    expect(shortRounds).toBeGreaterThan(150);
  });
});

describe('adding up', () => {
  it('lists two different treats on level 6 whose prices make the price, up to 20 €', () => {
    for (const turn of rounds(6).flat()) {
      expect(turn.items).toHaveLength(2);
      expect(turn.items![0].good).not.toBe(turn.items![1].good);
      expect(turn.items!.reduce((sum, item) => sum + item.price, 0)).toBe(turn.price);
      expect(turn.price).toBeLessThanOrEqual(euros(20));
      expect(turn.steps).toEqual(['total', 'pay']);
      expect(turn.good).toBe(turn.items![0].good);
    }
  });

  it('lists three treats on level 7 from a 20 € purse, always with something left', () => {
    for (const turn of rounds(7).flat()) {
      expect(turn.items).toHaveLength(3);
      expect(new Set(turn.items!.map((item) => item.good)).size).toBe(3);
      expect(purseTotal(turn)).toBe(euros(20));
      expect(leftAfter(turn)).toBeGreaterThan(0);
      expect(turn.steps).toEqual(['total', 'left']);
    }
  });

  it('tells one price and a forgotten treat apart from other wrong totals', () => {
    const turn: MarketTurn = {
      good: 'apple',
      price: euros(10),
      items: [
        { good: 'apple', price: euros(2) },
        { good: 'book', price: euros(5) },
        { good: 'ribbon', price: euros(3) },
      ],
      purse: [1000, 1000],
      steps: ['total', 'left'],
      look: 'tag',
    };
    expect(checkTotal(turn, 10)).toBe('ok');
    expect(checkTotal(turn, 5)).toBe('oneOnly');
    expect(checkTotal(turn, 7)).toBe('missing');
    expect(checkTotal(turn, 11)).toBe('off');
  });

  it('brings a missed shopping list back unchanged', () => {
    const stage = marketStage('market-6')!;
    const round = stage.round(seeded(9));
    expect(replayMissed(stage, round, 0, seeded(1))[2]).toBe(round[0]);
  });
});

describe('change', () => {
  it('pays with a 10 € note on level 8 and a 20 € note on level 9, always with change', () => {
    for (const turn of rounds(8).flat()) {
      expect(turn.paid).toEqual([1000]);
      expect(changeDue(turn)).toBeGreaterThan(0);
    }
    const nine = rounds(9).flat();
    for (const turn of nine) {
      expect(turn.paid).toEqual([2000]);
      expect(changeDue(turn)).toBeGreaterThan(0);
    }
    // Most prices make the count up to 20 cross a ten.
    const crossing = nine.filter((turn) => turn.price > 1000);
    expect(crossing.length).toBeGreaterThan(nine.length * 0.4);
  });

  it('lets Lumi give every change from the till, to a customer, with the smallest note that pays', () => {
    for (const round of rounds(10))
      round.forEach((turn, index) => {
        expect(turn.customer).toBeDefined();
        expect(turn.steps).toEqual(['give']);
        const note = turn.paid![0];
        expect(note).toBeGreaterThan(turn.price);
        const smallest = [500, 1000, 2000].find((value) => value > turn.price);
        if (index < round.length - 1) expect(note).toBe(smallest);
      });
  });

  it('gives the common change slips their own help', () => {
    const turn: MarketTurn = {
      good: 'honey',
      price: euros(7),
      paid: [1000],
      purse: [1000],
      steps: ['change'],
      look: 'tag',
    };
    expect(checkChange(turn, 3)).toBe('ok');
    expect(checkChange(turn, 17)).toBe('added');
    expect(checkChange(turn, 7)).toBe('price');
    expect(checkChange(turn, 10)).toBe('paid');
    expect(checkChange(turn, 4)).toBe('off');
  });

  it('knows the fewest coins of change the till allows', () => {
    const turn: MarketTurn = {
      good: 'book',
      price: euros(3),
      paid: [1000],
      till: [1000, 500, 200, 200, 100, 100, 100],
      customer: 'fox',
      purse: [],
      steps: ['give'],
      look: 'coins',
    };
    expect(isFewestChange(turn, [500, 200])).toBe(true);
    expect(isFewestChange(turn, [200, 200, 100, 100, 100, 100])).toBe(false);
  });
});

describe('plan and save', () => {
  it('offers three different wants at a party, with the cupcake always fitting the budget', () => {
    for (const turn of rounds(11).flat()) {
      expect(turn.items).toEqual([{ good: 'cupcake', price: turn.price }]);
      expect(new Set(turn.offers!.map((item) => item.good)).size).toBe(3);
      expect(turn.offers!.some((item) => item.good === 'cupcake')).toBe(false);
      expect(checkPlan(turn, [])).toBe('ok');
    }
  });

  it('accepts any plan within the budget and folds the wants into the list', () => {
    const turn = rounds(11, 1)[0][0];
    const fits = [0, 1, 2].filter(
      (index) => turn.price + turn.offers![index].price <= purseTotal(turn),
    );
    expect(checkPlan(turn, fits.slice(0, 1))).toBe('ok');
    expect(checkPlan(turn, [0, 1, 2])).toBe('tooMany');
    const planned = withPlan(turn, [0]);
    expect(planned.items).toHaveLength(2);
    expect(planned.price).toBe(turn.price + turn.offers![0].price);
    const greedy = { ...turn, offers: [{ good: 'kite' as const, price: euros(20) }] };
    expect(checkPlan(greedy, [0])).toBe('overBudget');
  });

  it('fills the wish jar day by day until the last day can buy the wish', () => {
    for (const round of rounds(12)) {
      const goal = round[0].price;
      round.forEach((turn, day) => {
        expect(turn.price).toBe(goal);
        expect(purseTotal(turn)).toBe(turn.pocket! * (day + 1));
        if (day < round.length - 1) {
          expect(turn.steps).toEqual(['need']);
          expect(purseTotal(turn)).toBeLessThan(goal);
        } else {
          expect(turn.steps).toEqual(['enough']);
          expect(affordable(turn)).toBe(true);
        }
      });
    }
  });

  it('helps with "how much more" without giving it away', () => {
    const turn = rounds(12, 1)[0][1];
    const jar = purseTotal(turn) / 100;
    const goal = turn.price / 100;
    expect(checkNeed(turn, goal - jar)).toBe('ok');
    expect(checkNeed(turn, jar)).toBe('jarOnly');
    expect(checkNeed(turn, goal)).toBe('goalOnly');
  });
});

describe('market checks', () => {
  const turn: MarketTurn = {
    good: 'honey',
    price: euros(6),
    purse: [500, 200, 100, 100],
    steps: ['pay'],
    look: 'coins',
  };

  it('tells short, over and exact payments apart', () => {
    expect(checkPay([500], euros(6))).toBe('short');
    expect(checkPay([500, 200], euros(6))).toBe('over');
    expect(checkPay([500, 100], euros(6))).toBe('ok');
  });

  it('knows the fewest coins the purse allows', () => {
    expect(isFewest(turn, [500, 100])).toBe(true);
    expect(isFewest(turn, [200, 100, 100, 100])).toBe(false);
  });

  it('gives the common "what is left" slips their own help', () => {
    const left = { ...turn, steps: ['left'] as const };
    expect(checkLeft(left, 3)).toBe('ok');
    expect(checkLeft(left, 15)).toBe('added');
    expect(checkLeft(left, 6)).toBe('price');
    expect(checkLeft(left, 9)).toBe('purse');
    expect(checkLeft(left, 4)).toBe('off');
  });

  it('brings a missed turn back two turns later, never as the big buy', () => {
    const stage = marketStage('market-4')!;
    const round = stage.round(seeded(3));
    const again = replayMissed(stage, round, 1, seeded(4));
    expect(again[3].price).toBe(round[1].price);
    expect(again[3].purse).toEqual(round[1].purse);
    expect(replayMissed(stage, round, round.length - 2, seeded(4))).toEqual(round);
    const spree = marketStage('market-5')!;
    const spreeRound = spree.round(seeded(3));
    expect(replayMissed(spree, spreeRound, 0, seeded(4))).toEqual(spreeRound);
  });

  it('picks a treat that may cost the price', () => {
    expect(pickGood(seeded(1), euros(20))).toMatch(/kite|dragon/);
    expect(pickGood(seeded(1), euros(1), 'apple')).not.toBe('apple');
  });
});

describe('market scoring', () => {
  it('doubles for Lucky Shopper and the big buy, and adds the sunset bonus on top', () => {
    const plain = { firstTry: false, fewest: false, golden: false, big: false, sunset: false };
    expect(turnPoints(plain)).toBe(10);
    expect(turnPoints({ ...plain, firstTry: true })).toBe(20);
    expect(turnPoints({ ...plain, firstTry: true, fewest: true, golden: true })).toBe(50);
    expect(turnPoints({ ...plain, firstTry: true, golden: true, big: true, sunset: true })).toBe(
      85,
    );
  });

  it('gives stars from first tries and lets the sun set over the round', () => {
    expect(roundStars(6, 7)).toBe(3);
    expect(roundStars(4, 7)).toBe(2);
    expect(roundStars(2, 7)).toBe(1);
    expect(daylightSeconds('off', marketStages[0])).toBe(0);
    expect(daylightSeconds('normal', marketStages[0])).toBe(22 * 7);
  });
});
