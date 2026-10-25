import { emptyProgress, levelState, nextLevel, parseProgress, World, worlds } from './catalog';
import { detectLocale } from './locale';
const everyLevel = worlds.flatMap((world) => world.chapters).flatMap((chapter) => chapter.levels);
describe('expanding-world foundations', () => {
  it('recommends the first available level for a new player', () => {
    expect(nextLevel(worlds, emptyProgress)?.id).toBe('defend-fairy-castle');
  });
  it('keeps achievements when a caught-up catalog grows', () => {
    const progress = {
      version: 1 as const,
      mastered: everyLevel.map((level) => level.id),
      chapters: ['friends-of-ten'],
      explored: ['numbers'],
    };
    expect(nextLevel(worlds, progress)).toBeUndefined();
    const catalog: readonly World[] = [
      ...worlds,
      {
        ...worlds[0],
        id: 'new-world',
        chapters: [
          {
            id: 'new-chapter',
            title: 'numberWalls',
            description: 'numberWallDescription',
            levels: [
              {
                id: 'new-level',
                title: 'numberWall',
                description: 'numberWallDescription',
                prerequisites: progress.mastered,
                skills: [],
                format: 'number-wall',
              },
            ],
          },
        ],
      },
    ];
    expect(nextLevel(catalog, progress)?.id).toBe('new-level');
    expect(parseProgress(progress)).toEqual(progress);
  });
  it('distinguishes prerequisite-gated and replayable content', () => {
    const level = everyLevel[0];
    expect(levelState(level, emptyProgress)).toBe('available');
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
