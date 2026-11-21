import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CoachDialog } from './coach-dialog';

@Component({
  imports: [CoachDialog],
  template: `<ui-coach-dialog
    heading="How to play"
    doneLabel="Got it!"
    (done)="closed = closed + 1"
  >
    <p class="film">A film</p>
  </ui-coach-dialog>`,
})
class Host {
  closed = 0;
}

describe('CoachDialog', () => {
  it('shows the projected film under its heading, labelled by it', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    const heading = dialog.querySelector('h2')!;
    expect(heading.textContent).toContain('How to play');
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(dialog.querySelector('.film')).not.toBeNull();
  });

  it('closes from its button and from Escape', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    dialog.querySelector<HTMLButtonElement>('button')!.click();
    const escape = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.closed).toBe(2);
  });
});
