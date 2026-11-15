import { HALF_OF } from '../../core/practice';
import { GameMessageKey } from './game-messages';

/** A hint names the way to work a question out, using only numbers already on screen. */
export interface RuleHint {
  readonly key: GameMessageKey;
  readonly values: Readonly<Record<string, number>>;
}

const N = String.raw`(\d+)`;
const rules: readonly [RegExp, (x: number, y: number) => RuleHint][] = [
  // 7 + □ = 16, □ + 7 = 16, 16 = 10 + □, 16 = □ + 6: count on from the part to the whole.
  [new RegExp(`^${N} \\+ □ = ${N}$`), (a, c) => ({ key: 'hintCountOn', values: { a, c } })],
  [new RegExp(`^□ \\+ ${N} = ${N}$`), (a, c) => ({ key: 'hintCountOn', values: { a, c } })],
  [new RegExp(`^${N} = ${N} \\+ □$`), (c, a) => ({ key: 'hintCountOn', values: { a, c } })],
  [new RegExp(`^${N} = □ \\+ ${N}$`), (c, a) => ({ key: 'hintCountOn', values: { a, c } })],
  // 16 − □ = 12: the gap between the two, counted up from what is left.
  [new RegExp(`^${N} − □ = ${N}$`), (c, a) => ({ key: 'hintCountOn', values: { a, c } })],
  // □ − 4 = 12: put the part that went away back on.
  [new RegExp(`^□ − ${N} = ${N}$`), (a, c) => ({ key: 'hintAddBack', values: { a, c } })],
  [new RegExp(`^${HALF_OF} ${N} = □$`), (a) => ({ key: 'hintHalf', values: { a } })],
  [new RegExp(`^${HALF_OF} □ = ${N}$`), (a) => ({ key: 'hintDouble', values: { a } })],
  // Times and sharing: skip-count in the step that is shown.
  [new RegExp(`^□ × ${N} = ${N}$`), (a, c) => ({ key: 'hintSkip', values: { a, c } })],
  [new RegExp(`^${N} × □ = ${N}$`), (a, c) => ({ key: 'hintSkip', values: { a, c } })],
  [new RegExp(`^${N} ÷ ${N} = □$`), (c, a) => ({ key: 'hintSkip', values: { a, c } })],
  [new RegExp(`^${N} × ${N} = □$`), (c, a) => ({ key: 'hintJumps', values: { a, c } })],
];

/** The rule for a missing-number question, or null for a shape without one. */
export function ruleHint(question: string): RuleHint | null {
  for (const [pattern, hint] of rules) {
    const match = pattern.exec(question.trim());
    if (!match) continue;
    const found = hint(Number(match[1]), Number(match[2]));
    // 40 = 40 + □: "count on from 40 to 40" would point straight at the answer, so say what
    // the child can see instead: the same number already stands on both sides.
    return found.key === 'hintCountOn' && found.values['a'] === found.values['c']
      ? { key: 'hintBothSides', values: { a: found.values['a'] } }
      : found;
  }
  return null;
}
