import type { ComparisonSkill } from './comparison';

/** A rule the child can use after a wrong pick. None of them ever names a worked-out value. */
export type RuleHint =
  | 'ruleBigger'
  | 'ruleCountUp'
  | 'ruleTens'
  | 'ruleWorkOut'
  | 'ruleTimes'
  | 'ruleHalf'
  | 'ruleShare';

/**
 * Which rule Kiki shows after the child's `attempts`-th wrong pick on a snack. It depends only on
 * the level and on whether the snack has sums in it, never on the right answer, so the hint
 * cannot give away whether the sides are equal. The first try reminds the child of the step that
 * comes first; the second offers a different way to see it.
 */
export function ruleHint(skill: ComparisonSkill, needsMaths: boolean, attempts: number): RuleHint {
  const times = skill === 'times' || skill === 'times100' || skill === 'easyTimes';
  const small = skill === 'numbers10' || skill === 'numbers20';
  const rules: readonly RuleHint[] = needsMaths
    ? skill === 'halves'
      ? ['ruleHalf', 'ruleBigger']
      : skill === 'share'
        ? ['ruleShare', 'ruleBigger']
        : skill === 'timesOrShare'
          ? ['ruleShare', 'ruleTimes', 'ruleBigger']
          : [times ? 'ruleTimes' : 'ruleWorkOut', 'ruleBigger']
    : small
      ? ['ruleBigger', 'ruleCountUp']
      : ['ruleBigger', 'ruleTens'];
  return rules[Math.max(0, attempts - 1) % rules.length]!;
}
