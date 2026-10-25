import { findLevel, levelState, Progress, World } from './catalog';
export interface LevelResult {
  readonly levelId: string;
  readonly completed: true;
  readonly mastered: boolean;
  readonly stars?: number;
}
export function isLevelResult(value: unknown): value is LevelResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result['levelId'] === 'string' &&
    result['completed'] === true &&
    typeof result['mastered'] === 'boolean' &&
    (result['stars'] === undefined ||
      (typeof result['stars'] === 'number' &&
        Number.isInteger(result['stars']) &&
        result['stars'] >= 0 &&
        result['stars'] <= 3))
  );
}
/** Only a game's explicit result can record progress; URLs never produce results. */
export function applyResult(
  catalog: readonly World[],
  progress: Progress,
  result: LevelResult,
): Progress | undefined {
  if (!isLevelResult(result)) return undefined;
  const context = findLevel(catalog, result.levelId);
  if (
    !context ||
    context.level.playtest ||
    !['available', 'completed'].includes(levelState(context.level, progress))
  )
    return undefined;
  const mastered = result.mastered
    ? [...new Set([...progress.mastered, result.levelId])]
    : progress.mastered;
  const earned = context.chapter.levels.every((level) => mastered.includes(level.id));
  return {
    ...progress,
    completed: [...new Set([...(progress.completed ?? []), result.levelId])],
    mastered,
    chapters: earned ? [...new Set([...progress.chapters, context.chapter.id])] : progress.chapters,
    explored: [...new Set([...progress.explored, context.world.id])],
    ...(result.stars !== undefined
      ? {
          stars: {
            ...progress.stars,
            [result.levelId]: Math.max(progress.stars?.[result.levelId] ?? 0, result.stars),
          },
        }
      : {}),
  };
}
