import { Component, input } from '@angular/core';
/**
 * The illustrated emblem of a game (chapter id) or world (world id), drawn in the
 * fairyland palette with ink outlines. Unknown ids show the catalog's emoji `fallback`,
 * so a new game still gets an emblem before it has its own drawing.
 * Sized in em: the emblem is 1.25 times the surrounding font size.
 */
@Component({
  selector: 'ui-emblem',
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
    @case ('fireworks') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="2" y="2" width="60" height="60" rx="14" fill="#2b2161" />
        <path d="M2 48h60v0a14 14 0 0 1-14 14H16A14 14 0 0 1 2 48z" fill="#3b4aa0" />
        <path d="M12 50h10m8 0h6m8 0h10" stroke="#ffd45c" stroke-width="1.5" opacity=".7" />
        <path d="M14 48q4-12 16-24" stroke="#ffd45c" stroke-width="2" stroke-dasharray="2 3" />
        <g fill="#ffd45c">
          <circle cx="24" cy="18" r="3" />
          <circle cx="32" cy="18" r="3" />
          <circle cx="40" cy="18" r="3" />
          <circle cx="24" cy="26" r="3" />
          <circle cx="32" cy="26" r="3" />
        </g>
        <g fill="#ff9ccf">
          <circle cx="48" cy="26" r="2.6" />
          <circle cx="40" cy="26" r="2.6" />
        </g>
        <path
          d="M32 6v4M32 34v-3M14 22h4M50 22h4M19 9l3 3M45 9l-3 3"
          stroke="#fff4c2"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    }
    @case ('potions') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="25" cy="11" r="4" fill="#c9b2f2" />
        <circle cx="34" cy="6" r="3" fill="#c9b2f2" />
        <path d="M24 56h16l3 4H21z" fill="#ff8a3d" />
        <path d="M9 26h46c1 18-7 28-17 30H26C16 54 8 44 9 26z" fill="#2d2a3e" />
        <ellipse cx="32" cy="26" rx="25" ry="6" fill="#47435e" />
        <ellipse cx="32" cy="26" rx="21" ry="4" fill="#9b6ad6" />
        <circle cx="27" cy="24" r="2" fill="#e8dcff" />
        <path d="M46 10h6v6c5 2 7 6 7 10a10 10 0 0 1-20 0c0-4 2-8 7-10z" fill="#e8f4ff" />
        <path d="M39.5 27h19a9.5 9 0 0 1-19 0z" fill="#3fa65a" />
        <rect x="45" y="6" width="8" height="5" rx="2" fill="#b98a5a" />
      </svg>
    }
    @case ('bakery') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="6" y="20" width="52" height="38" rx="7" fill="#9aa1ad" />
        <rect x="10" y="24" width="44" height="30" rx="4" fill="#f3e6c8" />
        <circle cx="20" cy="32" r="6" fill="#e3a95c" />
        <circle cx="32" cy="32" r="6" fill="#e3a95c" />
        <circle cx="44" cy="32" r="6" fill="#e3a95c" />
        <circle cx="20" cy="46" r="6" fill="#e3a95c" />
        <circle cx="32" cy="46" r="6" fill="#e3a95c" />
        <circle cx="44" cy="46" r="6" fill="#e3a95c" />
        <path d="M8 39.5h48" stroke="#c98a45" stroke-width="2" stroke-dasharray="3 3" />
        <circle cx="18" cy="31" r="1.4" fill="#5a3418" />
        <circle cx="34" cy="30" r="1.4" fill="#5a3418" />
        <circle cx="43" cy="34" r="1.4" fill="#5a3418" />
        <circle cx="21" cy="47" r="1.4" fill="#5a3418" />
        <circle cx="31" cy="45" r="1.4" fill="#5a3418" />
        <circle cx="45" cy="47" r="1.4" fill="#5a3418" />
        <path
          d="M22 18h20v-4c5-1 6-8 0-9-2-5-8-5-10-1-2-4-8-4-10 1-6 1-5 8 0 9z"
          fill="#fffaf0"
          stroke="#d9cbb3"
          stroke-width="1.5"
        />
      </svg>
    }
    @case ('mushroom-drums') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M27 38h10l3 18H24z" fill="#f4ead6" />
        <path d="M6 36c0-14 12-24 26-24s26 10 26 24z" fill="#e8669a" />
        <ellipse cx="32" cy="36" rx="26" ry="5" fill="#b84a78" />
        <ellipse
          cx="32"
          cy="24"
          rx="15"
          ry="5"
          fill="#fff8e8"
          stroke="#8a5a2b"
          stroke-width="2.5"
        />
        <circle cx="16" cy="28" r="2.5" fill="#fff4e0" />
        <circle cx="47" cy="29" r="2" fill="#fff4e0" />
        <path d="M44 4 36 20M52 8 40 21" stroke="#8a5a2b" stroke-width="3" stroke-linecap="round" />
        <circle cx="44" cy="4" r="3" class="gold" />
        <circle cx="52" cy="8" r="3" class="gold" />
        <path d="M6 56h52" />
      </svg>
    }
    @case ('star-catcher') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="30" r="26" fill="#22306b" />
        <circle cx="16" cy="18" r="1.4" fill="#fff4c2" stroke="none" />
        <circle cx="45" cy="13" r="1.2" fill="#fff4c2" stroke="none" />
        <circle cx="50" cy="32" r="1.4" fill="#fff4c2" stroke="none" />
        <path d="M11 13 34 31" stroke="#8ec5ee" stroke-width="4" opacity=".7" />
        <path d="M14 11 36 28" stroke="#f4a0c0" stroke-width="2" />
        <path d="m39 23 3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" class="gold" />
        <path d="M4 50q28-6 56 0v6q-28-6-56 0z" fill="#b9a3e3" />
        <path d="M14 48v-6m18 4v-6m18 6v-6" stroke-width="2.5" />
        <circle cx="14" cy="40" r="2.5" class="gold" />
        <circle cx="32" cy="38" r="2.5" class="gold" />
        <circle cx="50" cy="40" r="2.5" class="gold" />
      </svg>
    }
    @case ('gondola') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M4 50 22 24l10 12 10-18 18 32z" fill="#e1effa" />
        <path d="m22 24-5 7 5-2 4 3zM42 18l-5 9 5-3 5 4z" fill="#fdfeff" />
        <path d="M2 14 62 4" stroke-width="2.5" />
        <path d="M33 9v10" stroke-width="2.5" />
        <rect x="20" y="19" width="26" height="22" rx="7" fill="#e2467c" />
        <rect x="23.5" y="23" width="19" height="9" rx="3" fill="#eef7ff" />
        <circle cx="28" cy="27.5" r="2.2" fill="#fffaf3" />
        <circle cx="33" cy="27.5" r="2.2" fill="#fffaf3" />
        <circle cx="38" cy="27.5" r="2.2" fill="#fffaf3" />
        <path d="M27 25l-1-4m3 4 1-4" stroke-width="1.2" />
        <path d="M4 58h56" />
      </svg>
    }
    @case ('picnic') {
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M4 44 32 30l28 14-28 14z" fill="#fff6ee" />
        <path
          d="m11 40.5 28 14M18 37l28 14M25 33.5l28 14M53 40.5l-28 14M46 37 18 51M39 33.5 11 47.5"
          stroke="#e2526e"
          stroke-width="3"
          opacity="0.75"
        />
        <ellipse cx="32" cy="36" rx="15" ry="7" fill="#fff" />
        <path d="M17 34a15 7 0 0 0 30 0v-3H17z" fill="#d99a4e" />
        <ellipse cx="32" cy="31" rx="15" ry="7" fill="#f4c77d" />
        <path d="M32 31 32 24M32 31l13 3M32 31l-13 3" stroke="#a86d12" stroke-width="1.6" />
        <path d="M32 31V24a15 7 0 0 1 13 3.5z" fill="#e2526e" />
        <circle cx="22" cy="14" r="5" fill="#c4234a" />
        <circle cx="30" cy="11" r="4" fill="#c4234a" />
        <path d="M22 9q2-4 6-4M30 7q1-3 4-3" stroke="#3f7d2c" stroke-width="1.6" />
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
