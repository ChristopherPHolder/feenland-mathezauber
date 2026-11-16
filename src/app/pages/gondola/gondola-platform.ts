import { Component, computed, input } from '@angular/core';
import { CABIN_COLORS, GondolaFrame, sceneLayout } from './gondola-frame';

interface SeatView {
  readonly x: number;
  readonly y: number;
  readonly filled: boolean;
  readonly second: boolean;
}
interface CabinView {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: string;
  /** Seats with bunnies, a "10" tag, a number, or a snow tarp with the number. */
  readonly look: 'seats' | 'ten' | 'number' | 'tarp';
  readonly count: number;
  readonly seats: readonly SeatView[];
  readonly golden: boolean;
  readonly pulse: boolean;
  readonly glow: boolean;
}
interface BunnyView {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly first: boolean;
  readonly crown: boolean;
  readonly away: boolean;
}

/** Where the cable runs, in the picture's coordinates. */
const CABLE = { x1: 70, y1: 196, x2: 440, y2: 58 };
const along = (t: number) => ({
  x: CABLE.x1 + (CABLE.x2 - CABLE.x1) * t,
  y: CABLE.y1 + (CABLE.y2 - CABLE.y1) * t,
});

function seatsFor(x: number, y: number, w: number, h: number, count: number): SeatView[] {
  const cell = w / 5.6;
  const rowGap = h * 0.12;
  const top = y + h * 0.3;
  return Array.from({ length: 10 }, (_, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    return {
      x: x + cell * 0.8 + col * cell,
      y: top + row * (cell + rowGap),
      filled: index < count,
      second: row === 1,
    };
  });
}

/**
 * The gondola station drawn flat: the mountain with Gusti's cable, the summit village, the
 * boarding cabin with its ten seats in two rows of five, the waiting bunnies split by the handle,
 * the snow cloud and the cocoa. It is the scene wherever 3D is missing, and the intro picture.
 * Decorative only: the game's buttons and live text say the same.
 */
@Component({
  selector: 'app-gondola-platform',
  template: `<svg
    viewBox="0 0 480 300"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
    [class.is-complete]="frame().phase === 'complete'"
  >
    <defs>
      <linearGradient [attr.id]="id + '-sky'" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#9fd0f2" />
        <stop offset="1" stop-color="#e8f5ff" />
      </linearGradient>
    </defs>
    <rect width="480" height="300" [attr.fill]="'url(#' + id + '-sky)'" />
    <path class="far" d="M0 170 90 90l60 50 70-90 90 100 60-70 110 110v130H0z" />
    <path class="slope" d="M0 230 120 150l110-60 120-70 130 60v220H0z" />
    <path class="snowcap" d="M330 32l20-12 40 18-14 4-12-6-14 8-12-6-14 6z" />
    @for (tree of trees; track $index) {
      <path class="tree" [attr.d]="tree" />
    }
    <!-- The summit village: one building per finished level. -->
    @for (house of houses(); track house.key) {
      <g [attr.transform]="'translate(' + house.x + ' ' + house.y + ')'">
        <rect
          class="house"
          x="-9"
          y="-10"
          width="18"
          height="12"
          rx="2"
          [attr.fill]="house.color"
        />
        <path class="roof" d="M-11-9 0-19l11 10z" />
        <rect class="window" x="-3" y="-6" width="6" height="5" rx="1" />
      </g>
    }
    <!-- Lanterns along the path: one lights per delivered cabin. -->
    @for (lantern of lanterns(); track $index) {
      <circle
        class="lantern"
        [class.is-lit]="lantern.lit"
        [attr.cx]="lantern.x"
        [attr.cy]="lantern.y"
        r="3.4"
      />
    }
    <line
      class="cable"
      [attr.x1]="cable.x1"
      [attr.y1]="cable.y1"
      [attr.x2]="cable.x2"
      [attr.y2]="cable.y2"
    />
    <line class="cable" x1="70" y1="196" x2="-20" y2="250" />
    <rect class="tower" x="236" y="128" width="6" height="90" />
    <path class="station" d="M30 196h90v12H30z" />
    <path class="deck" d="M0 252h480v48H0z" />
    <path class="deck-edge" d="M0 252h480" />

    @for (cabin of cabins(); track cabin.key) {
      <g
        class="cabin"
        [class.is-golden]="cabin.golden"
        [class.is-pulse]="cabin.pulse"
        [class.is-glow]="cabin.glow"
      >
        <line
          class="hanger"
          [attr.x1]="cabin.x + cabin.w / 2"
          [attr.y1]="cabin.y - cabin.h * 0.28"
          [attr.x2]="cabin.x + cabin.w / 2"
          [attr.y2]="cabin.y"
        />
        <rect
          class="body"
          [attr.x]="cabin.x"
          [attr.y]="cabin.y"
          [attr.width]="cabin.w"
          [attr.height]="cabin.h"
          [attr.rx]="cabin.h * 0.22"
          [attr.fill]="cabin.color"
        />
        <rect
          class="glass"
          [attr.x]="cabin.x + cabin.w * 0.06"
          [attr.y]="cabin.y + cabin.h * 0.14"
          [attr.width]="cabin.w * 0.88"
          [attr.height]="cabin.h * 0.72"
          [attr.rx]="cabin.h * 0.14"
        />
        @switch (cabin.look) {
          @case ('seats') {
            @for (seat of cabin.seats; track $index) {
              <g [attr.transform]="'translate(' + seat.x + ' ' + seat.y + ')'">
                <circle
                  class="seat"
                  [class.is-second]="seat.second"
                  [class.is-empty]="!seat.filled"
                  r="7"
                />
                @if (seat.filled) {
                  <path class="mini-ear" d="M-4-4-5-14q1-2 3 0l1 9zM4-4l1-10q2-2 3 0l-2 10z" />
                  <circle class="mini-head" r="5.4" />
                  <circle class="mini-eye" cx="-1.8" cy="-0.6" r="0.9" />
                  <circle class="mini-eye" cx="1.8" cy="-0.6" r="0.9" />
                }
              </g>
            }
          }
          @case ('ten') {
            <text class="tag" [attr.x]="cabin.x + cabin.w / 2" [attr.y]="cabin.y + cabin.h * 0.55">
              10
            </text>
          }
          @default {
            @if (cabin.look === 'tarp') {
              <rect
                class="tarp"
                [attr.x]="cabin.x + 2"
                [attr.y]="cabin.y + 2"
                [attr.width]="cabin.w - 4"
                [attr.height]="cabin.h - 4"
                [attr.rx]="cabin.h * 0.2"
              />
            }
            <text
              class="count"
              [attr.x]="cabin.x + cabin.w / 2"
              [attr.y]="cabin.y + cabin.h * 0.56"
            >
              {{ cabin.count }}
            </text>
          }
        }
      </g>
    }

    @for (bunny of bunnies(); track bunny.key) {
      <g
        class="bunny"
        [class.is-first]="bunny.first"
        [class.is-away]="bunny.away"
        [attr.transform]="'translate(' + bunny.x + ' ' + bunny.y + ')'"
      >
        <path class="ear" d="M-6-22-8-38q2-4 5 0l1 15zM6-22l2-16q3-4 5 0l-3 16z" />
        <ellipse class="fur" cx="0" cy="-6" rx="9" ry="9" />
        <circle class="fur" cx="0" cy="-20" r="7" />
        <circle class="eye" cx="-2.5" cy="-21" r="1.1" />
        <circle class="eye" cx="2.5" cy="-21" r="1.1" />
        <path class="scarf" d="M-6-14q6 3 12 0v3q-6 3-12 0z" />
        @if (bunny.crown) {
          <path class="crown" d="M-6-28l2 3 2-4 2 4 2-4 2 4 2-3-1 5H-5z" />
        }
      </g>
    }

    @if (layout().ticket) {
      <g class="ticket" transform="translate(410 214)">
        <rect x="-26" y="-20" width="52" height="30" rx="8" />
        <text y="-4">↓ {{ layout().ticket }}</text>
      </g>
    }

    @if (frame().cocoa !== 'none') {
      <g class="cocoa" [class.is-cold]="frame().cocoa === 'cold'" transform="translate(452 240)">
        <rect x="-9" y="-14" width="18" height="16" rx="3" />
        <path class="handle" d="M9-10q7 0 7 5t-7 5" />
        @if (frame().cocoa === 'warm') {
          <path class="steam" d="M-4-18q-3-5 0-9M3-18q-3-5 0-9" />
        } @else {
          <path class="frost" d="M-6-20h12M0-26v12M-4-24l8 8M4-24l-8 8" />
        }
      </g>
    }

    @if (frame().cloud > 0) {
      <g
        class="cloud"
        [attr.transform]="
          'translate(' +
          (470 - frame().cloud * 300) +
          ' 46) scale(' +
          (0.8 + frame().cloud * 0.6) +
          ')'
        "
        [style.--dark]="frame().cloud"
      >
        <path d="M-40 10q-10-18 10-22 6-18 28-12 16-10 30 6 22 0 18 20z" />
        @if (frame().cocoa === 'cold') {
          <path class="flakes" d="M-24 22v6M-6 26v6M12 22v6M28 26v6" />
        }
      </g>
    }

    <!-- Gusti the goat, conductor's cap on. -->
    <g class="goat" transform="translate(40 250)">
      <path class="goat-leg" d="M-12-4v12M-4-4v12M8-4v12M14-4v12" />
      <ellipse class="goat-body" cx="0" cy="-12" rx="18" ry="11" />
      <path class="goat-neck" d="M10-16q6-12 12-16l4 8q-6 4-8 12z" />
      <ellipse class="goat-head" cx="26" cy="-30" rx="8" ry="7" />
      <path class="goat-horn" d="M22-36q-6-10 2-12M28-36q2-10 8-8" />
      <path class="goat-beard" d="M28-24l2 8 3-8z" />
      <circle class="eye" cx="29" cy="-31" r="1.2" />
      <path class="cap" d="M18-38h16l-2-6H20z" />
      <path class="cap-brim" d="M30-38h8" />
    </g>
  </svg>`,
  styleUrl: './gondola-platform.css',
})
export class GondolaPlatform {
  readonly frame = input.required<GondolaFrame>();

  private static count = 0;
  protected readonly id = `gondola-${GondolaPlatform.count++}`;
  protected readonly cable = CABLE;
  protected readonly trees = [
    'M18 238l10-22 10 22z',
    'M300 214l9-20 9 20z',
    'M330 206l8-18 8 18z',
    'M190 178l8-18 8 18z',
    'M160 198l9-20 9 20z',
  ];

  protected readonly layout = computed(() => sceneLayout(this.frame()));

  protected readonly houses = computed(() =>
    Array.from({ length: Math.min(12, this.frame().village) }, (_, index) => ({
      key: index,
      x: 352 + (index % 6) * 21,
      y: 54 + Math.floor(index / 6) * 18 - (index % 2) * 3,
      color: CABIN_COLORS[index % CABIN_COLORS.length],
    })),
  );

  protected readonly lanterns = computed(() => {
    const lit = this.frame().lanterns;
    return Array.from({ length: 10 }, (_, index) => {
      const t = 0.15 + index * 0.085;
      return { x: 120 + t * 230 + (index % 2) * 10, y: 236 - t * 190, lit: index < lit };
    });
  });

  protected readonly cabins = computed(() => {
    const frame = this.frame();
    const layout = this.layout();
    const views: CabinView[] = [];
    const numbers = frame.representation === 'numbers';
    const look: CabinView['look'] = numbers ? 'number' : frame.tarp ? 'tarp' : 'seats';
    const cabin = (
      key: string,
      x: number,
      y: number,
      w: number,
      count: number,
      color: string,
      extra: Partial<CabinView> = {},
    ): CabinView => {
      const h = w * 0.66;
      return {
        key,
        x,
        y,
        w,
        h,
        color,
        look,
        count,
        seats: seatsFor(x, y, w, h, count),
        golden: false,
        pulse: false,
        glow: false,
        ...extra,
      };
    };
    // Full "10" cabins up the cable, the newest ones golden-edged.
    const up = Math.min(layout.up, 9);
    for (let index = 0; index < up; index++) {
      const spot = along(0.42 + index * 0.065);
      views.push({
        ...cabin(`up-${index}`, spot.x - 14, spot.y + 6, 28, 10, CABIN_COLORS[index % 6]),
        look: 'ten',
        golden: index >= up - layout.freshUp || frame.golden,
        pulse: frame.help === 'pulse',
      });
    }
    // Cabins sent down slide off to the left.
    for (let index = 0; index < Math.min(layout.down, 3); index++) {
      views.push({
        ...cabin(`down-${index}`, 4 + index * 26, 228 - index * 14, 26, 10, '#8a5cc7'),
        look: 'ten',
      });
    }
    // Full cabins parked at the station: the group's tens, or the tens to take from. On a
    // bunny level the first full cabin to take from stands big in front, seats and all.
    const parked = Math.min(layout.parked, 6);
    const frontFull = frame.kind === 'sub' && !layout.moved && frame.representation === 'bunnies';
    for (let index = 0; index < parked; index++) {
      if (frontFull && index === 0) {
        views.push(
          cabin('front', 96, 150, 128, 10, CABIN_COLORS[frame.turn % 6], {
            pulse: frame.help === 'pulse',
          }),
        );
        continue;
      }
      views.push({
        ...cabin(
          `park-${index}`,
          300 + (index % 3) * 34,
          196 - Math.floor(index / 3) * 28,
          30,
          10,
          CABIN_COLORS[(index + 2) % 6],
        ),
        look: 'ten',
        pulse: frame.help === 'pulse',
      });
    }
    // The boarding cabin (adding) or the opened full cabin (taking away), big in front.
    const front = layout.boarding ?? layout.opened;
    if (front !== null) {
      const width = frame.big ? 140 : 128;
      views.push(
        cabin(
          'front',
          96,
          150 - (width - 128) * 0.66,
          width,
          front,
          frame.golden ? '#ffcf33' : CABIN_COLORS[frame.turn % 6],
          {
            golden: frame.golden,
            pulse: frame.help === 'pulse',
            glow: frame.help === 'seats',
          },
        ),
      );
    }
    return views;
  });

  protected readonly bunnies = computed(() => {
    const frame = this.frame();
    const layout = this.layout();
    const views: BunnyView[] = [];
    if (frame.representation === 'numbers' || frame.tarp) {
      // Numbers only: the waiting group and loose bunnies are still shown as a number tag
      // in the DOM controls, so the picture keeps just the cabins.
      return views;
    }
    const line = (count: number, from: number, prefix: string, splitAt = -1, crown = -1) => {
      for (let index = 0; index < count; index++) {
        const gap = splitAt > 0 && index >= splitAt ? 14 : 0;
        views.push({
          key: `${prefix}-${index}`,
          x: from + index * 22 + gap,
          y: 284,
          first: index < splitAt,
          crown: index === crown,
          away: false,
        });
      }
    };
    if (layout.waiting) line(layout.waiting, 236, 'wait', frame.split, frame.vip ? 0 : -1);
    if (layout.loose) line(layout.loose, 236, 'loose', -1, frame.vip ? 0 : -1);
    for (let index = 0; index < layout.hopped; index++) {
      views.push({
        key: `hop-${index}`,
        x: 120 + index * 22,
        y: 284,
        first: false,
        crown: false,
        away: true,
      });
    }
    return views;
  });
}
