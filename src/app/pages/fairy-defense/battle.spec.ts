import { advance, Battle, cast, freshBattle, resolveSpell } from './battle';
import { applyResult } from '../../core/results';
import { emptyProgress, worlds } from '../../core/catalog';
function answer(state: Battle, spell: number) {
  return advance(resolveSpell(cast(state, spell)));
}
describe('Wave 1 battle rules', () => {
  it('teaches 9 then 8, preserves hearts between monsters, and restores them on completion', () => {
    let state = answer(freshBattle(), 5);
    state = answer(state, 5);
    state = answer(state, 5);
    expect(state.hearts).toBe(2);
    expect(state.mistakes).toBe(0);
    state = answer(state, 1);
    expect(state.encounter).toBe(1);
    expect(state.hearts).toBe(2);
    state = answer(state, 2);
    expect(state.phase).toBe('complete');
    expect(state.hearts).toBe(3);
    expect(cast(state, 1)).toBe(state);
  });
  it('keeps the same number and moves closer on mistakes; every third mistake costs exactly one heart', () => {
    let state = freshBattle();
    for (let wrong = 1; wrong <= 8; wrong++) {
      state = answer(state, 4);
      expect(state.encounter).toBe(0);
      expect(state.hearts).toBe(3 - Math.floor(wrong / 3));
      expect(state.mistakes).toBe(wrong % 3);
    }
    state = answer(state, 4);
    expect(state.phase).toBe('lost');
    expect(state.hearts).toBe(0);
    expect(cast(state, 1)).toBe(state);
    expect(advance(state)).toBe(state);
    expect(freshBattle()).toMatchObject({
      encounter: 0,
      hearts: 3,
      mistakes: 0,
      phase: 'ready',
      spell: null,
      damaged: false,
    });
  });
  it('locks input through cast, feedback, and transformation', () => {
    const casting = cast(freshBattle(), 1);
    expect(cast(casting, 5)).toBe(casting);
    const transforming = resolveSpell(casting);
    expect(cast(transforming, 5)).toBe(transforming);
    expect(resolveSpell(transforming)).toBe(transforming);
    const wrong = resolveSpell(cast(freshBattle(), 5));
    expect(cast(wrong, 1)).toBe(wrong);
    for (const invalid of [0, 6, -1, 1.5, NaN]) {
      const state = freshBattle();
      expect(cast(state, invalid)).toBe(state);
    }
  });
  it('rejects playtest learning rewards even if a result is submitted directly', () => {
    expect(
      applyResult(
        worlds.map((world) => ({
          ...world,
          chapters: world.chapters.map((chapter) => ({
            ...chapter,
            levels: chapter.levels.map((level) => ({ ...level, playtest: true })),
          })),
        })),
        emptyProgress,
        {
          levelId: 'defend-fairy-castle',
          completed: true,
          mastered: true,
          stars: 3,
        },
      ),
    ).toBeUndefined();
  });
});
