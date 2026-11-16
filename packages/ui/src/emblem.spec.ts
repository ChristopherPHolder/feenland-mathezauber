import { TestBed } from '@angular/core/testing';
import { Emblem } from './emblem';
function render(id: string, fallback = '') {
  const fixture = TestBed.createComponent(Emblem);
  fixture.componentRef.setInput('id', id);
  fixture.componentRef.setInput('fallback', fallback);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
describe('Emblem', () => {
  it('draws a known game as a decorative picture', () => {
    const el = render('compare-crocodile', '🐊');
    expect(el.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(el.textContent?.trim()).toBe('');
  });
  it('falls back to the emoji for a game without a drawing', () => {
    const el = render('a-new-game', '🧪');
    expect(el.querySelector('svg')).toBeNull();
    expect(el.textContent?.trim()).toBe('🧪');
    expect(el.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
