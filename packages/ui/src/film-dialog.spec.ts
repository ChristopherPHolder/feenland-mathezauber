import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FilmDialog } from './film-dialog';

@Component({
  imports: [FilmDialog],
  template: `<ui-film-dialog heading="How to play" go="Got it!" (done)="closed.set(closed() + 1)">
    <p class="film">A film</p>
  </ui-film-dialog>`,
})
class Host {
  readonly closed = signal(0);
}

describe('FilmDialog', () => {
  it('shows the projected film under its heading and closes from its button', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('h2')!.textContent).toBe('How to play');
    expect(page.querySelector('dialog .film')).not.toBeNull();
    page.querySelector<HTMLButtonElement>('.button.primary')!.click();
    expect(fixture.componentInstance.closed()).toBe(1);
  });

  it('closes on Escape the same way', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(fixture.componentInstance.closed()).toBe(1);
  });
});
