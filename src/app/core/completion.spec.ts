import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from '../app.routes';
import { emptyProgress, nextLevel, World, worlds } from './catalog';
import { ProgressService } from './progress';
import { CompletionService } from './completion';
import { applyResult, LevelResult } from './results';
import { LocaleService } from './locale';
import { navigate, openRoute } from '../testing/route-harness';
const wall = 'number-wall';
const earned: LevelResult = { levelId: wall, completed: true, mastered: true, stars: 2 };
describe('Explicit learning results', () => {
  it('keeps completion, mastery and earned stars distinct, and keeps best rewards on replay', () => {
    const completed = applyResult(worlds, emptyProgress, { ...earned, mastered: false })!;
    expect(completed.completed).toEqual([wall]);
    expect(completed.mastered).toEqual([]);
    expect(completed.chapters).toEqual([]);
    expect(nextLevel(worlds, completed)?.id).toBe('defend-fairy-castle');
    const mastered = applyResult(worlds, completed, earned)!;
    expect(mastered.chapters).toEqual(['number-walls']);
    expect(mastered.explored).toEqual(['tens']);
    const replay = applyResult(worlds, mastered, { ...earned, stars: 0, mastered: false })!;
    expect(replay.stars?.[wall]).toBe(2);
    expect(replay.mastered).toEqual([wall]);
    expect(replay.chapters).toEqual(mastered.chapters);
  });
  it('rejects unknown, playtest and malformed results', () => {
    const tens = worlds.find((world) => world.id === 'tens')!;
    const playtest: readonly World[] = [
      {
        ...tens,
        chapters: tens.chapters.map((chapter) => ({
          ...chapter,
          levels: chapter.levels.map((level) => ({ ...level, playtest: true })),
        })),
      },
    ];
    expect(applyResult(playtest, emptyProgress, earned)).toBeUndefined();
    for (const result of [
      { ...earned, levelId: 'unknown' },
      { ...earned, stars: 4 },
      { ...earned, stars: NaN },
    ]) {
      expect(applyResult(worlds, emptyProgress, result)).toBeUndefined();
    }
  });
});
describe('Completion flow', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  it('celebrates a recorded result and recommends the next open adventure', async () => {
    const h = await openRoute('/');
    expect(TestBed.inject(CompletionService).finish(earned)).toBe(true);
    await navigate(h, '/complete/' + wall);
    expect(TestBed.inject(Router).url).toBe('/complete/' + wall);
    const i = TestBed.inject(LocaleService);
    expect(h.routeNativeElement?.textContent).toContain(i.t('wellDone'));
    expect(h.routeNativeElement?.textContent).toContain(i.t('chapterAward'));
    expect(
      h.routeNativeElement?.querySelector('a[href="/adventure/defend-fairy-castle"]'),
    ).toBeTruthy();
    expect(h.routeNativeElement?.querySelector(`a[href="/games#${wall}"]`)).toBeTruthy();
    // The way on names the next level, and the stars are drawn: two of three earned.
    expect(h.routeNativeElement?.querySelector('.next')?.textContent).toContain(i.t('fairyCastle'));
    expect(h.routeNativeElement?.querySelectorAll('.stars .star.earned').length).toBe(2);
    expect(h.routeNativeElement?.querySelector('.game-name')?.textContent).toContain(
      i.t('numberWalls'),
    );
    expect(h.routeNativeElement?.querySelector(`a[href="/adventure/${wall}"]`)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('feenland.progress')!).mastered).toEqual([wall]);
  });
  it('does not award from completion URLs and restores only a receipt for recorded progress', async () => {
    const h = await openRoute('/complete/' + wall);
    expect(TestBed.inject(Router).url).toBe('/games');
    const c = TestBed.inject(CompletionService);
    expect(c.finish(earned)).toBe(true);
    await navigate(h, '/complete/' + wall);
    expect(h.routeNativeElement?.querySelector('.stars')?.getAttribute('aria-label')).toBe(
      TestBed.inject(LocaleService).t('starsOf', { n: 2 }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const restored = await openRoute('/complete/' + wall);
    expect(restored.routeNativeElement?.querySelector('h1')?.textContent).toBe(
      TestBed.inject(LocaleService).t('wellDone'),
    );
    expect(TestBed.inject(ProgressService).progress().stars?.[wall]).toBe(2);
  });
  it('continues in memory if storage is unavailable', () => {
    const p = TestBed.inject(ProgressService);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(TestBed.inject(CompletionService).finish(earned)).toBe(true);
    expect(p.progress().mastered).toEqual([wall]);
    expect(p.saveFailed()).toBe(true);
    spy.mockRestore();
  });
});
