import { Component, input } from '@angular/core';
import type { RacerId } from './race';
/**
 * One side-view pony drawn from simple shapes, facing the finish. Each racer is the same
 * body in its own colours: Lumi is the white unicorn with the rainbow mane, Cloud a lavender
 * pegasus, Minty a mint unicorn and Peach a peach pony with a bow.
 */
@Component({
  selector: 'app-racer',
  template: `<svg viewBox="0 0 170 120" aria-hidden="true" focusable="false">
    <g class="tail">
      <path class="mane-1" d="M44 62c-14-2-22 6-26 18 8-6 14-6 20-2" />
      <path class="mane-2" d="M42 66c-12 2-18 10-18 22 6-8 12-10 18-8" />
      <path class="mane-3" d="M44 70c-8 4-10 10-8 18 2-6 6-8 10-8" />
    </g>
    <g class="legs">
      <g class="leg back-b">
        <rect x="52" y="78" width="9" height="30" rx="4" />
        <rect class="hoof" x="51" y="102" width="11" height="7" rx="3" />
      </g>
      <g class="leg front-b">
        <rect x="96" y="78" width="9" height="30" rx="4" />
        <rect class="hoof" x="95" y="102" width="11" height="7" rx="3" />
      </g>
    </g>
    @if (kind() === 'cloud') {
      <path
        class="wing"
        d="M66 52c6-18 26-26 44-16-8 2-12 8-12 14 12-4 22 0 26 8-14-4-24 0-30 8 10 2 16 8 18 14-20-6-36-4-46-28z"
      />
    }
    <ellipse class="coat" cx="80" cy="70" rx="38" ry="23" />
    <path class="coat" d="M104 56 118 32l16 6-14 30z" />
    <ellipse class="coat" cx="128" cy="34" rx="18" ry="14" />
    <ellipse class="muzzle" cx="143" cy="41" rx="10" ry="8" />
    <circle class="nostril" cx="148" cy="42" r="1.6" />
    <path class="smile" d="M140 46c3 3 7 3 10 0" />
    <path class="coat" d="m120 22 4-14 6 14z" />
    @if (horn()) {
      <path class="horn" d="m128 20 5-20 5 20z" />
      <path class="horn-stripe" d="m131 14 6-1m-5-4 4-1" />
    }
    <g class="mane">
      <path class="mane-1" d="M116 26c-8 0-14 8-18 20 6-4 10-4 14 0-2-8 0-14 4-20z" />
      <path class="mane-2" d="M110 30c-6 4-10 12-10 22 4-6 8-8 12-6-4-6-4-10-2-16z" />
      <path class="mane-3" d="M104 40c-4 4-6 10-6 18 3-4 6-6 9-5-4-5-4-9-3-13z" />
      <path class="mane-1" d="M118 24c6-4 12-4 18-2-4 2-6 6-6 10-4-4-8-6-12-8z" />
    </g>
    @if (kind() === 'peach') {
      <path class="bow" d="m112 18-8-6 1 10zm0 0 8-8-1 12z" />
      <circle class="bow" cx="112" cy="18" r="2.4" />
    }
    <circle class="eye" cx="134" cy="32" r="3.4" />
    <circle class="shine" cx="135.3" cy="30.8" r="1.1" />
    <circle class="blush" cx="139" cy="40" r="3.2" />
    <g class="legs">
      <g class="leg back-a">
        <rect x="62" y="80" width="9" height="30" rx="4" />
        <rect class="hoof" x="61" y="104" width="11" height="7" rx="3" />
      </g>
      <g class="leg front-a">
        <rect x="106" y="80" width="9" height="30" rx="4" />
        <rect class="hoof" x="105" y="104" width="11" height="7" rx="3" />
      </g>
    </g>
  </svg>`,
  host: {
    '[class]': '"racer-" + kind()',
    '[class.is-running]': 'running()',
    '[class.is-stumbling]': 'stumbling()',
    '[class.is-rainbow]': 'rainbow()',
  },
  styles: `
    :host {
      --coat: #fffdfd;
      --shade: #e7d8ee;
      --mane-1: #ff8fb8;
      --mane-2: #ffd36b;
      --mane-3: #8fd3ff;
      display: block;
      width: 100%;
      height: 100%;
    }
    :host(.racer-cloud) {
      --coat: #dccbff;
      --shade: #b9a3ef;
      --mane-1: #fdf6ff;
      --mane-2: #ead9ff;
      --mane-3: #c9b1ff;
    }
    :host(.racer-mint) {
      --coat: #cdf3dd;
      --shade: #9fd9b6;
      --mane-1: #ff9ed1;
      --mane-2: #ffc3e3;
      --mane-3: #ff7bbd;
    }
    :host(.racer-peach) {
      --coat: #ffd8bb;
      --shade: #f0b48e;
      --mane-1: #fff0b8;
      --mane-2: #ffe58a;
      --mane-3: #ffd766;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .coat {
      fill: var(--coat);
    }
    .muzzle {
      fill: var(--shade);
      opacity: 0.55;
    }
    .nostril,
    .eye {
      fill: #26224a;
    }
    .shine {
      fill: #fffdfd;
    }
    .smile {
      fill: none;
      stroke: #26224a;
      stroke-width: 1.4;
      stroke-linecap: round;
    }
    .blush {
      fill: #ff8fb8;
      opacity: 0.45;
    }
    .horn {
      fill: #ffd54a;
    }
    .horn-stripe {
      stroke: #e2a400;
      stroke-width: 1.2;
      stroke-linecap: round;
    }
    .bow {
      fill: #ff6fa6;
    }
    .wing {
      fill: #fdf6ff;
      stroke: var(--shade);
      stroke-width: 1.2;
      transform-origin: 70px 52px;
    }
    .mane-1 {
      fill: var(--mane-1);
    }
    .mane-2 {
      fill: var(--mane-2);
    }
    .mane-3 {
      fill: var(--mane-3);
    }
    .leg rect {
      fill: var(--coat);
    }
    .leg .hoof {
      fill: var(--shade);
    }
    .leg {
      transform-box: fill-box;
      transform-origin: 50% 5%;
    }
    .tail {
      transform-origin: 44px 64px;
    }
    :host(.is-running) .front-a,
    :host(.is-running) .back-b {
      animation: stride 0.42s ease-in-out infinite;
    }
    :host(.is-running) .front-b,
    :host(.is-running) .back-a {
      animation: stride 0.42s ease-in-out infinite reverse;
    }
    :host(.is-running) .tail {
      animation: swish 0.84s ease-in-out infinite;
    }
    :host(.is-running) .wing {
      animation: flap 0.5s ease-in-out infinite;
    }
    :host(.is-rainbow) .mane path {
      animation: shimmer 0.8s linear infinite;
    }
    :host(.is-stumbling) svg {
      animation: stumble 0.55s ease-out;
    }
    @keyframes stride {
      0%,
      100% {
        transform: rotate(-22deg);
      }
      50% {
        transform: rotate(22deg);
      }
    }
    @keyframes swish {
      0%,
      100% {
        transform: rotate(-8deg);
      }
      50% {
        transform: rotate(10deg);
      }
    }
    @keyframes flap {
      0%,
      100% {
        transform: scaleY(1);
      }
      50% {
        transform: scaleY(0.55);
      }
    }
    @keyframes shimmer {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
    }
    @keyframes stumble {
      0% {
        transform: rotate(0);
      }
      30% {
        transform: rotate(14deg) translateY(4%);
      }
      60% {
        transform: rotate(-5deg);
      }
      100% {
        transform: rotate(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host .leg,
      :host .tail,
      :host .wing,
      :host .mane path,
      :host svg {
        animation: none !important;
      }
    }
  `,
})
export class RacerArt {
  readonly kind = input.required<RacerId>();
  readonly running = input(false);
  readonly stumbling = input(false);
  readonly rainbow = input(false);
  protected horn() {
    return this.kind() === 'player' || this.kind() === 'mint';
  }
}
