import { MessageKey } from './messages';
export interface Level {
  readonly id: string;
  readonly title: MessageKey;
  readonly implemented: boolean;
  readonly prerequisites: readonly string[];
  readonly skills: readonly string[];
  readonly format: string;
}
export interface Chapter {
  readonly id: string;
  readonly levels: readonly Level[];
}
export interface World {
  readonly id: string;
  readonly title: MessageKey;
  readonly chapters: readonly Chapter[];
}
export const worlds: readonly World[] = [
  {
    id: 'missing-number',
    title: 'missing',
    chapters: [
      {
        id: 'missing-number-first-steps',
        levels: [
          {
            id: 'missing-number-add-to-30',
            title: 'level',
            implemented: true,
            prerequisites: [],
            skills: ['missing-addend', 'make-ten'],
            format: 'challenge-preview',
          },
        ],
      },
    ],
  },
  ...(['numbers', 'tens', 'subtraction', 'big', 'master'] as const).map((title) => ({
    id: title,
    title,
    chapters: [],
  })),
];
export interface Progress {
  readonly version: 1;
  readonly mastered: readonly string[];
  readonly chapters: readonly string[];
  readonly explored: readonly string[];
}
export const emptyProgress: Progress = { version: 1, mastered: [], chapters: [], explored: [] };
export function levelState(
  level: Level,
  progress: Progress,
): 'soon' | 'locked' | 'available' | 'completed' {
  if (!level.implemented) return 'soon';
  if (progress.mastered.includes(level.id)) return 'completed';
  return level.prerequisites.every((id) => progress.mastered.includes(id)) ? 'available' : 'locked';
}
export function nextLevel(catalog: readonly World[], progress: Progress): Level | undefined {
  return catalog
    .flatMap((world) => world.chapters)
    .flatMap((chapter) => chapter.levels)
    .find((level) => levelState(level, progress) === 'available');
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
  return {
    version: 1,
    mastered: strings('mastered'),
    chapters: strings('chapters'),
    explored: strings('explored'),
  };
}
