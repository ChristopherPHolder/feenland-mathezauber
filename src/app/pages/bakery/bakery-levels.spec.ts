import { describe, expect, it } from 'vitest';
import {
  bakePoints,
  bakeryStage,
  bakeryStages,
  createRound,
  Fact,
  ovenSeconds,
  product,
  rehearse,
  ROUND_LENGTH,
  roundStars,
  sameFact,
} from './bakery-levels';
import {
  addGhost,
  answerGhost,
  answerPiece,
  answerTotal,
  canCut,
  cut,
  doneCutting,
  guideGaps,
  Help,
  orderPieces,
  OrderState,
  pieceChoices,
  startOrder,
  trickCard,
  tryAnotherWay,
  turn,
  uncut,
  usedTrick,
} from './bakery-order';
import { fitTray, nearestGap, pieceAt, trayGeometry } from './tray-geometry';

const stage = (n: number) => bakeryStage(`bakery-${n}`)!;
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function cutAt(n: number, fact: Fact, dir: 'rows' | 'cols', at: number) {
  return cut(stage(n), startOrder(stage(n), fact), dir, at).state;
}

/** Every number in a help's values and list, as the child would read them. */
function numbersIn(help: Help) {
  return [...Object.values(help.values ?? {}), ...(help.list ?? [])];
}

describe('bakery rounds', () => {
  it('has twelve levels in six topics with stable ids', () => {
    expect(bakeryStages.map((s) => s.stage)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(bakeryStages.map((s) => s.group)).size).toBe(6);
  });

  it('picks six orders and the cake from the pool, without repeats, products up to 100', () => {
    for (const level of bakeryStages)
      for (let seed = 1; seed < 40; seed++) {
        const round = createRound(level, [], seeded(seed));
        expect(round).toHaveLength(ROUND_LENGTH);
        const pool = level.pool();
        for (const fact of round) {
          expect(product(fact)).toBeLessThanOrEqual(100);
          if (!(level.trick === 'ghost' && fact.rows === 4))
            expect(pool.some((item) => sameFact(item, fact))).toBe(true);
        }
        const unique = round.filter(
          (fact, index) => round.findIndex((other) => sameFact(other, fact)) === index,
        );
        expect(unique.length, `level ${level.stage}`).toBe(ROUND_LENGTH);
        // The cake is the biggest tray of the round.
        expect(product(round[6])).toBe(Math.max(...round.map(product)));
      }
  });

  it('keeps level 1 to friendly rows with two to five rows', () => {
    for (const fact of createRound(stage(1), [], seeded(3))) {
      expect([2, 5, 10]).toContain(fact.cols);
      expect(fact.rows).toBeGreaterThanOrEqual(2);
      expect(fact.rows).toBeLessThanOrEqual(5);
    }
  });

  it('brings missed facts back early in the next round, within the level’s range', () => {
    const missed = [
      { rows: 7, cols: 6 },
      { rows: 3, cols: 4 },
    ];
    const round = createRound(stage(4), missed, seeded(7));
    expect(sameFact(round[1], { rows: 6, cols: 7 })).toBe(true);
    // 3 × 4 is not a ×6 fact, so it waits for a level that has it.
    expect(round.some((fact) => sameFact(fact, { rows: 3, cols: 4 }))).toBe(false);
    const master = createRound(stage(12), [{ rows: 9, cols: 7 }], seeded(2));
    expect(sameFact(master[0], { rows: 9, cols: 7 })).toBe(true);
  });

  it('puts a missed fact back later in the same round when there is room', () => {
    const round = createRound(stage(4), [], seeded(5));
    const again = rehearse(round, 1, round[1]);
    expect(sameFact(again[3], round[1])).toBe(true);
    expect(rehearse(round, 4, round[4])).toEqual(round);
  });

  it('adds a ×4 bonus order on the one-row-less level', () => {
    expect(createRound(stage(8), [], seeded(9))[3].rows).toBe(4);
  });
});

describe('cutting a tray', () => {
  const sixBySeven = { rows: 6, cols: 7 };

  it('accepts any cut along a gap, rows or columns', () => {
    const order = startOrder(stage(4), sixBySeven);
    expect(canCut(stage(4), order, 'rows', 5)).toBe(true);
    expect(canCut(stage(4), order, 'cols', 5)).toBe(true);
    expect(canCut(stage(4), order, 'rows', 0)).toBe(false);
    expect(canCut(stage(4), order, 'rows', 6)).toBe(false);
    expect(canCut(stage(4), order, 'cols', 7)).toBe(false);
    const byCols = cutAt(4, sixBySeven, 'cols', 5);
    expect(byCols.phase).toBe('pieces');
    expect(orderPieces(byCols).map((p) => [p.rows, p.cols])).toEqual([
      [6, 5],
      [6, 2],
    ]);
  });

  it('spots the level’s trick in either direction once the tray is turned', () => {
    expect(usedTrick(stage(4), cutAt(4, sixBySeven, 'rows', 5))).toBe(true);
    expect(usedTrick(stage(4), cutAt(4, sixBySeven, 'rows', 1))).toBe(true);
    expect(usedTrick(stage(4), cutAt(4, sixBySeven, 'cols', 5))).toBe(false);
    const turned = turn(startOrder(stage(4), sixBySeven));
    expect(usedTrick(stage(4), cut(stage(4), turned, 'cols', 5).state)).toBe(true);
    expect(usedTrick(stage(5), cutAt(5, { rows: 4, cols: 7 }, 'rows', 2))).toBe(true);
    expect(usedTrick(stage(5), cutAt(5, { rows: 4, cols: 7 }, 'rows', 1))).toBe(false);
    expect(usedTrick(stage(9), cutAt(9, { rows: 7, cols: 8 }, 'rows', 5))).toBe(true);
    expect(usedTrick(stage(9), cutAt(9, { rows: 7, cols: 8 }, 'rows', 2))).toBe(true);
    expect(usedTrick(stage(9), cutAt(9, { rows: 7, cols: 8 }, 'rows', 3))).toBe(false);
  });

  it('allows halving and halving again on ×8', () => {
    let order = startOrder(stage(6), { rows: 8, cols: 6 });
    expect(guideGaps(stage(6), order)).toEqual({ dir: 'rows', gaps: [4] });
    let step = cut(stage(6), order, 'rows', 4);
    expect(step.result).toBe('more');
    order = step.state;
    expect(guideGaps(stage(6), order)).toEqual({ dir: 'rows', gaps: [2, 6] });
    expect(canCut(stage(6), order, 'cols', 3)).toBe(false);
    step = cut(stage(6), order, 'rows', 2);
    expect(usedTrick(stage(6), step.state)).toBe(true);
    step = doneCutting(step.state);
    expect(step.state.phase).toBe('pieces');
    expect(orderPieces(step.state).map((p) => p.rows)).toEqual([2, 2, 4]);
  });

  it('names twins together and asks for the total last', () => {
    let order = cutAt(5, { rows: 4, cols: 7 }, 'rows', 2);
    const wrong = answerPiece(order, 0, 15);
    expect(wrong.right).toBe(false);
    expect(wrong.state.slips).toBe(1);
    const right = answerPiece(order, 0, 14);
    expect(right.twins).toBe(1);
    order = right.state;
    expect(order.values).toEqual([14, 14]);
    expect(order.phase).toBe('total');
    expect(answerTotal(order, 28).state.phase).toBe('baked');
  });

  it('lets the tray go back together before a piece is named', () => {
    const order = cutAt(4, sixBySeven, 'cols', 3);
    expect(uncut(order).phase).toBe('cut');
    const named = answerPiece(order, 0, 18).state;
    expect(uncut(named)).toBe(named);
  });

  it('takes the ghost-row way on ×9: the full tray, then the nibble', () => {
    let order = startOrder(stage(8), { rows: 9, cols: 6 });
    order = addGhost(stage(8), order);
    expect(order.phase).toBe('ghost');
    expect(answerGhost(order, 54).right).toBe(false);
    order = answerGhost(order, 60).state;
    expect(order.phase).toBe('total');
    expect(usedTrick(stage(8), order)).toBe(true);
    const full = answerTotal(order, 60);
    expect(full.help?.key).toBe('ghostFull');
    expect(answerTotal(order, 54).right).toBe(true);
    // A normal cut on ×9 is still right.
    const cutNine = cutAt(8, { rows: 9, cols: 6 }, 'rows', 5);
    expect(cutNine.phase).toBe('pieces');
  });

  it('asks for another way and refuses the same cut twice', () => {
    let order = cutAt(9, { rows: 7, cols: 8 }, 'rows', 5);
    order = answerPiece(order, 0, 40).state;
    order = answerPiece(order, 1, 16).state;
    order = answerTotal(order, 56).state;
    order = tryAnotherWay(order);
    expect(order.phase).toBe('cut');
    expect(cut(stage(9), order, 'rows', 2).result).toBe('same');
    const turned = turn(order);
    expect(cut(stage(9), turned, 'cols', 5).result).toBe('same');
    const other = cut(stage(9), order, 'cols', 5).state;
    let done = answerPiece(other, 0, 35).state;
    done = answerPiece(done, 1, 21).state;
    expect(done.phase).toBe('baked');
    expect(done.secondWay).toBe(true);
  });
});

describe('help after a mistake', () => {
  const order = cutAt(4, { rows: 6, cols: 7 }, 'rows', 5);
  const named = answerPiece(answerPiece(order, 0, 35).state, 1, 7).state;

  it('spots added factors and a forgotten piece', () => {
    expect(answerTotal(named, 13).help).toMatchObject({ key: 'addedFactors' });
    expect(answerTotal(named, 35).help).toMatchObject({ key: 'onePiece' });
    expect(answerPiece(order, 0, 12).help).toMatchObject({ key: 'addedFactors' });
  });

  it('restates the child’s own pieces first, then shows the picture card', () => {
    const first = answerTotal(named, 40);
    expect(first.help).toMatchObject({ key: 'ownPieces', list: [35, 7] });
    const second = answerTotal(first.state, 41);
    expect(second.help).toMatchObject({ key: 'lookCard', card: true });
  });

  it('never shows the product or an unsolved piece in a hint', () => {
    for (const level of bakeryStages)
      for (const fact of level.pool()) {
        const total = product(fact);
        let state: OrderState = startOrder(level, fact);
        const helps: Help[] = [];
        if (level.cut) {
          const at = Math.min(fact.rows - 1, 5);
          if (at < 1) continue;
          state = cut(level, state, 'rows', at).state;
          if (state.phase === 'cut') state = doneCutting(state).state;
          const pieces = orderPieces(state);
          pieces.forEach((piece, index) => {
            for (const wrong of [piece.rows + piece.cols, piece.rows * piece.cols + 1, 1]) {
              const help = answerPiece(state, index, wrong).help;
              if (!help) continue;
              helps.push(help);
              for (const n of numbersIn(help)) {
                expect(n).not.toBe(piece.rows * piece.cols);
                expect(n).not.toBe(total);
              }
            }
            if (state.values[index] === null)
              state = answerPiece(state, index, piece.rows * piece.cols).state;
          });
        }
        for (const wrong of [fact.rows + fact.cols, total - 1, total + 3, total + 7]) {
          const answer = answerTotal(state, wrong);
          if (answer.right || !answer.help) continue;
          for (const n of numbersIn(answer.help)) expect(n).not.toBe(total);
          state = answer.state;
          helps.push(answer.help);
          if (answer.help.card) {
            const card = trickCard(level, state);
            expect(card.rows * card.cols).not.toBe(total);
            expect(card.cols).not.toBe(fact.cols);
          }
        }
        expect(helps.length).toBeGreaterThan(0);
      }
  });
});

describe('scoring', () => {
  it('pays for the tray, first try, the trick and a perfect bake, doubling cake and golden oven', () => {
    const plain = { firstTry: false, trick: false, perfect: false, golden: false, cake: false };
    expect(bakePoints(plain)).toBe(10);
    expect(bakePoints({ ...plain, firstTry: true, trick: true })).toBe(30);
    expect(bakePoints({ ...plain, firstTry: true, trick: true, perfect: true })).toBe(45);
    expect(bakePoints({ ...plain, firstTry: true, cake: true })).toBe(40);
    expect(bakePoints({ ...plain, firstTry: true, cake: true, golden: true })).toBe(80);
  });

  it('gives three stars for one slip, two for four first tries', () => {
    expect(roundStars(7)).toBe(3);
    expect(roundStars(6)).toBe(3);
    expect(roundStars(4)).toBe(2);
    expect(roundStars(3)).toBe(1);
  });

  it('times bigger trays longer and has no timer when it is off', () => {
    expect(ovenSeconds('off', { rows: 6, cols: 7 }, true)).toBe(0);
    expect(ovenSeconds('normal', { rows: 9, cols: 9 }, true)).toBeGreaterThan(
      ovenSeconds('normal', { rows: 3, cols: 2 }, true),
    );
    expect(ovenSeconds('relaxed', { rows: 6, cols: 7 }, true)).toBeGreaterThan(
      ovenSeconds('fast', { rows: 6, cols: 7 }, true),
    );
  });

  it('offers four different choices with the answer and the added factors', () => {
    for (let seed = 1; seed < 20; seed++) {
      const choices = pieceChoices({ rows: 5, cols: 7 }, seeded(seed));
      expect(new Set(choices).size).toBe(4);
      expect(choices).toContain(35);
      expect(choices).toContain(12);
    }
  });
});

describe('tray geometry', () => {
  it('leaves a wider gap after every fifth line and slides pieces apart at a cut', () => {
    const geometry = trayGeometry({ rows: 6, cols: 7 });
    expect(geometry.rowGaps).toHaveLength(5);
    expect(geometry.colGaps).toHaveLength(6);
    const step = geometry.rowY[1] - geometry.rowY[0];
    expect(geometry.rowY[5] - geometry.rowY[4]).toBeGreaterThan(step);
    const split = trayGeometry({ rows: 6, cols: 7, dir: 'rows', cuts: [5] });
    expect(split.height).toBeGreaterThan(geometry.height);
    expect(split.pieceRects).toHaveLength(2);
  });

  it('finds the gap and piece under a tap', () => {
    const geometry = trayGeometry({ rows: 6, cols: 7 });
    expect(nearestGap(geometry, 3, geometry.rowGaps[4] + 0.1)).toMatchObject({
      dir: 'rows',
      at: 5,
    });
    expect(nearestGap(geometry, geometry.colGaps[1], 2.2, 'cols')).toMatchObject({ at: 2 });
    const split = trayGeometry({ rows: 6, cols: 7, dir: 'rows', cuts: [5] });
    expect(pieceAt(split, 2, split.rowY[5])).toBe(1);
    expect(pieceAt(split, 2, split.rowY[0])).toBe(0);
  });

  it('fits the tray inside the board and keeps a 10 × 10 tray’s cookies big on a phone', () => {
    const geometry = trayGeometry({ rows: 10, cols: 10 });
    const fit = fitTray(358, 440, geometry);
    expect(fit.x).toBeGreaterThanOrEqual(0);
    expect(fit.x + fit.width).toBeLessThanOrEqual(358);
    expect(fit.y + fit.height).toBeLessThanOrEqual(440);
    expect(fit.scale).toBeGreaterThanOrEqual(24);
  });
});
