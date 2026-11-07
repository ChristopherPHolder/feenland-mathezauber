import { InjectionToken } from '@angular/core';
import { practiceLevels, PracticeConfig } from './practice';
import { comparisonLevels } from '../pages/crocodile/comparison';
import { raceLevelEntries } from '../pages/unicorn-race/race-questions';
import { MessageKey } from './messages';
export interface Level {
  readonly practice?: PracticeConfig;
  readonly description: MessageKey;
  readonly id: string;
  readonly title: MessageKey;
  readonly skills: readonly string[];
  readonly format: string;
  readonly playtest?: boolean;
}
/** A chapter is one game: its levels are the game's selectable levels. */
export interface Chapter {
  readonly title: MessageKey;
  readonly description: MessageKey;
  readonly id: string;
  readonly emblem: string;
  readonly levels: readonly Level[];
}
export interface World {
  readonly id: string;
  readonly title: MessageKey;
  readonly chapters: readonly Chapter[];
  readonly description: MessageKey;
  readonly emblem: string;
  readonly color: string;
  readonly ground: string;
}
// World, chapter and level IDs are part of saved progress and bookmarks; keep them stable.
export const worlds: readonly World[] = [
  {
    id: 'numbers',
    title: 'numbers',
    description: 'numbersPreview',
    emblem: '🌱',
    color: '#28604b',
    ground: '#dfefe3',
    chapters: [
      {
        id: 'friends-of-ten',
        title: 'fairyCastle',
        description: 'fairyGameDescription',
        emblem: '🏰',
        levels: [
          {
            id: 'defend-fairy-castle',
            title: 'fairyCastle',
            description: 'fairyBattleDescription',
            skills: ['make-ten'],
            format: 'fairy-defense',
          },
          // The path to 30 stages are castle battles with their own question sets.
          ...practiceLevels,
        ],
      },
      {
        id: 'compare-crocodile',
        title: 'crocodileChapter',
        description: 'crocodileChapterHelp',
        emblem: '🐊',
        levels: comparisonLevels,
      },
    ],
  },
  {
    id: 'tens',
    title: 'tens',
    description: 'tensPreview',
    emblem: '✨',
    color: '#315d84',
    ground: '#dfeefa',
    chapters: [
      {
        id: 'number-walls',
        title: 'numberWalls',
        description: 'numberWallDescription',
        emblem: '🧱',
        levels: [
          {
            id: 'number-wall',
            title: 'numberWall',
            description: 'numberWallDescription',
            skills: ['addition', 'missing-addend'],
            format: 'number-wall',
          },
        ],
      },
      {
        id: 'unicorn-race',
        title: 'raceChapter',
        description: 'raceChapterHelp',
        emblem: '🦄',
        levels: raceLevelEntries,
      },
    ],
  },
];
export interface Progress {
  readonly completed?: readonly string[];
  readonly stars?: Readonly<Record<string, number>>;
  readonly version: 1;
  readonly mastered: readonly string[];
  readonly chapters: readonly string[];
  readonly explored: readonly string[];
}
export const emptyProgress: Progress = { version: 1, mastered: [], chapters: [], explored: [] };
/**
 * Every level is open from the first visit. A level is `completed` once a result was
 * recorded for it; nothing is ever locked, so the only other state is `open`.
 */
export type ContentState = 'open' | 'completed';
export function levelState(level: Level, progress: Progress): ContentState {
  return progress.mastered.includes(level.id) || progress.completed?.includes(level.id)
    ? 'completed'
    : 'open';
}
/** Best stars recorded for a level, 0 when it has never been played. */
export function levelStars(level: Level, progress: Progress): number {
  return progress.stars?.[level.id] ?? 0;
}
/** The recommendation: the first unplayed level, else the first played level not yet mastered. */
export function nextLevel(catalog: readonly World[], progress: Progress): Level | undefined {
  const levels = catalog
    .flatMap((world) => world.chapters)
    .flatMap((chapter) => chapter.levels)
    .filter((level) => !level.playtest);
  return (
    levels.find((level) => levelState(level, progress) === 'open') ??
    levels.find((level) => !progress.mastered.includes(level.id))
  );
}
/** The level a game's Play button opens: its first unmastered level, else its first level. */
export function entryLevel(chapter: Chapter, progress: Progress): Level | undefined {
  return chapter.levels.find((level) => !progress.mastered.includes(level.id)) ?? chapter.levels[0];
}
export function parseProgress(value: unknown): Progress {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1)
    return emptyProgress;
  const strings = (key: string): string[] =>
    key in value && Array.isArray((value as Record<string, unknown>)[key])
      ? [
          ...new Set(
            ((value as Record<string, unknown>)[key] as unknown[]).filter(
              (id): id is string => typeof id === 'string',
            ),
          ),
        ]
      : [];
  const rawStars = 'stars' in value ? value.stars : undefined;
  const stars =
    rawStars && typeof rawStars === 'object' && !Array.isArray(rawStars)
      ? Object.fromEntries(
          Object.entries(rawStars).filter(
            ([, score]) =>
              typeof score === 'number' && Number.isInteger(score) && score >= 0 && score <= 3,
          ),
        )
      : {};
  return {
    version: 1,
    ...('completed' in value ? { completed: strings('completed') } : {}),
    ...('stars' in value ? { stars } : {}),
    mastered: strings('mastered'),
    chapters: strings('chapters'),
    explored: strings('explored'),
  };
}

/** Injectable so catalog extensions and state scenarios use the same navigation code. */
export const WORLD_CATALOG = new InjectionToken<readonly World[]>('World catalog', {
  providedIn: 'root',
  factory: () => worlds,
});
export function findLevel(catalog: readonly World[], id: string | null) {
  for (const world of catalog)
    for (const chapter of world.chapters) {
      const level = chapter.levels.find((level) => level.id === id);
      if (level) return { world, chapter, level };
    }
  return undefined;
}
