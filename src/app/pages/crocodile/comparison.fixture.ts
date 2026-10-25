import type { Side } from './comparison';
/** Evaluates a rendered side such as "7 + 6" or "19 − 8" so tests can derive the expected sign. */
export function evaluate(side: Side): number {
  const [a, operator, b] = side.text.split(' ');
  if (!operator) return Number(a);
  return operator === '+' ? Number(a) + Number(b) : Number(a) - Number(b);
}
