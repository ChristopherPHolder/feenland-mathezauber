import type { Progress } from '../../core/catalog';
import { ComparisonStage, comparisonStages, ROUND_LENGTH } from './comparison';
import type { CrocodileMessageKey } from './crocodile-messages';
export type SnackKind = 'plain' | 'golden' | 'boss';
export type HatId = 'party' | 'crown' | 'pirate' | 'wizard' | 'flower' | 'gold';
export interface Hat {
  readonly id: HatId;
  readonly stage: number;
  readonly name: CrocodileMessageKey;
}
/** One hat per level; two stars in that level put it in Kiki’s wardrobe for good. */
export const hats: readonly Hat[] = [
  { id: 'party', stage: 1, name: 'hatParty' },
  { id: 'crown', stage: 2, name: 'hatCrown' },
  { id: 'pirate', stage: 3, name: 'hatPirate' },
  { id: 'wizard', stage: 4, name: 'hatWizard' },
  { id: 'flower', stage: 5, name: 'hatFlower' },
  { id: 'gold', stage: 6, name: 'hatGold' },
];
export const GOLDEN_SNACKS = 2;
const basePoints: Record<SnackKind, number> = { plain: 10, golden: 30, boss: 50 };
/** Three first-try answers in a row double the points, six triple them: a feeding frenzy. */
export function comboFor(streak: number): 1 | 2 | 3 {
  return streak >= 6 ? 3 : streak >= 3 ? 2 : 1;
}
export function snackPoints(kind: SnackKind, streak: number): number {
  return basePoints[kind] * comboFor(streak);
}
/** Which snacks shine gold: never the first one, never the big fish at the end. */
export function goldenSnacks(random: () => number = Math.random): ReadonlySet<number> {
  const candidates = Array.from({ length: ROUND_LENGTH - 2 }, (_, index) => index + 1);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  return new Set(candidates.slice(0, GOLDEN_SNACKS));
}
export function snackKind(index: number, golden: ReadonlySet<number>): SnackKind {
  return index === ROUND_LENGTH - 1 ? 'boss' : golden.has(index) ? 'golden' : 'plain';
}
/** The best possible round: every snack first try, so the combo climbs as fast as it can. */
export function perfectScore(golden: ReadonlySet<number>): number {
  let total = 0;
  for (let index = 0; index < ROUND_LENGTH; index++)
    total += snackPoints(snackKind(index, golden), index + 1);
  return total;
}
export function earnedHats(progress: Progress): readonly Hat[] {
  return hats.filter(
    (hat) =>
      comparisonStages.some((stage) => stage.stage === hat.stage) &&
      (progress.stars?.[`crocodile-${hat.stage}`] ?? 0) >= 2,
  );
}
export function parseBestScores(value: unknown): Readonly<Record<string, number>> {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1)
    return {};
  const raw = (value as { best?: unknown }).best;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter(
      ([id, score]) =>
        /^crocodile-\d$/.test(id) &&
        typeof score === 'number' &&
        Number.isInteger(score) &&
        score >= 0,
    ),
  ) as Record<string, number>;
}
export type PlayMode = 'calm' | 'race';
export function parsePlayMode(value: unknown): PlayMode {
  return value === 'race' ? 'race' : 'calm';
}
/** How long the heron takes to reach a snack: longer when there is maths to do, longer for the big fish. */
export function heronFlight(stage: ComparisonStage | undefined, kind: SnackKind): number {
  const base = {
    numbers20: 7000,
    numbers100: 9000,
    sums: 11000,
    differences: 11000,
    twoSides: 14000,
    mixed: 13000,
  }[stage?.skill ?? 'numbers20'];
  return base + (kind === 'boss' ? 3000 : 0);
}
/** Bonus for feeding Kiki while the heron is still far away: 0 to 20 points in steps of 5. */
export function quickBonus(remaining: number): number {
  return Math.max(0, Math.min(20, Math.round(remaining * 4) * 5));
}
