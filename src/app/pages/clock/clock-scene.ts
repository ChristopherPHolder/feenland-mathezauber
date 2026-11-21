import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { BRONZE, ClockFrame, CRITTERS, dialBox, FACE, GOLD, INK, skyAt } from './clock-frame';
import { handAngles } from './clock-time';

const NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);
const TICKS = Array.from({ length: 60 }, (_, index) => index);
const STARS = [
  [0.08, 0.1],
  [0.2, 0.22],
  [0.33, 0.07],
  [0.7, 0.12],
  [0.84, 0.25],
  [0.93, 0.08],
  [0.12, 0.4],
  [0.9, 0.42],
] as const;

/**
 * The flat clock tower, for devices without WebGL and for tests: the sky of the hour, the
 * village below with its lit windows, the tower with its bell, the face with both hands where
 * the frame says, and the balcony friends. The face sits where `dialBox` puts it, so the hand
 * handles line up with it exactly like they do over the 3D tower.
 */
@Component({
  selector: 'app-clock-scene',
  template: `<svg
    class="scene"
    [attr.viewBox]="'0 0 ' + w() + ' ' + h()"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient [attr.id]="'sky-' + uid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" [attr.stop-color]="sky().top" />
        <stop offset="1" [attr.stop-color]="sky().horizon" />
      </linearGradient>
    </defs>
    <rect [attr.width]="w()" [attr.height]="h()" [attr.fill]="'url(#sky-' + uid + ')'" />
    @if (sky().stars > 0) {
      @for (star of stars; track $index) {
        <circle
          class="star"
          [attr.cx]="star[0] * w()"
          [attr.cy]="star[1] * h()"
          r="2"
          [attr.opacity]="sky().stars"
        />
      }
    }
    <!-- The village below -->
    <path class="hill" [attr.d]="hill()" />
    @for (house of houses(); track house.i) {
      <g [attr.transform]="'translate(' + house.x + ' ' + house.y + ')'">
        <rect x="-14" y="-16" width="28" height="18" rx="2" class="house" />
        <path d="M-17 -16 0 -30 17 -16z" class="roof" [style.fill]="house.roof" />
        <rect x="-5" y="-11" width="10" height="8" rx="1" class="window" [class.lit]="house.lit" />
      </g>
    }
    <!-- The tower -->
    <rect
      class="tower"
      [attr.x]="box().left - box().size * 0.18"
      [attr.y]="box().top - box().size * 0.12"
      [attr.width]="box().size * 1.36"
      [attr.height]="h()"
      rx="10"
    />
    <path class="roof-top" [attr.d]="towerRoof()" />
    <g
      class="bell"
      [class.ring-a]="frame().rings % 2 === 1"
      [class.ring-b]="frame().rings > 0 && frame().rings % 2 === 0"
      [attr.transform]="'translate(' + cx() + ' ' + (box().top - box().size * 0.2) + ')'"
    >
      <path d="M-12 8q0-18 12-18t12 18l4 4h-32z" />
      <circle cy="13" r="3" />
    </g>
    <!-- The face -->
    <g [attr.transform]="'translate(' + cx() + ' ' + cy() + ') scale(' + r() / 100 + ')'">
      @if (frame().golden) {
        <circle class="glow" r="112" />
      }
      <circle class="rim" r="104" />
      <circle class="face" r="96" />
      @for (tick of ticks; track tick) {
        <line
          class="tick"
          [class.five]="tick % 5 === 0"
          y1="-92"
          [attr.y2]="tick % 5 === 0 ? -82 : -87"
          [attr.transform]="'rotate(' + tick * 6 + ')'"
        />
      }
      @for (n of numbers; track n) {
        <text
          class="number"
          [attr.x]="70 * sin(n * 30)"
          [attr.y]="-70 * cos(n * 30) + 8"
          text-anchor="middle"
        >
          {{ n }}
        </text>
      }
      @if (frame().help === 'fives') {
        @for (n of numbers; track n) {
          <circle
            class="five-light"
            [attr.cx]="88 * sin(n * 30)"
            [attr.cy]="-88 * cos(n * 30)"
            r="7"
            [style.--i]="n"
          />
        }
      }
      <g
        class="hour-hand"
        [class.pulse]="frame().help === 'hour'"
        [attr.transform]="'rotate(' + angles().hour + ')'"
      >
        <path d="M-7 10 0 -50 7 10z" />
      </g>
      <g class="minute-hand" [attr.transform]="'rotate(' + angles().minute + ')'">
        <path d="M-4.5 12 0 -84 4.5 12z" />
      </g>
      <circle class="pin" r="7" />
    </g>
    <!-- The balcony -->
    <rect
      class="balcony"
      [attr.x]="box().left - box().size * 0.22"
      [attr.y]="rail()"
      [attr.width]="box().size * 1.44"
      height="7"
      rx="3"
    />
    @for (friend of balcony(); track friend.id) {
      <g
        class="friend"
        [class.arriving]="friend.arriving"
        [attr.transform]="'translate(' + friend.x + ' ' + (rail() - 2) + ')'"
      >
        <ellipse [attr.fill]="friend.body" rx="10" ry="9" cy="-9" />
        <circle fill="#fff" cx="-3.5" cy="-11" r="2.6" />
        <circle fill="#fff" cx="3.5" cy="-11" r="2.6" />
        <circle [attr.fill]="ink" cx="-3.5" cy="-11" r="1.3" />
        <circle [attr.fill]="ink" cx="3.5" cy="-11" r="1.3" />
        <circle [attr.fill]="friend.accent" cy="-6" r="2" />
      </g>
    }
    <!-- Pip on the perch -->
    <g
      class="pip"
      [attr.transform]="
        'translate(' + (box().left + box().size * 1.14) + ' ' + (cy() + box().size * 0.12) + ')'
      "
    >
      <ellipse rx="14" ry="17" fill="#8a6bc8" />
      <ellipse cy="5" rx="9" ry="10" fill="#e9dcff" />
      <circle cx="-5.5" cy="-7" r="5.5" fill="#fff" />
      <circle cx="5.5" cy="-7" r="5.5" fill="#fff" />
      <circle cx="-5.5" cy="-7" r="2.6" [attr.fill]="ink" />
      <circle cx="5.5" cy="-7" r="2.6" [attr.fill]="ink" />
      <path d="M-2 -2h4l-2 4z" fill="#ffb347" />
      <path d="M-12 -14l3 6 3-5zM12 -14l-3 6-3-5z" fill="#8a6bc8" />
    </g>
  </svg>`,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      display: block;
    }
    .scene {
      display: block;
      width: 100%;
      height: 100%;
    }
    .star {
      fill: #fff6c4;
    }
    .hill {
      fill: #4f7d5a;
    }
    .house {
      fill: #f4e6cf;
    }
    .window {
      fill: #5a5560;
    }
    .window.lit {
      fill: #ffd84a;
    }
    .tower {
      fill: #e8d3b4;
      stroke: #b99a72;
      stroke-width: 2;
    }
    .roof-top {
      fill: #7a5ac0;
    }
    .bell {
      fill: ${BRONZE};
      transform-box: fill-box;
    }
    .glow {
      fill: ${GOLD};
      opacity: 0.45;
    }
    .rim {
      fill: ${BRONZE};
    }
    .face {
      fill: ${FACE};
    }
    .tick {
      stroke: ${INK};
      stroke-width: 1.5;
    }
    .tick.five {
      stroke-width: 3.5;
    }
    .number {
      font: 600 19px var(--font-sans);
      fill: ${INK};
    }
    .five-light {
      fill: ${GOLD};
      opacity: 0;
    }
    .hour-hand path {
      fill: ${INK};
    }
    .minute-hand path {
      fill: #3d3470;
    }
    .pin {
      fill: ${GOLD};
      stroke: ${INK};
      stroke-width: 2;
    }
    .balcony {
      fill: #9c7a52;
    }
    @media (prefers-reduced-motion: no-preference) {
      .five-light {
        animation: chase 2.4s linear infinite;
        animation-delay: calc(var(--i) * 0.2s);
      }
      .hour-hand.pulse path {
        animation: pulse 0.9s ease-in-out infinite;
      }
      .friend.arriving {
        animation: fly-in 1.2s ease-out both;
      }
    }
    .five-light {
      opacity: 0.85;
    }
    @media (prefers-reduced-motion: no-preference) {
      .five-light {
        opacity: 0;
      }
    }
    .hour-hand.pulse path {
      fill: #e2467c;
    }
    @keyframes chase {
      0%,
      100% {
        opacity: 0;
      }
      4% {
        opacity: 1;
      }
      12% {
        opacity: 0;
      }
    }
    @keyframes pulse {
      50% {
        fill: #ff8fb8;
      }
    }
    @keyframes fly-in {
      from {
        translate: 0 -80px;
        opacity: 0;
      }
    }
    :host-context(.calm-motion) .five-light {
      animation: none;
      opacity: 0.85;
    }
    :host-context(.calm-motion) .hour-hand.pulse path,
    :host-context(.calm-motion) .friend.arriving {
      animation: none;
    }
  `,
})
export class ClockScene {
  readonly frame = input.required<ClockFrame>();
  protected readonly uid = Math.random().toString(36).slice(2, 8);
  protected readonly numbers = NUMBERS;
  protected readonly ticks = TICKS;
  protected readonly stars = STARS;
  protected readonly ink = INK;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly size = signal({ width: 400, height: 300 });
  protected readonly w = computed(() => this.size().width);
  protected readonly h = computed(() => this.size().height);
  protected readonly box = computed(() => dialBox(this.w(), this.h()));
  protected readonly cx = computed(() => this.box().left + this.box().size / 2);
  protected readonly cy = computed(() => this.box().top + this.box().size / 2);
  protected readonly r = computed(() => this.box().size / 2);
  protected readonly rail = computed(() => this.cy() + this.r() * 1.45);
  protected readonly sky = computed(() => skyAt(this.frame().sky));
  protected readonly angles = computed(() => handAngles(this.frame().dial));
  protected readonly hill = computed(() => {
    const w = this.w();
    const h = this.h();
    return `M0 ${h * 0.8} Q${w * 0.25} ${h * 0.7} ${w * 0.5} ${h * 0.78} T${w} ${h * 0.74} V${h} H0z`;
  });
  protected readonly towerRoof = computed(() => {
    const { left, top, size } = this.box();
    const y = top - size * 0.12;
    return `M${left - size * 0.24} ${y} L${left + size / 2} ${top - size * 0.62} L${left + size * 1.24} ${y}z`;
  });
  protected readonly houses = computed(() => {
    const w = this.w();
    const h = this.h();
    const lights = this.frame().lights;
    const roofs = ['#e2467c', '#3d8fe0', '#e89a1c', '#3fa65a', '#8a5cc7', '#1f9e95'];
    const xs = [0.07, 0.17, 0.27, 0.73, 0.83, 0.93, 0.12, 0.88, 0.22];
    return xs.map((x, i) => ({
      i,
      x: x * w,
      y: h * (i < 6 ? 0.86 : 0.97),
      roof: roofs[i % roofs.length],
      lit: i < lights,
    }));
  });
  protected readonly balcony = computed(() => {
    const frame = this.frame();
    const { left, size } = this.box();
    const friends = frame.friends.slice(-10);
    const span = size * 1.3;
    return friends.map((id, index) => ({
      id,
      x: left - size * 0.15 + ((index + 0.5) / Math.max(friends.length, 6)) * span,
      body: CRITTERS[id].body,
      accent: CRITTERS[id].accent,
      arriving: id === frame.arriving,
    }));
  });

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const measure = () => {
        const width = this.host.clientWidth;
        const height = this.host.clientHeight;
        if (width && height) this.size.set({ width, height });
      };
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(measure);
      observer.observe(this.host);
      destroy.onDestroy(() => observer.disconnect());
    });
  }

  protected sin(degrees: number) {
    return Math.sin((degrees * Math.PI) / 180);
  }
  protected cos(degrees: number) {
    return Math.cos((degrees * Math.PI) / 180);
  }
}
