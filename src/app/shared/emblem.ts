import { Component, input } from '@angular/core';
/**
 * The illustrated emblem of a game (chapter id) or world (world id), drawn in the
 * fairyland palette with ink outlines. Unknown ids show the catalog's emoji `fallback`,
 * so a new game still gets an emblem before it has its own drawing.
 * Sized in em: the emblem is 1.25 times the surrounding font size.
 */
@Component({
  selector: 'app-emblem',
  template: `@switch (id()) {
    @case ('friends-of-ten') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 9V2l7 2.5L32 7" class="gold" />
        <path d="M11 30h12v26H11zM41 30h12v26H41z" fill="#fff4e0" />
        <path d="M9 31 17 13l8 18zM39 31l8-18 8 18z" fill="#e8669a" />
        <path d="M21 27h22v29H21z" class="cream" />
        <path d="M19 28 32 9l13 19z" fill="#f4a0c0" />
        <path d="M27 56v-7a5 5 0 0 1 10 0v7z" fill="#a8674a" />
        <path
          d="M15 41v-3a2 2 0 0 1 4 0v3zM45 41v-3a2 2 0 0 1 4 0v3zM30 39v-3a2 2 0 0 1 4 0v3z"
          fill="#8ec5ee"
        />
        <path d="M6 56h52" />
      </svg>
    }
    @case ('compare-crocodile') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M24 36 58 16v30z" fill="#f4a0c0" />
        <path d="M8 42c-2-8 1-17 9-20l38-11c4-1 6 4 3 6L27 35z" fill="#7cc47f" />
        <path d="m8 42 19-6 31 8c3 1 2 6-1 6H19c-6 0-10-3-11-8z" fill="#7cc47f" />
        <path d="m33 32 3 4 1-6m4-3 3 4 1-6m4-2.5 2.5 4 1.5-6.5" fill="#fff" />
        <path d="m34 38 2-4 2 4.5m4 1.5 2-4 2 4.5m4 1.5 2-4 2 4.5" fill="#fff" />
        <circle cx="19" cy="17" r="7" fill="#7cc47f" />
        <circle cx="19" cy="17" r="4" fill="#fff" />
        <circle cx="20" cy="17" r="2" class="dot" />
        <circle cx="53" cy="13" r="1" class="dot" />
        <circle cx="15" cy="37" r="3" fill="#f4a0c0" stroke="none" opacity=".8" />
        <path d="M13 30c2 0 3 1 4 2m3 12h4" stroke="#3f8f55" />
      </svg>
    }
    @case ('number-walls') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="6" y="37" width="25" height="18" rx="4" fill="#f4a98a" />
        <rect x="33" y="37" width="25" height="18" rx="4" fill="#f4a98a" />
        <rect x="19.5" y="17" width="25" height="18" rx="4" fill="#f6c27a" />
        <path d="M10 42h17m10 0h17M23.5 22h17" stroke="#fff" stroke-opacity=".7" />
        <path d="m53 4 1.6 4.4L59 10l-4.4 1.6L53 16l-1.6-4.4L47 10l4.4-1.6z" class="gold" />
        <path
          d="m11 18 1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z"
          fill="#f4a0c0"
          stroke-width="1.2"
        />
      </svg>
    }
    @case ('unicorn-race') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M40 15c7 2 11 9 11 18m-7-15c6 5 8 12 8 21m-5-13c4 6 5 14 4 22" stroke-width="9" />
        <path d="M40 15c7 2 11 9 11 18" stroke="#e8669a" stroke-width="5" />
        <path d="M44 18c6 5 8 12 8 21" class="gold-line" stroke-width="5" />
        <path d="M47 26c4 6 5 14 4 22" stroke="#8ec5ee" stroke-width="5" />
        <path
          d="M42 58c-1-8-2-14-6-19l-18 3c-6 1-11-3-9-8l13-15c5-6 15-7 21-2 6 5 7 15 5 24l1 17z"
          fill="#fff"
        />
        <path d="m36 15 3-9 6 9z" fill="#fff" />
        <path d="M25 18 20 3l11 12z" class="gold" />
        <path d="m22.5 9 4-1M24 13.5l4.5-1.5" stroke-width="1.5" />
        <path d="M40 15c-3 2-4 6-3 9" stroke="#b9a3e3" stroke-width="4" />
        <path d="M27 27q3-3 6 0" />
        <circle cx="14" cy="35" r="1.2" class="dot" />
        <circle cx="24" cy="34" r="3" fill="#f4a0c0" stroke="none" opacity=".8" />
      </svg>
    }
    @case ('treasure-lock') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M10 34a22 22 0 1 1 44 0" class="violet-line" stroke-width="6" />
        <path
          d="M10 34a22 22 0 1 1 44 0"
          stroke="#fff4c2"
          stroke-width="1.5"
          stroke-dasharray="2 5"
        />
        <path d="M14 38h36v18H14z" fill="#c07a46" />
        <path d="M14 38v-4a8 8 0 0 1 8-8h20a8 8 0 0 1 8 8v4z" fill="#a8623a" />
        <path d="M14 43h36" class="gold-line" stroke-width="3" />
        <rect x="27" y="40" width="10" height="11" rx="2" class="gold" />
        <circle cx="32" cy="45" r="1.5" class="dot" />
        <circle cx="47" cy="15" r="5" class="gold" />
        <path d="M43 11c-2-3-6-2-6 0m14 0c2-3 6-2 6 0" stroke-width="1.5" />
      </svg>
    }
    @case ('numbers') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 58V30" class="stem" stroke-width="5" />
        <path d="M32 34C32 20 22 12 8 13c0 14 10 21 24 21Z" fill="#7cc47f" />
        <path d="M32 30c0-12 9-19 22-18 0 12-9 18-22 18Z" fill="#a7d99a" />
      </svg>
    }
    @case ('tens') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="m28 6 5 14 14 5-14 5-5 14-5-14-14-5 14-5z" class="gold" />
        <path d="m49 36 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#f4a0c0" />
      </svg>
    }
    @default {
      <span aria-hidden="true">{{ fallback() }}</span>
    }
  }`,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex: none;
      width: 1.25em;
      height: 1.25em;
      line-height: 1;
    }
    svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: var(--ink);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      overflow: visible;
    }
    /* Token colours go through CSS: Safari does not resolve var() in SVG attributes. */
    .gold {
      fill: var(--star-fill);
    }
    .gold-line {
      stroke: var(--star-fill);
    }
    .violet-line {
      stroke: var(--violet);
    }
    .cream {
      fill: var(--cream);
    }
    .dot {
      fill: var(--ink);
      stroke: none;
    }
    .stem {
      stroke: var(--world-numbers);
    }
  `,
})
export class Emblem {
  /** A chapter (game) id or world id from the catalog. */
  readonly id = input.required<string>();
  /** The catalog's emoji, shown when there is no drawing for this id yet. */
  readonly fallback = input('');
}
