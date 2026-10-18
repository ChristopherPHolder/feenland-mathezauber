import { FIRST_ROUND, WORKSHEET_PROBLEMS, bridgePlan, newRound } from './bridge-math';

describe('worksheet bridge strategies', () => {
  it.each(WORKSHEET_PROBLEMS)('solves $left $operator $right with missing $missing', (problem) => {
    const plan = bridgePlan(problem);
    expect(plan.answer).toBe(problem[problem.missing]);
    expect(plan.hops.reduce((sum, hop) => sum + hop, 0) + plan.start).toBe(plan.end);
    expect(plan.hops.every((hop) => hop > 0)).toBe(true);
    expect(plan.result).toBeGreaterThanOrEqual(0);
    expect(Math.max(...plan.points, plan.result)).toBeLessThanOrEqual(30);
    expect(plan.findLanding ? plan.end : plan.distance).toBe(plan.answer);
    if (plan.bridge !== null) expect(plan.bridge % 10).toBe(0);
  });

  it('splits 7 + ? = 16 into 3 and 6 rather than counting nine single steps', () => {
    expect(bridgePlan(FIRST_ROUND[0])).toMatchObject({
      points: [7, 10, 16],
      hops: [3, 6],
      answer: 9,
    });
  });

  it('finds a missing starting number by adding back, rather than answering with the gap', () => {
    expect(bridgePlan({ left: 23, right: 6, operator: '−', missing: 'left' })).toMatchObject({
      start: 17,
      end: 23,
      hops: [3, 3],
      answer: 23,
      findLanding: true,
    });
  });

  it('uses a single hop when the target is the next ten or within the same ten', () => {
    expect(bridgePlan({ left: 6, right: 14, operator: '+', missing: 'right' }).points).toEqual([
      6, 10, 20,
    ]);
    expect(bridgePlan({ left: 18, right: 2, operator: '+', missing: 'right' }).points).toEqual([
      18, 20,
    ]);
    expect(bridgePlan({ left: 12, right: 6, operator: '+', missing: 'right' }).points).toEqual([
      12, 18,
    ]);
    expect(bridgePlan({ left: 20, right: 8, operator: '−', missing: 'left' })).toMatchObject({
      points: [12, 20],
      answer: 20,
    });
  });

  it('creates eight distinct practice problems from the worksheet', () => {
    const round = newRound();
    expect(round).toHaveLength(8);
    expect(new Set(round).size).toBe(8);
    expect(round.every((problem) => WORKSHEET_PROBLEMS.includes(problem))).toBe(true);
  });
});
