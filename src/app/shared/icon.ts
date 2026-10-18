import { Component, input } from '@angular/core';
@Component({
  selector: 'app-icon',
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path [attr.d]="paths[kind()]" />
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      width: 1.6em;
      height: 1.6em;
      flex: none;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class Icon {
  readonly kind = input<
    'check' | 'star' | 'book' | 'cup' | 'gem' | 'gear' | 'arrow' | 'back' | 'lock'
  >('star');
  protected readonly paths = {
    check: 'm5 12 4 4 10-10',
    star: 'm12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
    book: 'M12 5v16M3 3l9 2 9-2v16l-9 2-9-2z',
    cup: 'M7 3h10v7a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 3v6m-4 0h8',
    gem: 'm7 3-5 7 10 12 10-12-5-7zM2 10h20M7 3l5 19 5-19',
    gear: 'm9 3 .5-1h5L15 5l3 2 3 .5v5L19 14l-2 3-.5 3h-5L10 18l-3-2-3-.5v-5L6 9l2-3zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    arrow: 'm9 5 7 7-7 7',
    back: 'M20 12H4m7-7-7 7 7 7',
    lock: 'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4',
  };
}
