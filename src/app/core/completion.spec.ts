import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { emptyProgress, nextLevel, worlds } from './catalog';
import { ProgressService } from './progress';
import { CompletionService } from './completion';
import { applyResult, LevelResult } from './results';
import { LocaleService } from './locale';
const first = 'missing-number-add-to-30';
const second = 'missing-number-subtract-to-30';
const earned: LevelResult = {
  levelId: first,
  source: 'practice',
  completed: true,
  mastered: true,
  stars: 2,
};
describe('Explicit learning results', () => {
  it('keeps completion, mastery and earned stars distinct, and keeps best rewards on replay', () => {
    const completed = applyResult(worlds, emptyProgress, { ...earned, mastered: false })!;
    expect(completed.completed).toEqual([first]);
    expect(completed.mastered).toEqual([]);
    expect(completed.chapters).toEqual([]);
    expect(nextLevel(worlds, completed)?.id).toBe('defend-fairy-castle');
    const mastered = applyResult(worlds, completed, earned)!;
    expect(nextLevel(worlds, mastered)?.id).toBe(second);
    const chapter = applyResult(worlds, mastered, { ...earned, levelId: second, stars: 3 })!;
    expect(chapter.chapters).toEqual(['missing-number-first-steps']);
    const replay = applyResult(worlds, chapter, { ...earned, stars: 0, mastered: false })!;
    expect(replay.stars?.[first]).toBe(2);
    expect(replay.mastered).toEqual([first, second]);
    expect(replay.chapters).toEqual(chapter.chapters);
    expect(nextLevel(worlds, replay)?.id).toBe('defend-fairy-castle');
  });
  it('rejects unknown, locked, unpublished and malformed results', () => {
    for (const result of [
      { ...earned, levelId: 'unknown' },
      { ...earned, levelId: second },
      { ...earned, levelId: 'missing-number-make-ten' },
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
  it('saves demo results separately, follows Next and reaches caught-up without real mastery', async () => {
    const h = await RouterTestingHarness.create('/adventure/' + first);
    h.routeNativeElement!.querySelector<HTMLButtonElement>('button')!.click();
    await h.fixture.whenStable();
    h.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/complete/' + first);
    const p = TestBed.inject(ProgressService);
    expect(p.progress().mastered).toEqual([]);
    expect(p.progressFor('demo').mastered).toEqual([first]);
    expect(h.routeNativeElement?.textContent).toContain(
      TestBed.inject(LocaleService).t('demoHelp'),
    );
    expect(
      h.routeNativeElement?.querySelector(`a[href="/adventure/${second}?mode=demo"]`),
    ).toBeTruthy();
    await h.navigateByUrl('/adventure/' + second + '?mode=demo');
    h.routeNativeElement!.querySelector<HTMLButtonElement>('button')!.click();
    await h.fixture.whenStable();
    h.detectChanges();
    expect(h.routeNativeElement?.textContent).toContain(TestBed.inject(LocaleService).t('caught'));
    expect(h.routeNativeElement?.textContent).toContain(
      TestBed.inject(LocaleService).t('demoAward'),
    );
    expect(p.progress().chapters).toEqual([]);
    expect(JSON.parse(localStorage.getItem('feenland.demo-progress')!).mastered).toEqual([
      first,
      second,
    ]);
  });
  it('does not award from completion URLs and restores only a receipt for recorded progress', async () => {
    const h = await RouterTestingHarness.create('/complete/' + first);
    expect(TestBed.inject(Router).url).toBe('/worlds');
    const c = TestBed.inject(CompletionService);
    expect(c.finish(earned)).toBe(true);
    await h.navigateByUrl('/complete/' + first);
    expect(h.routeNativeElement?.textContent).not.toContain(
      TestBed.inject(LocaleService).t('demoHelp'),
    );
    expect(h.routeNativeElement?.textContent).toContain(
      TestBed.inject(LocaleService).t('starsEarned'),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const restored = await RouterTestingHarness.create('/complete/' + first);
    expect(restored.routeNativeElement?.querySelector('h1')?.textContent).toBe(
      TestBed.inject(LocaleService).t('wellDone'),
    );
    expect(TestBed.inject(ProgressService).progress().stars?.[first]).toBe(2);
  });
  it('does not record real exploration when entering an explicit demo route', async () => {
    const p = TestBed.inject(ProgressService);
    expect(TestBed.inject(CompletionService).finish({ ...earned, source: 'demo' })).toBe(true);
    await RouterTestingHarness.create('/adventure/' + second + '?mode=demo');
    expect(p.progress().explored).toEqual([]);
    expect(localStorage.getItem('feenland.progress')).toBeNull();
  });
  it('continues in memory if storage is unavailable', () => {
    const p = TestBed.inject(ProgressService);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(TestBed.inject(CompletionService).finish(earned)).toBe(true);
    expect(p.progress().mastered).toEqual([first]);
    expect(p.saveFailed()).toBe(true);
    spy.mockRestore();
  });
});
