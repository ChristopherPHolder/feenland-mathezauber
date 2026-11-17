import { TestBed } from '@angular/core/testing';
import { DragonFace } from './dragon-face';

function render(form: number) {
  const fixture = TestBed.createComponent(DragonFace);
  fixture.componentRef.setInput('colors', { body: '#5bb860', belly: '#e6f7c8', accent: '#2f7d3a' });
  fixture.componentRef.setInput('form', form);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('DragonFace', () => {
  it('paints a decorative face in the given colours', () => {
    const el = render(0);
    expect(el.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('circle')!.getAttribute('fill')).toBe('#5bb860');
  });

  it('grows a second pair of horns in the final form', () => {
    const horns = (form: number) => render(form).querySelectorAll('path[fill="#2f7d3a"]').length;
    expect(horns(0)).toBe(1);
    expect(horns(1)).toBe(1);
    expect(horns(2)).toBe(2);
  });
});
