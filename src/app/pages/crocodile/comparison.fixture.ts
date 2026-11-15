import type { Side } from './comparison';
/**
 * Evaluates a rendered side such as "7 + 6", "19 − 8", "4 × 5", "30 ÷ 5" or "½ of 16" so tests
 * can derive the sign.
 */
export function evaluate(side: Side): number {
  if (side.text.startsWith('½ of ')) return Number(side.text.slice('½ of '.length)) / 2;
  const [a, operator, b] = side.text.split(' ');
  if (!operator) return Number(a);
  if (operator === '×') return Number(a) * Number(b);
  if (operator === '÷') return Number(a) / Number(b);
  return operator === '+' ? Number(a) + Number(b) : Number(a) - Number(b);
}
