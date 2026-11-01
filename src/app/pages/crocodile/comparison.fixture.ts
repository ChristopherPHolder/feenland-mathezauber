import type { Side } from './comparison';
/** Evaluates a rendered side such as "7 + 6", "19 − 8" or "4 × 5" so tests can derive the sign. */
export function evaluate(side: Side): number {
  const [a, operator, b] = side.text.split(' ');
  if (!operator) return Number(a);
  if (operator === '×') return Number(a) * Number(b);
  return operator === '+' ? Number(a) + Number(b) : Number(a) - Number(b);
}
