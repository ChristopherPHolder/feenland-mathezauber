import { TestBed } from '@angular/core/testing';
import { ProgressService } from './progress';
import { emptyProgress, parseProgress } from './catalog';
describe('Recoverable device progress', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });
  it('preserves corrupt and unsupported originals before writing a current save', () => {
    for (const original of [
      '',
      'broken',
      JSON.stringify({ version: 2, mastered: ['future-earned'], extra: 'preserve' }),
    ]) {
      localStorage.setItem('feenland.progress', original);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const p = TestBed.inject(ProgressService);
      p.explore('missing-number');
      expect(localStorage.getItem('feenland.progress.recovery')).toBe(original);
      expect(JSON.parse(localStorage.getItem('feenland.progress')!).version).toBe(1);
    }
  });
  it('never overwrites an original when its recovery backup fails', () => {
    const original = JSON.stringify({ version: 2, mastered: ['keep'] });
    localStorage.setItem('feenland.progress', original);
    const p = TestBed.inject(ProgressService);
    const originalSet = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key.endsWith('.recovery')) throw Error('storage full');
      originalSet.call(this, key, value);
    });
    p.explore('missing-number');
    expect(localStorage.getItem('feenland.progress')).toBe(original);
    expect(p.progress().explored).toEqual(['missing-number']);
    expect(p.saveFailed()).toBe(true);
    spy.mockRestore();
  });
  it('loads optional completion and earned-star fields without dropping unknown IDs', () => {
    expect(
      parseProgress({
        ...emptyProgress,
        completed: ['retired', 'retired', 1],
        stars: { retired: 3, bad: 4, negative: -1 },
      }),
    ).toEqual({ ...emptyProgress, completed: ['retired'], stars: { retired: 3 } });
  });
});
