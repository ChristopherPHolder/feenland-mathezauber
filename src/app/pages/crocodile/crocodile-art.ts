import { Component, input } from '@angular/core';
/** Decorative crocodile: a side view whose jaws open toward the bigger number, or a content front view. */
@Component({
  selector: 'app-crocodile',
  template: `@if (kind() === 'front') {
      <svg viewBox="0 0 160 100" aria-hidden="true" class="front">
        <circle cx="52" cy="34" r="15" class="skin" />
        <circle cx="108" cy="34" r="15" class="skin" />
        <rect x="26" y="36" width="108" height="58" rx="29" class="skin" />
        <circle cx="52" cy="32" r="8" fill="#fff" />
        <circle cx="108" cy="32" r="8" fill="#fff" />
        <circle cx="54" cy="33" r="4" class="ink" />
        <circle cx="110" cy="33" r="4" class="ink" />
        <circle cx="68" cy="58" r="3" class="dark" />
        <circle cx="92" cy="58" r="3" class="dark" />
        <path d="M46 72 Q80 92 114 72" class="smile" />
        <path d="M58 76 l3 6 3-6M96 76 l3 6 3-6" class="smile thin" />
      </svg>
    } @else {
      <svg
        viewBox="0 0 160 100"
        aria-hidden="true"
        class="profile"
        [class.flip]="facing() === 'left'"
        [class.open]="open()"
        [class.chomp]="chomping()"
      >
        <path d="M28 66 Q6 56 2 76 Q20 72 32 78z" class="dark" />
        <rect x="22" y="44" width="80" height="40" rx="20" class="skin" />
        <circle cx="40" cy="44" r="6" class="dark" />
        <circle cx="58" cy="42" r="7" class="dark" />
        <circle cx="76" cy="44" r="6" class="dark" />
        <rect x="34" y="76" width="16" height="16" rx="8" class="dark" />
        <rect x="74" y="76" width="16" height="16" rx="8" class="dark" />
        <rect x="34" y="62" width="60" height="18" rx="9" class="belly" />
        <g class="lower">
          <path d="M96 64 H152 Q158 64 158 70 V72 Q158 78 152 78 H96 Z" class="dark" />
          <path d="M106 64 l4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6z" fill="#fff" />
        </g>
        <g class="upper">
          <path d="M96 50 H150 Q158 50 158 58 V64 H96 Z" class="skin" />
          <circle cx="150" cy="55" r="1.8" class="dark" />
          <path d="M104 64 l4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6z" fill="#fff" />
        </g>
        <circle cx="96" cy="46" r="11" class="skin" />
        <circle cx="98" cy="45" r="6" fill="#fff" />
        <circle cx="100" cy="45" r="3" class="ink" />
      </svg>
    }`,
  styles: `
    :host {
      display: inline-flex;
      width: 100%;
      aspect-ratio: 1.6;
    }
    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .skin {
      fill: #52b36b;
    }
    .dark {
      fill: #3a8f55;
    }
    .belly {
      fill: #c7eaa9;
    }
    .ink {
      fill: #172555;
    }
    .smile {
      fill: none;
      stroke: #2d7a46;
      stroke-width: 4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .thin {
      stroke: #fff;
      stroke-width: 2.5;
    }
    .flip {
      transform: scaleX(-1);
    }
    .upper,
    .lower {
      transition: transform 0.3s ease-out;
    }
    .upper {
      transform-origin: 96px 62px;
    }
    .lower {
      transform-origin: 96px 64px;
    }
    .open .upper {
      transform: rotate(-26deg);
    }
    .open .lower {
      transform: rotate(12deg);
    }
    .chomp .upper {
      animation: chomp-upper 0.45s ease-in-out 2;
    }
    .chomp .lower {
      animation: chomp-lower 0.45s ease-in-out 2;
    }
    @keyframes chomp-upper {
      50% {
        transform: rotate(-4deg);
      }
    }
    @keyframes chomp-lower {
      50% {
        transform: rotate(2deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .upper,
      .lower {
        transition: none;
        animation: none !important;
      }
    }
  `,
})
export class CrocodileArt {
  readonly kind = input<'profile' | 'front'>('profile');
  readonly facing = input<'left' | 'right'>('right');
  readonly open = input(true);
  readonly chomping = input(false);
}
