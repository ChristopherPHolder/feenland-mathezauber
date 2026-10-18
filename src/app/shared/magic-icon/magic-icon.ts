import { Component, input } from '@angular/core';
export type MagicMotif = 'heart' | 'flower' | 'leaf' | 'gem' | 'star' | 'arrow';
@Component({
  selector: 'app-magic-icon',
  host: { 'aria-hidden': 'true' },
  template: `<svg viewBox="0 0 48 48" fill="none">
    @switch (kind()) {
      @case ('heart') {
        <path
          d="M24 41S5 30 5 17C5 5 20 3 24 14 28 3 43 5 43 17c0 13-19 24-19 24Z"
          fill="currentColor"
        />
      }
      @case ('flower') {
        <path
          d="M24 7c10-13 20 1 13 9 16 3 11 20 0 20-2 15-21 14-23 0C0 35-3 19 12 16 6 5 18-4 24 7Z"
          fill="currentColor"
        />
        <circle cx="24" cy="23" r="7" fill="#fff5cf" />
      }
      @case ('leaf') {
        <path d="M39 7C13 5 3 17 10 31 23 44 40 30 39 7Z" fill="currentColor" />
        <path
          d="m10 40 20-21m-11 12-1-10m7 4 8 1"
          stroke="#fff5cf"
          stroke-width="3"
          stroke-linecap="round"
        />
      }
      @case ('gem') {
        <path d="m13 7-9 13 20 23 20-23-9-13H13Z" fill="currentColor" />
        <path
          d="m4 20 40 0M13 7l11 36L35 7"
          stroke="#fff5cf"
          stroke-width="2"
          stroke-linejoin="round"
        />
      }
      @case ('arrow') {
        <path
          d="M7 24h33m-13-13 13 13-13 13"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      }
      @default {
        <path d="m24 3 6 13 15 2-11 10 3 16-13-8-13 8 3-16L3 18l15-2L24 3Z" fill="currentColor" />
      }
    }
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      width: 1em;
      height: 1em;
      flex-shrink: 0;
      vertical-align: middle;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class MagicIcon {
  readonly kind = input<MagicMotif>('star');
}
