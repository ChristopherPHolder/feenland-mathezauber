import { createRound, ponds, relation, ROUND_SIZE, starsFor, Comparison } from './compare';
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
function evaluate(text: string): number {
  const [a, operator, b] = text.split(' ');
  if (!operator) return Number(a);
  return operator === '+' ? Number(a) + Number(b) : Number(a) - Number(b);
}
describe('Hungry crocodile comparisons', () => {
  it('judges greater, less and equal', () => {
    expect(relation(5, 12)).toBe('<');
    expect(relation(18, 14)).toBe('>');
    expect(relation(9, 9)).toBe('=');
  });
  it('rewards first-try answers with up to three stars', () => {
    expect(starsFor(ROUND_SIZE)).toBe(3);
    expect(starsFor(8)).toBe(2);
    expect(starsFor(6)).toBe(1);
    expect(starsFor(5)).toBe(0);
  });
  it('builds ten solvable comparisons inside every pond range', () => {
    for (const pond of ponds)
      for (let seed = 1; seed <= 25; seed++) {
        const round = createRound(pond, seeded(seed * 7 + pond.number));
        expect(round).toHaveLength(ROUND_SIZE);
        for (const comparison of round) {
          for (const side of [comparison.left, comparison.right]) {
            expect(evaluate(side.text)).toBe(side.value);
            expect(side.value).toBeGreaterThanOrEqual(0);
            expect(side.value).toBeLessThanOrEqual(pond.max);
            if (side.text.includes('−'))
              expect(evaluate(side.text.split(' ')[0])).toBeLessThanOrEqual(pond.max);
          }
          expect(relation(comparison.left.value, comparison.right.value)).toBe(comparison.answer);
        }
      }
  });
  it('mixes all three answers and keeps the written sides different', () => {
    const answers = new Set<string>();
    const rounds: Comparison[] = [];
    for (let seed = 1; seed <= 20; seed++) rounds.push(...createRound(ponds[1], seeded(seed)));
    rounds.forEach((comparison) => answers.add(comparison.answer));
    expect([...answers].sort()).toEqual(['<', '=', '>']);
    const equalSums = createRound(ponds[3], seeded(3)).filter((entry) => entry.answer === '=');
    for (const comparison of equalSums)
      expect(comparison.left.text).not.toBe(comparison.right.text);
  });
  it('uses plain numbers in the first two ponds and calculations later', () => {
    const plain = (round: readonly Comparison[]) =>
      round.every((entry) => !/[+−]/.test(entry.left.text + entry.right.text));
    expect(plain(createRound(ponds[0], seeded(2)))).toBe(true);
    expect(plain(createRound(ponds[1], seeded(2)))).toBe(true);
    const sums = createRound(ponds[2], seeded(2));
    expect(
      sums.every((entry) => /[+−]/.test(entry.left.text) !== /[+−]/.test(entry.right.text)),
    ).toBe(true);
    const equations = createRound(ponds[3], seeded(2));
    expect(
      equations.every((entry) => /[+−]/.test(entry.left.text) && /[+−]/.test(entry.right.text)),
    ).toBe(true);
    const big = createRound(ponds[4], seeded(2));
    expect(big.every((entry) => entry.left.value >= 10 && entry.right.value >= 10)).toBe(true);
  });
});
