import { booleanAttribute, Component, input } from '@angular/core';
import type { RacerId } from './race';
import type { Outfit } from './race-store';
/**
 * One side-view pony, facing the finish, with the same outline as the ponies on the track:
 * the body, neck, head and legs are that model seen from the side. Each racer is the same
 * horse in its own colours: Lumi is the white unicorn with the rainbow mane, Cloud a lavender
 * pegasus, Minty a mint unicorn, Peach a peach pony with a bow, Storm a dusky pegasus with
 * a crown and the stolen key, and Shadow a see-through Lumi.
 */
@Component({
  selector: 'app-racer',
  template: `<svg
    [attr.viewBox]="bust() ? '112 3 45 45' : '0 0 170 120'"
    aria-hidden="true"
    focusable="false"
  >
    <g class="tail">
      <path
        class="mane-1"
        d="M50 50.5C40 46.5 29 54 27 69.5C25 84 28 98 31.5 109C33 99 34 89 37 80C40 71 46.5 63 50.5 57z"
      />
      <path
        class="mane-2"
        d="M50 52.5C43.5 51.5 35.5 57.5 33.5 70.5C31.8 82.5 33.5 95 35.8 104.5C37.2 95.5 38.3 86.5 41 78.5C43.7 70.8 48 64.5 50.5 58.5z"
      />
      <path
        class="mane-3"
        d="M50.2 54.5C46.5 55.5 41.5 61.5 39.8 72.5C38.5 81.5 39 90.5 40.3 97.5C41.6 90.8 42.5 84 44.5 77.5C46.3 71.5 49 65.5 50.6 60z"
      />
    </g>
    @if (kind() === 'peach') {
      <path class="bow" d="m49.5 51.5-7.5-5 1 9.5zm0 0 6.5-7-.5 10.5z" />
    }
    <g class="legs far" transform="translate(5.5 -1)">
      <g class="leg back-b">
        <path
          d="M70.9 59C74.1 59.9 71.7 64.4 71.8 68C71.9 71.6 73.5 76.7 71.6 80.7C69.7 84.7 62.4 90 60.6 92C58.8 94 60.7 90.4 60.8 92.8C60.9 95.2 61.1 103.8 61.3 106.6C61.5 109.3 62 108.5 62.1 109.3C62.2 110 63 110.7 62.1 111.1C61.2 111.5 57.7 111.9 56.7 111.7C55.7 111.5 56.2 110.7 56.2 109.9C56.2 109.1 56.8 109.8 56.5 107C56.2 104.2 54.5 96.3 54.3 93.2C54 90.1 53.8 91 55 88.4C56.2 85.8 61.3 80.4 61.4 77.7C61.5 75 57.1 74.5 55.7 72C54.3 69.5 50.4 64.8 52.9 62.6C55.4 60.4 67.8 58.1 70.9 59z"
        />
        <path class="hoof" d="M56.5 110.9L62.2 110.9L64 115.5L56.2 115.5z" />
      </g>
      <g class="leg front-b">
        <path
          d="M115.7 66.3C117.5 67.7 115.2 70.4 114.8 74.6C114.4 78.8 113.5 88.1 113.2 91.2C113 94.3 113.5 90.4 113.3 93C113.1 95.6 112.3 104.1 112.2 106.8C112.1 109.5 112.8 108.6 112.9 109.3C113 110 113.9 110.7 113 111.1C112.1 111.5 108.5 111.9 107.5 111.7C106.5 111.5 107.1 110.7 107.1 109.9C107.1 109.1 107.6 109.6 107.4 106.8C107.3 104 106.4 95.6 106.2 93C106 90.4 106.5 94.3 106.3 91.2C106 88.1 105.1 78.8 104.7 74.6C104.3 70.4 102 67.7 103.8 66.3C105.6 64.9 113.9 64.9 115.7 66.3z"
        />
        <path class="hoof" d="M106.9 110.9L112.6 110.9L114.4 115.5L106.5 115.5z" />
      </g>
    </g>
    <path class="far-ear" d="M131 19.5 134.2 9.8l2.4 10.7z" />
    <path
      class="coat"
      d="M46.7 55.7C47.2 53.6 47.8 50.9 49.5 49.3C51.2 47.7 53.9 46.8 56.7 46.1C59.6 45.4 62.9 45 66.6 45.3C70.3 45.6 74.9 47.6 78.8 48.1C82.7 48.6 86.5 48.5 89.8 48.4C93.1 48.3 95.8 48 98.6 47.5C101.4 47 103.7 45.5 106.4 45.4C109.2 45.3 112.7 45.7 115.1 47C117.5 48.3 119.5 51.1 120.8 53C122.1 54.9 122.7 56.7 123.1 58.5C123.5 60.3 123.5 62.2 123.1 64C122.7 65.8 121.8 67.6 120.8 69.5C119.8 71.4 118.7 73.9 117.3 75.5C115.9 77.1 114.8 78.2 112.2 79C109.6 79.8 105.7 80.4 101.6 80.5C97.5 80.6 91.9 80.3 87.4 79.6C82.9 78.9 78.6 77 74.5 76.3C70.4 75.6 66.1 76 62.7 75.4C59.3 74.8 56.7 73.8 54.3 72.7C51.9 71.6 49.8 70.3 48.5 68.6C47.2 66.8 47 64.3 46.7 62.2C46.4 60.1 46.2 57.9 46.7 55.7z"
    />
    <path
      class="coat"
      d="M92.9 52.7C91.1 48.2 100.1 46.5 103.1 43.8C106.1 41.1 108.5 39 111 36.4C113.5 33.8 115.9 30.8 118 28.3C120.1 25.8 122 22.9 123.7 21.3C125.5 19.7 126.6 18.4 128.5 18.8C130.4 19.2 134.2 22.1 135.2 23.7C136.2 25.3 135.1 26.4 134.4 28.5C133.7 30.6 132.3 33.2 131 36.2C129.8 39.2 128.4 42.8 126.9 46.5C125.4 50.2 124.2 54.5 122 58.5C119.8 62.5 118.5 71.8 113.7 70.8C108.9 69.8 94.7 57.2 92.9 52.7z"
    />
    <path
      class="coat"
      d="M128 19.6C129.6 18.6 131.6 18.9 133.5 19.6C135.4 20.3 137.7 22.1 139.4 24C141.1 25.9 142.4 28.8 143.8 30.9C145.2 33 146.7 35.1 148 36.7C149.3 38.3 151.1 39.3 151.9 40.5C152.8 41.7 153.6 42.9 153.1 44.1C152.6 45.4 150.4 47.5 149.2 48C148 48.5 147.2 47.8 145.9 47C144.6 46.3 143.2 44.8 141.5 43.5C139.8 42.2 137.6 40.6 135.5 39.2C133.4 37.8 130.7 36.5 128.9 35C127.1 33.5 125.6 31.8 124.7 30.2C123.8 28.6 123.2 27.4 123.7 25.6C124.3 23.8 126.4 20.6 128 19.6z"
    />
    <ellipse
      class="muzzle"
      cx="148.6"
      cy="43.6"
      rx="5.4"
      ry="4.9"
      transform="rotate(43 148.6 43.6)"
    />
    <circle class="nostril" cx="151.3" cy="43" r=".9" />
    <path class="smile" d="M146.4 47c1.4.5 2.8.2 3.9-.8" />
    <path class="coat" d="M126.2 22 128.4 9.6l4.8 10.4z" />
    @if (horn()) {
      <path class="horn" d="M137 22.4 151.6 5.6 141 25z" />
      <path class="horn-stripe" d="m140.3 18.9 3.3 2.2m-.3-5.9 2.8 1.9m.2-5.5 2.2 1.5" />
    }
    <g class="mane">
      <path
        class="mane-1"
        d="M129.4 18.5C126.7 24.6 125.3 29.6 128 34C131.4 28.2 134.7 23.9 132.8 18.5z"
      />
      <path
        class="mane-2"
        d="M124.4 19.5C121.7 26.1 119.7 31.7 122.4 36.5C125.8 30.1 129.7 25.3 127.8 19.5z"
      />
      <path
        class="mane-3"
        d="M119.5 24.2C116.8 31.3 114.2 37.5 116.9 42.7C120.3 35.7 124.8 30.4 122.9 24.2z"
      />
      <path
        class="mane-1"
        d="M114.7 29.8C112 37.5 108.8 44.1 111.5 49.8C114.9 42.2 120 36.5 118.1 29.8z"
      />
      <path
        class="mane-2"
        d="M109.9 35.4C107.2 43.6 103.4 50.8 106.1 56.9C109.5 48.7 115.2 42.5 113.3 35.4z"
      />
      <path
        class="mane-3"
        d="M105.4 40C102.7 48.7 98.3 56.4 101 63C104.4 54.2 110.7 47.6 108.8 40z"
      />
      <path
        class="mane-1"
        d="M100.9 44.5C98.2 53.7 93.2 62 95.9 69C99.3 59.6 106.2 52.5 104.3 44.5z"
      />
      <path
        class="mane-2"
        d="M128.5 18.6c4-.8 8 1.6 10.1 6-3-1.2-5.6-1-8 .2.2-2.4-.6-4.4-2.1-6.2z"
      />
    </g>
    @if (kind() === 'peach') {
      <path class="bow" d="m125 17.5-6.5-4.5.8 8.2zm0 0 5.8-6-.4 9z" />
      <circle class="bow" cx="125" cy="17.5" r="1.9" />
    }
    @switch (outfit()) {
      @case ('wreath') {
        <g class="wreath">
          <circle cx="122.5" cy="21.5" r="2.7" fill="#ffd36b" />
          <circle cx="126.5" cy="17.8" r="2.7" fill="#ff8fb8" />
          <circle cx="131.5" cy="16.6" r="2.7" fill="#fff" />
          <circle cx="136.3" cy="18.6" r="2.7" fill="#b79bff" />
          <circle cx="139.6" cy="22.6" r="2.7" fill="#ffd36b" />
        </g>
      }
      @case ('wings') {
        <path
          class="feather"
          d="M100 51C96 39 84 29.5 68 27.5C73.5 31.5 76.5 35.5 77.5 39.5C69.5 36.5 60.5 37.5 53.5 42.5C61.5 43 67.5 46 71 50C64.5 50.5 59 53.5 55.5 58.5C72 62 90 60.5 100 51z"
        />
        <path class="wing-line" d="M96 50.5C88 44 79 40.5 69 39.5M94 53.5C86 51 78 50.5 70 51.5" />
      }
      @case ('tiara') {
        <g class="tiara">
          <path d="M123.5 20.5q8-7 16.5.5" fill="none" stroke="#e8e4ff" stroke-width="2.2" />
          <path
            d="m131.8 6.5 1.7 4.3h4.4l-3.5 2.7 1.5 4.3-4.1-2.7-4.1 2.7 1.5-4.3-3.5-2.7h4.4z"
            fill="#fff4c2"
          />
        </g>
      }
      @case ('crown') {
        <path class="crown" d="m124.5 19.5 1.6-8.5 3.6 4.8 3-7.3 3.2 6.9 3.8-4.6 1 8.9z" />
        <circle cx="132.6" cy="16.2" r="1.7" fill="#ff6f91" />
      }
      @case ('cape') {
        <g class="cape">
          <path d="M64 46.5c12 3 26 2.5 38 0l.6 4.8c-12.6 2.5-26.6 3-39 0z" fill="#ff6f91" />
          <path d="M63.6 51.3c12.4 3 26.4 2.5 39 0l.5 4.8c-12.9 2.5-27 3-39.8 0z" fill="#ffb347" />
          <path d="M63.3 56.1c12.8 3 26.9 2.5 39.8 0l.2 4.8c-13 2.5-27 3-39.9 0z" fill="#ffe066" />
          <path
            d="M63.4 60.9c12.9 3 26.9 2.5 39.9 0l-.4 4.6c-12.8 2.5-26.4 3-39 0z"
            fill="#7ddf9b"
          />
          <path
            d="M63.9 65.5c12.6 3 26.2 2.5 39 0l-1.2 4.2c-12 2.3-24.8 2.8-36.4 0z"
            fill="#7cc7ff"
          />
        </g>
      }
    }
    @if (kind() === 'storm') {
      <path class="crown" d="m124.5 19.5 1.6-8.5 3.6 4.8 3-7.3 3.2 6.9 3.8-4.6 1 8.9z" />
      <circle class="crown" cx="88" cy="60" r="4.2" />
      <rect class="crown" x="86.5" y="63" width="3" height="11" rx="1.2" />
    }
    <ellipse class="eye" cx="134.9" cy="28.6" rx="2" ry="2.4" />
    <circle class="shine" cx="135.6" cy="27.7" r=".75" />
    <g class="legs">
      <g class="leg back-a">
        <path
          d="M70.9 59C74.1 59.9 71.7 64.4 71.8 68C71.9 71.6 73.5 76.7 71.6 80.7C69.7 84.7 62.4 90 60.6 92C58.8 94 60.7 90.4 60.8 92.8C60.9 95.2 61.1 103.8 61.3 106.6C61.5 109.3 62 108.5 62.1 109.3C62.2 110 63 110.7 62.1 111.1C61.2 111.5 57.7 111.9 56.7 111.7C55.7 111.5 56.2 110.7 56.2 109.9C56.2 109.1 56.8 109.8 56.5 107C56.2 104.2 54.5 96.3 54.3 93.2C54 90.1 53.8 91 55 88.4C56.2 85.8 61.3 80.4 61.4 77.7C61.5 75 57.1 74.5 55.7 72C54.3 69.5 50.4 64.8 52.9 62.6C55.4 60.4 67.8 58.1 70.9 59z"
        />
        <path class="hoof" d="M56.5 110.9L62.2 110.9L64 115.5L56.2 115.5z" />
      </g>
      <g class="leg front-a">
        <path
          d="M115.7 66.3C117.5 67.7 115.2 70.4 114.8 74.6C114.4 78.8 113.5 88.1 113.2 91.2C113 94.3 113.5 90.4 113.3 93C113.1 95.6 112.3 104.1 112.2 106.8C112.1 109.5 112.8 108.6 112.9 109.3C113 110 113.9 110.7 113 111.1C112.1 111.5 108.5 111.9 107.5 111.7C106.5 111.5 107.1 110.7 107.1 109.9C107.1 109.1 107.6 109.6 107.4 106.8C107.3 104 106.4 95.6 106.2 93C106 90.4 106.5 94.3 106.3 91.2C106 88.1 105.1 78.8 104.7 74.6C104.3 70.4 102 67.7 103.8 66.3C105.6 64.9 113.9 64.9 115.7 66.3z"
        />
        <path class="hoof" d="M106.9 110.9L112.6 110.9L114.4 115.5L106.5 115.5z" />
      </g>
    </g>
    @if (kind() === 'cloud' || kind() === 'storm') {
      <path
        class="wing"
        d="M100 51C96 39 84 29.5 68 27.5C73.5 31.5 76.5 35.5 77.5 39.5C69.5 36.5 60.5 37.5 53.5 42.5C61.5 43 67.5 46 71 50C64.5 50.5 59 53.5 55.5 58.5C72 62 90 60.5 100 51z"
      />
      <path class="wing-line" d="M96 50.5C88 44 79 40.5 69 39.5M94 53.5C86 51 78 50.5 70 51.5" />
    }
  </svg>`,
  host: {
    '[class]': '"racer-" + kind()',
    '[class.is-running]': 'running()',
    '[class.is-stumbling]': 'stumbling()',
    '[class.is-rainbow]': 'rainbow()',
    '[class.is-bust]': 'bust()',
  },
  styles: `
    :host {
      --coat: #fffdfd;
      --shade: #e7d8ee;
      --mane-1: #ff8fb8;
      --mane-2: #ffd36b;
      --mane-3: #8fd3ff;
      --edge: #b9a3d6;
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
    :host(.racer-storm) {
      --coat: #8f98c4;
      --shade: #6b739e;
      --mane-1: #4b3a70;
      --mane-2: #6d4a9a;
      --mane-3: #3a2f5c;
    }
    :host(.racer-shadow) {
      --coat: #c9b8ff;
      --shade: #b09cf2;
      --mane-1: #e2d6ff;
      --mane-2: #d2c2ff;
      --mane-3: #efe8ff;
      opacity: 0.6;
    }
    :host(.is-bust) svg {
      overflow: hidden;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
      /* One thin edge round the whole silhouette, so a white pony reads on a pale card. */
      filter: drop-shadow(0 0 0.6px var(--edge)) drop-shadow(0 0 0.4px var(--edge));
    }
    .coat,
    .leg path {
      fill: var(--coat);
    }
    .far .leg path,
    .far-ear {
      fill: var(--shade);
    }
    .leg .hoof,
    .far .leg .hoof {
      fill: color-mix(in srgb, var(--shade) 62%, #26224a);
    }
    .muzzle {
      fill: var(--shade);
      opacity: 0.75;
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
      stroke-width: 1;
      stroke-linecap: round;
      opacity: 0.7;
    }
    .horn {
      fill: #ffd54a;
    }
    .horn-stripe {
      fill: none;
      stroke: #e2a400;
      stroke-width: 1.1;
      stroke-linecap: round;
    }
    .bow {
      fill: #ff6fa6;
    }
    .crown {
      fill: #ffd54a;
      stroke: #c99a1a;
      stroke-width: 0.8;
    }
    .wing,
    .feather {
      fill: #fdf6ff;
      stroke: var(--shade);
      stroke-width: 1;
      transform-origin: 100px 51px;
    }
    .feather {
      fill: #ffffff;
      stroke: #d9d0ff;
    }
    .wing-line {
      fill: none;
      stroke: var(--shade);
      stroke-width: 0.9;
      stroke-linecap: round;
      transform-origin: 100px 51px;
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
    .leg {
      transform-box: fill-box;
      transform-origin: 50% 6%;
    }
    .tail {
      transform-origin: 50px 54px;
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
    :host(.is-running) .wing,
    :host(.is-running) .wing-line {
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
      :host .wing-line,
      :host .mane path,
      :host svg {
        animation: none !important;
      }
    }
  `,
})
export class RacerArt {
  readonly kind = input.required<RacerId>();
  /** Lumi's keepsake from a finished cup; ignored for the other racers. */
  readonly outfit = input<Outfit | null>(null);
  readonly running = input(false);
  readonly stumbling = input(false);
  readonly rainbow = input(false);
  /** Head and neck only, for sizes where a whole pony would be a smudge. */
  readonly bust = input(false, { transform: booleanAttribute });
  protected horn() {
    return this.kind() === 'player' || this.kind() === 'mint' || this.kind() === 'shadow';
  }
}
