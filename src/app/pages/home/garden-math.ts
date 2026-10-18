export type Level = 'little' | 'big';
export interface Order {
  left: number;
  right: number;
  operator: '+' | '−';
}
const LITTLE: readonly Order[] = [
  { left: 3, right: 2, operator: '+' },
  { left: 4, right: 3, operator: '+' },
  { left: 6, right: 2, operator: '−' },
  { left: 5, right: 4, operator: '+' },
  { left: 10, right: 3, operator: '−' },
];
const BIG: readonly Order[] = [
  { left: 8, right: 5, operator: '+' },
  { left: 9, right: 7, operator: '+' },
  { left: 15, right: 6, operator: '−' },
  { left: 7, right: 8, operator: '+' },
  { left: 20, right: 8, operator: '−' },
];
export function orderFor(level: Level, index: number, visit: number): Order {
  const orders = level === 'little' ? LITTLE : BIG;
  return orders[(index + visit) % orders.length];
}
export function total(order: Order): number {
  return order.operator === '+' ? order.left + order.right : order.left - order.right;
}
export function answerChoices(order: Order): number[] {
  const answer = total(order);
  return [answer - 1, answer, answer + 1, answer + 2].sort(
    (a, b) => ((a * 7) % 11) - ((b * 7) % 11),
  );
}
