import { Component, input } from '@angular/core';
export type HeronTarget = 'left' | 'right' | 'center';
export type HeronState = 'flying' | 'stole' | 'shooed';
/**
 * The greedy heron that races Kiki for a snack. In the pond it flies in from the top right
 * toward its target over `duration` milliseconds; elsewhere it just flaps in place.
 */
@Component({
  selector: 'app-heron',
  template: `<svg viewBox="0 0 160 100" aria-hidden="true" [class.flapping]="flapping()">
    <path class="wing back" d="M70 48 Q92 8 134 18 Q110 34 92 52z" />
    <ellipse class="body" cx="78" cy="56" rx="34" ry="16" />
    <path class="legs" d="M84 70 l14 18 M92 70 l16 16" />
    <path class="neck" d="M50 50 Q30 42 28 24" />
    <circle class="head" cx="28" cy="22" r="9" />
    <path class="beak" d="M20 22 L-2 26 L20 28z" />
    <circle class="eye" cx="25" cy="20" r="2.2" />
    <path class="crest" d="M34 15 q6-8 12-4" />
    <path class="wing front" d="M64 50 Q40 10 2 20 Q30 36 56 56z" />
  </svg>`,
  host: {
    '[class.in-pond]': 'state() !== null',
    '[class.flying]': "state() === 'flying'",
    '[class.stole]': "state() === 'stole'",
    '[class.shooed]': "state() === 'shooed'",
    '[class.paused]': 'paused()',
    '[class.to-left]': "target() === 'left'",
    '[class.to-right]': "target() === 'right'",
    '[class.to-center]': "target() === 'center'",
    '[style.--flight.ms]': 'duration()',
    'aria-hidden': 'true',
  },
  styles: `
    :host {
      display: block;
      width: 100%;
      aspect-ratio: 1.6;
    }
    :host(.in-pond) {
      position: absolute;
      z-index: 4;
      top: 4%;
      left: 100%;
      width: 150px;
      pointer-events: none;
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }
    :host(.flying.to-left) {
      animation: fly-left var(--flight, 8000ms);
    }
    :host(.flying.to-right) {
      animation: fly-right var(--flight, 8000ms);
    }
    :host(.flying.to-center) {
      animation: fly-center var(--flight, 8000ms);
    }
    :host(.paused) {
      animation-play-state: paused;
    }
    :host(.stole.to-left) {
      animation: snatch-left 1.3s ease-in;
    }
    :host(.stole.to-right) {
      animation: snatch-right 1.3s ease-in;
    }
    :host(.stole.to-center) {
      animation: snatch-center 1.3s ease-in;
    }
    :host(.shooed) {
      animation: shoo 0.8s ease-in;
    }
    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .body,
    .head {
      fill: #8fa8c4;
    }
    .wing {
      fill: #6f8bb0;
      transform-box: fill-box;
      transform-origin: 100% 100%;
    }
    .wing.front {
      transform-origin: 100% 80%;
    }
    .neck,
    .legs,
    .crest {
      fill: none;
      stroke: #6f8bb0;
      stroke-width: 5;
      stroke-linecap: round;
    }
    .crest {
      stroke-width: 3;
    }
    .beak {
      fill: #f4b740;
    }
    .eye {
      fill: #172555;
    }
    .flapping .wing.front {
      animation: flap 0.5s ease-in-out infinite alternate;
    }
    .flapping .wing.back {
      animation: flap-back 0.5s ease-in-out infinite alternate;
    }
    @keyframes flap {
      from {
        transform: rotate(-18deg);
      }
      to {
        transform: rotate(16deg);
      }
    }
    @keyframes flap-back {
      from {
        transform: rotate(14deg);
      }
      to {
        transform: rotate(-12deg);
      }
    }
    @keyframes fly-left {
      from {
        left: 100%;
        top: -6%;
      }
      to {
        left: 4%;
        top: 14%;
      }
    }
    @keyframes fly-right {
      from {
        left: 100%;
        top: -6%;
      }
      to {
        left: 62%;
        top: 14%;
      }
    }
    @keyframes fly-center {
      from {
        left: 100%;
        top: -6%;
      }
      to {
        left: 34%;
        top: 10%;
      }
    }
    @keyframes snatch-left {
      0% {
        left: 4%;
        top: 14%;
      }
      30% {
        left: 6%;
        top: 36%;
      }
      100% {
        left: -30%;
        top: -40%;
      }
    }
    @keyframes snatch-right {
      0% {
        left: 62%;
        top: 14%;
      }
      30% {
        left: 64%;
        top: 36%;
      }
      100% {
        left: 110%;
        top: -40%;
      }
    }
    @keyframes snatch-center {
      0% {
        left: 34%;
        top: 10%;
      }
      30% {
        left: 36%;
        top: 30%;
      }
      100% {
        left: 110%;
        top: -40%;
      }
    }
    @keyframes shoo {
      to {
        left: 110%;
        top: -40%;
        opacity: 0;
      }
    }
    @media (max-width: 640px) {
      :host(.in-pond) {
        width: 96px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .wing {
        animation: none !important;
      }
      :host(.flying) {
        animation-duration: 0.01ms !important;
      }
    }
  `,
})
export class Heron {
  readonly flapping = input(true);
  readonly state = input<HeronState | null>(null);
  readonly target = input<HeronTarget | null>(null);
  readonly paused = input(false);
  readonly duration = input<number | null>(null);
}
