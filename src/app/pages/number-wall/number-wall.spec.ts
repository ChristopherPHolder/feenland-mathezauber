import {
  allBricks,
  fillOrder,
  generateWall,
  generateWorld,
  hintFor,
  isSolvable,
  levels,
  rulesFor,
  seededRandom,
  solve,
  valueOf,
  Wall,
  WALLS_PER_WORLD,
} from './number-wall';

describe('number wall generator', () => {
  const samples = (level: 1 | 2 | 3 | 4, count = 200) =>
    Array.from({ length: count }, (_, seed) => generateWall(level, seededRandom(seed + 1)));

  it('builds every brick above as the sum of the two bricks below', () => {
    for (const level of levels)
      for (const wall of samples(level))
        for (let row = 1; row < wall.rows.length; row++)
          wall.rows[row]!.forEach((value, col) =>
            expect(value).toBe(wall.rows[row - 1]![col]! + wall.rows[row - 1]![col + 1]!),
          );
  });

  it('keeps bottom bricks between 0 and 10 and sums within the level range', () => {
    for (const level of levels) {
      const rules = rulesFor(level);
      for (const wall of samples(level)) {
        expect(wall.rows).toHaveLength(rules.rowCount);
        for (const value of wall.rows[0]!) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(10);
        }
        expect(wall.rows[wall.rows.length - 1]![0]).toBeLessThanOrEqual(rules.maxTop);
        expect(wall.rows[0]!.filter((value) => value === 0).length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('places missing bricks according to the level pattern', () => {
    for (const wall of samples(1)) expect(wall.missing).toEqual([{ row: 1, col: 0 }]);
    for (const wall of samples(2)) {
      expect(wall.missing).toHaveLength(1);
      expect(wall.missing[0]!.row).toBe(0);
    }
    const level3Rows = new Set<number>();
    for (const wall of samples(3)) {
      expect(wall.missing).toHaveLength(1);
      level3Rows.add(wall.missing[0]!.row);
    }
    expect([...level3Rows].sort()).toEqual([0, 1, 2]);
    for (const wall of samples(4)) {
      expect(wall.missing).toHaveLength(2);
      expect(wall.missing.some((brick) => brick.row === 0)).toBe(true);
      expect(wall.missing[0]).not.toEqual(wall.missing[1]);
    }
  });

  it('only produces walls with exactly one solution', () => {
    for (const level of levels)
      for (const wall of samples(level)) {
        expect(isSolvable(wall)).toBe(true);
        expect(solve(wall.rows, wall.missing)).toEqual(wall.rows);
      }
  });

  it('is deterministic for the same seed and varies across seeds', () => {
    expect(generateWall(3, seededRandom(42))).toEqual(generateWall(3, seededRandom(42)));
    const walls = samples(1, 30).map((wall) => wall.rows[0]!.join());
    expect(new Set(walls).size).toBeGreaterThan(10);
  });

  it('refuses walls whose missing bricks cannot be determined', () => {
    const rows = [[3, 4, 5], [7, 9], [16]];
    expect(
      solve(rows, [
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ]),
    ).toBeUndefined();
    expect(
      solve(rows, [
        { row: 0, col: 0 },
        { row: 2, col: 0 },
      ]),
    ).toEqual(rows);
  });

  it('creates a world of distinct consecutive walls', () => {
    const world = generateWorld(2, seededRandom(7));
    expect(world).toHaveLength(WALLS_PER_WORLD);
    for (let index = 1; index < world.length; index++)
      expect(world[index]!.rows[0]!.join()).not.toBe(world[index - 1]!.rows[0]!.join());
  });
});

describe('number wall hints', () => {
  const wall: Wall = {
    level: 4,
    rows: [[3, 4, 5], [7, 9], [16]],
    missing: [
      { row: 0, col: 0 },
      { row: 2, col: 0 },
    ],
  };

  it('explains a missing top as an addition', () => {
    expect(hintFor(wall, { row: 2, col: 0 }, [])).toEqual({
      kind: 'add',
      left: 7,
      right: 9,
      sum: 16,
    });
  });

  it('explains a missing bottom brick as completing to the brick above', () => {
    expect(hintFor(wall, { row: 0, col: 0 }, [])).toEqual({
      kind: 'complete',
      known: 4,
      target: 7,
      answer: 3,
    });
  });

  it('asks for the other brick first when nothing around is visible yet', () => {
    const chained: Wall = {
      ...wall,
      missing: [
        { row: 1, col: 0 },
        { row: 2, col: 0 },
      ],
    };
    expect(hintFor(chained, { row: 2, col: 0 }, [])).toEqual({ kind: 'fillOther' });
    expect(hintFor(chained, { row: 2, col: 0 }, [{ row: 1, col: 0 }])).toEqual({
      kind: 'add',
      left: 7,
      right: 9,
      sum: 16,
    });
  });

  it('fills bottom bricks before the bricks that depend on them', () => {
    expect(fillOrder(wall)).toEqual([
      { row: 0, col: 0 },
      { row: 2, col: 0 },
    ]);
    expect(allBricks(wall)).toHaveLength(6);
    expect(valueOf(wall, { row: 1, col: 1 })).toBe(9);
  });
});
