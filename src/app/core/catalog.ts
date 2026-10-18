import { InjectionToken } from '@angular/core';
import { MessageKey } from './messages';
export interface Level {
  readonly description?: MessageKey;
  readonly id: string;
  readonly title: MessageKey;
  readonly implemented: boolean;
  readonly prerequisites: readonly string[];
  readonly skills: readonly string[];
  readonly format: string;
}
export interface Chapter {
  readonly title?: MessageKey;
  readonly description?: MessageKey;
  readonly id: string;
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
export const worlds: readonly World[] = [
  {
    id: 'missing-number',
    title: 'missing',
    description: 'missingPreview',
    emblem: '?',
    color: '#75512c',
    ground: '#fff1cb',
    chapters: [
      {
        id: 'missing-number-first-steps',
        title: 'firstSteps',
        description: 'firstStepsDescription',
        levels: [
          {
            id: 'missing-number-add-to-30',
            title: 'level',
            implemented: true,
            prerequisites: [],
            skills: ['missing-addend', 'make-ten'],
            format: 'challenge-preview',
          },
          {
            id: 'missing-number-subtract-to-30',
            title: 'subtractLevel',
            description: 'subtractDescription',
            implemented: true,
            prerequisites: ['missing-number-add-to-30'],
            skills: ['missing-subtrahend'],
            format: 'challenge-preview',
          },
          {
            id: 'missing-number-make-ten',
            title: 'makeTenLevel',
            description: 'makeTenDescription',
            implemented: false,
            prerequisites: ['missing-number-add-to-30'],
            skills: ['make-ten'],
            format: 'challenge-preview',
          },
        ],
      },
      {
        id: 'missing-number-backwards',
        title: 'backwards',
        description: 'backwardsDescription',
        levels: [
          {
            id: 'missing-number-inverse',
            title: 'inverseLevel',
            implemented: false,
            prerequisites: ['missing-number-add-to-30'],
            skills: ['inverse-operation'],
            format: 'challenge-preview',
          },
        ],
      },
    ],
  },
  ...(
    [
      ['numbers', 'numbersPreview', '1 2 3', '#28604b', '#dfefe3'],
      ['tens', 'tensPreview', '10', '#315d84', '#dfeefa'],
      ['subtraction', 'subtractionPreview', '−', '#78476a', '#f3e3ef'],
      ['big', 'bigPreview', '100', '#87502c', '#f9e5d4'],
      ['master', 'masterPreview', '∞', '#50467b', '#e9e4f6'],
    ] as const
  ).map(([title, description, emblem, color, ground]) => ({
    id: title,
    title,
    description,
    emblem,
    color,
    ground,
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

/** Injectable so catalog extensions and state scenarios use the same navigation code. */
export const WORLD_CATALOG = new InjectionToken<readonly World[]>('World catalog', {
  providedIn: 'root',
  factory: () => worlds,
});
export type ContentState = ReturnType<typeof levelState>;
export function worldState(world: World, progress: Progress): ContentState {
  return contentState(
    world.chapters.flatMap((chapter) => chapter.levels),
    progress,
  );
}
export function chapterState(chapter: Chapter, progress: Progress): ContentState {
  return contentState(chapter.levels, progress);
}
function contentState(levels: readonly Level[], progress: Progress): ContentState {
  const published = levels.filter((level) => level.implemented);
  if (!published.length) return 'soon';
  const states = published.map((level) => levelState(level, progress));
  if (states.every((state) => state === 'completed')) return 'completed';
  // An earned level remains a way back into a world even when its new levels are locked.
  if (states.some((state) => state === 'available' || state === 'completed')) return 'available';
  return 'locked';
}
export function worldRequirements(world: World, progress: Progress) {
  return world.chapters
    .flatMap((chapter) => chapter.levels)
    .filter((level) => levelState(level, progress) === 'locked')
    .map((level) => ({
      level,
      prerequisites: [
        ...new Set(level.prerequisites.filter((id) => !progress.mastered.includes(id))),
      ],
    }));
}

export function findLevel(catalog: readonly World[], id: string | null) {
  for (const world of catalog)
    for (const chapter of world.chapters) {
      const level = chapter.levels.find((level) => level.id === id);
      if (level) return { world, chapter, level };
    }
  return undefined;
}
export function findChapter(
  catalog: readonly World[],
  worldId: string | null,
  chapterId: string | null,
) {
  const world = catalog.find((world) => world.id === worldId);
  const chapter = world?.chapters.find((chapter) => chapter.id === chapterId);
  return world && chapter ? { world, chapter } : undefined;
}
