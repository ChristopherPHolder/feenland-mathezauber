export interface Problem {
  left: number;
  right: number;
  operator: '+' | '−';
  missing: 'left' | 'right';
}

export function bridgePlan(problem: Problem) {
  const { left, right, operator, missing } = problem;
  const result = operator === '+' ? left + right : left - right;
  const start = operator === '+' ? (missing === 'left' ? right : left) : result;
  const end = operator === '+' ? result : left;
  const nextTen = (Math.floor(start / 10) + 1) * 10;
  const bridge = nextTen < end ? nextTen : null;
  const points = bridge === null ? [start, end] : [start, bridge, end];
  const hops = points.slice(1).map((point, index) => point - points[index]);
  const findLanding = operator === '−' && missing === 'left';
  return {
    start,
    end,
    bridge,
    points,
    hops,
    result,
    findLanding,
    answer: missing === 'left' ? left : right,
    distance: end - start,
    calculation: findLanding
      ? `${start} + ${right} = ${end}`
      : `${hops.join(' + ')} = ${end - start}`,
  };
}

// The first round introduces the four missing-number patterns in the worksheet.
export const FIRST_ROUND: readonly Problem[] = [
  { left: 7, right: 9, operator: '+', missing: 'right' },
  { left: 18, right: 12, operator: '+', missing: 'right' },
  { left: 18, right: 7, operator: '−', missing: 'right' },
  { left: 23, right: 6, operator: '−', missing: 'left' },
  { left: 11, right: 8, operator: '+', missing: 'left' },
  { left: 13, right: 8, operator: '+', missing: 'right' },
  { left: 25, right: 6, operator: '−', missing: 'right' },
  { left: 20, right: 8, operator: '−', missing: 'left' },
];

const EXTRA_PROBLEMS: readonly Problem[] = [
  { left: 19, right: 5, operator: '+', missing: 'left' },
  { left: 6, right: 14, operator: '+', missing: 'right' },
  { left: 25, right: 4, operator: '+', missing: 'left' },
  { left: 18, right: 7, operator: '+', missing: 'left' },
  { left: 12, right: 6, operator: '+', missing: 'right' },
  { left: 18, right: 9, operator: '+', missing: 'left' },
  { left: 15, right: 7, operator: '+', missing: 'right' },
  { left: 20, right: 6, operator: '+', missing: 'left' },
  { left: 30, right: 6, operator: '−', missing: 'right' },
  { left: 27, right: 7, operator: '−', missing: 'right' },
  { left: 22, right: 7, operator: '−', missing: 'right' },
  { left: 19, right: 9, operator: '−', missing: 'right' },
  { left: 26, right: 5, operator: '−', missing: 'left' },
];

export const WORKSHEET_PROBLEMS = [...FIRST_ROUND, ...EXTRA_PROBLEMS];

export function newRound(): Problem[] {
  const problems = [...WORKSHEET_PROBLEMS];
  for (let i = problems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [problems[i], problems[j]] = [problems[j], problems[i]];
  }
  return problems.slice(0, 8);
}
