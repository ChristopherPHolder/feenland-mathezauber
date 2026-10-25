import { emptyProgress } from '../../core/catalog';
import { ROUND_LENGTH } from './comparison';
import {
  comboFor,
  earnedHats,
  goldenSnacks,
  parseBestScores,
  perfectScore,
  snackKind,
  snackPoints,
} from './crocodile-score';
describe('crocodile scoring and rewards', () => {
  it('doubles points after three in a row and triples after six', () => {
    expect([1, 2, 3, 5, 6, 9].map(comboFor)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(snackPoints('plain', 1)).toBe(10);
    expect(snackPoints('golden', 3)).toBe(60);
    expect(snackPoints('boss', 6)).toBe(150);
  });
  it('shines two middle snacks gold and makes the last snack the big fish', () => {
    let seed = 7;
    const golden = goldenSnacks(() => ((seed = (seed * 48271) % 2147483647) % 1000) / 1000);
    expect(golden.size).toBe(2);
    for (const index of golden) {
      expect(index).toBeGreaterThan(0);
      expect(index).toBeLessThan(ROUND_LENGTH - 1);
    }
    expect(snackKind(0, golden)).toBe('plain');
    expect(snackKind(ROUND_LENGTH - 1, golden)).toBe('boss');
    expect(snackKind([...golden][0], golden)).toBe('golden');
    expect(perfectScore(new Set([3, 5]))).toBe(10 + 10 + 20 + 60 + 20 + 90 + 30 + 30 + 30 + 150);
  });
  it('awards a hat for every level with two stars and recovers best scores safely', () => {
    expect(earnedHats(emptyProgress)).toEqual([]);
    const hats = earnedHats({
      ...emptyProgress,
      stars: { 'crocodile-1': 3, 'crocodile-2': 1, 'crocodile-3': 2, 'crocodile-9': 3 },
    });
    expect(hats.map((hat) => hat.id)).toEqual(['party', 'pirate']);
    expect(parseBestScores(null)).toEqual({});
    expect(parseBestScores({ version: 2, best: { 'crocodile-1': 10 } })).toEqual({});
    expect(
      parseBestScores({
        version: 1,
        best: { 'crocodile-1': 240, 'crocodile-2': -5, other: 3, 'crocodile-3': 'x' },
      }),
    ).toEqual({ 'crocodile-1': 240 });
  });
});
