import { TestBed } from '@angular/core/testing';
import { WORLD_CATALOG, worlds } from '../core/catalog';
import { Emblem } from './emblem';
function render(id: string, fallback = '') {
  const fixture = TestBed.createComponent(Emblem);
  fixture.componentRef.setInput('id', id);
  fixture.componentRef.setInput('fallback', fallback);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
describe('Emblem', () => {
  it('draws every game and world in the catalog instead of its emoji', () => {
    const catalog = TestBed.inject(WORLD_CATALOG);
    const ids = catalog.flatMap((world) => [world.id, ...world.chapters.map((c) => c.id)]);
    expect(ids.length).toBe(worlds.length + worlds.flatMap((w) => w.chapters).length);
    for (const id of ids) {
      const el = render(id, '❓');
      expect(el.querySelector('svg[aria-hidden="true"]'), id).not.toBeNull();
      expect(el.textContent?.trim(), id).toBe('');
    }
  });
  it('falls back to the catalog emoji for a game without a drawing', () => {
    const el = render('a-new-game', '🧪');
    expect(el.querySelector('svg')).toBeNull();
    expect(el.textContent?.trim()).toBe('🧪');
    expect(el.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
