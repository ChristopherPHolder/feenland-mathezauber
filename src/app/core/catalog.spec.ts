import { worlds } from './preview-catalog.fixture';
import { emptyProgress, levelState, nextLevel, parseProgress, World } from './catalog';
import { detectLocale } from './locale';
describe('expanding-world foundations', () => {
  it('recommends the first available level for a new player', () => {
    expect(nextLevel(worlds, emptyProgress)?.id).toBe('defend-fairy-castle');
  });
  it('keeps achievements when a caught-up catalog grows', () => {
    const progress = {
      version: 1 as const,
      mastered: [
        'missing-number-add-to-30',
        'missing-number-subtract-to-30',
        'defend-fairy-castle',
      ],
      chapters: ['missing-number-first-steps'],
      explored: ['missing-number'],
    };
    expect(nextLevel(worlds, progress)).toBeUndefined();
    const catalog: readonly World[] = [
      ...worlds,
      {
        ...worlds.find((world) => world.id === 'missing-number')!,
        id: 'new-world',
        title: 'numbers',
        chapters: [
          {
            id: 'new-chapter',
            levels: [
              {
                id: 'new-level',
                title: 'level',
                implemented: true,
                prerequisites: progress.mastered,
                skills: [],
                format: 'preview',
              },
            ],
          },
        ],
      },
    ];
    expect(nextLevel(catalog, progress)?.id).toBe('new-level');
    expect(parseProgress(progress)).toEqual(progress);
  });
  it('distinguishes unavailable, prerequisite-gated and replayable content', () => {
    const level = worlds.find((world) => world.id === 'missing-number')!.chapters[0].levels[0];
    expect(levelState({ ...level, implemented: false }, emptyProgress)).toBe('soon');
    expect(levelState({ ...level, prerequisites: ['other'] }, emptyProgress)).toBe('locked');
    expect(
      levelState(
        { ...level, prerequisites: ['other'] },
        { ...emptyProgress, mastered: [level.id] },
      ),
    ).toBe('completed');
  });
  it('recovers invalid saves and retains unknown earned IDs', () => {
    expect(parseProgress(null)).toEqual(emptyProgress);
    expect(parseProgress({ version: 2 })).toEqual(emptyProgress);
    expect(
      parseProgress({
        version: 1,
        mastered: ['retired', 'retired', 1],
        chapters: null,
        explored: [],
      }),
    ).toEqual({ ...emptyProgress, mastered: ['retired'] });
  });
  it('detects regional language preferences with English fallback', () => {
    expect(detectLocale(['it-IT', 'de-AT', 'fr'])).toBe('de');
    expect(detectLocale(['es-MX'])).toBe('es');
    expect(detectLocale(['ja'])).toBe('en');
  });
});
