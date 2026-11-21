import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DialBox, dialBox } from './clock-frame';
import {
  handAngles,
  hourAtAngle,
  minuteAtAngle,
  setHourHand,
  turnMinuteHand,
  wrapDial,
} from './clock-time';

type Hand = 'hour' | 'minute';

/**
 * The hands' handles, laid exactly over the clock face of the scene below (3D or flat). Each
 * hand is a slider: drag it round, or focus it and use the arrow keys (Page keys jump a quarter
 * or three hours). The minute hand carries the hour hand along like a real clock. It never
 * decides anything: it reports the new dial position and the game keeps it.
 */
@Component({
  selector: 'app-clock-dial',
  template: `<svg
    [attr.width]="box().size"
    [attr.height]="box().size"
    [style.left.px]="box().left"
    [style.top.px]="box().top"
    viewBox="-100 -100 200 200"
    (pointerdown)="grab($event)"
    (pointermove)="drag($event)"
    (pointerup)="release($event)"
    (pointercancel)="release($event)"
  >
    <circle class="pad" r="98" />
    <g
      class="handle hour"
      [class.is-guided]="guided()"
      role="slider"
      tabindex="0"
      [attr.aria-label]="hourLabel()"
      aria-valuemin="1"
      aria-valuemax="12"
      [attr.aria-valuenow]="hourValue()"
      [attr.aria-valuetext]="valueText()"
      [attr.aria-disabled]="disabled() || null"
      (keydown)="key($event, 'hour')"
    >
      <circle class="focus-ring" [attr.cx]="hourTip().x" [attr.cy]="hourTip().y" r="15" />
      <circle class="knob" [attr.cx]="hourTip().x" [attr.cy]="hourTip().y" r="8" />
    </g>
    <g
      class="handle minute"
      [class.is-guided]="guided()"
      role="slider"
      tabindex="0"
      [attr.aria-label]="minuteLabel()"
      aria-valuemin="0"
      aria-valuemax="59"
      [attr.aria-valuenow]="minuteValue()"
      [attr.aria-valuetext]="valueText()"
      [attr.aria-disabled]="disabled() || null"
      (keydown)="key($event, 'minute')"
    >
      <circle class="focus-ring" [attr.cx]="minuteTip().x" [attr.cy]="minuteTip().y" r="15" />
      <circle class="knob" [attr.cx]="minuteTip().x" [attr.cy]="minuteTip().y" r="8" />
    </g>
  </svg>`,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
    }
    svg {
      position: absolute;
      overflow: visible;
      pointer-events: auto;
      touch-action: none;
      cursor: grab;
    }
    svg:active {
      cursor: grabbing;
    }
    .pad {
      fill: transparent;
    }
    .handle {
      outline: none;
    }
    .focus-ring {
      fill: transparent;
      stroke: transparent;
      stroke-width: 4;
    }
    .knob {
      fill: #fffdf5;
      stroke: #2a2350;
      stroke-width: 3;
      opacity: 0.9;
    }
    .minute .knob {
      fill: #ffcf33;
    }
    .handle:focus-visible .focus-ring {
      stroke: var(--focus);
      fill: #ffffff55;
    }
    .handle.is-guided .focus-ring {
      stroke: var(--gold);
      stroke-width: 5;
    }
    @media (prefers-reduced-motion: no-preference) {
      .handle.is-guided .focus-ring {
        animation: halo 1.1s ease-in-out infinite;
        transform-box: fill-box;
        transform-origin: center;
      }
    }
    @keyframes halo {
      50% {
        transform: scale(1.25);
        opacity: 0.6;
      }
    }
    :host-context(.calm-motion) .handle.is-guided .focus-ring {
      animation: none;
    }
  `,
})
export class ClockDial {
  /** Where the hands point now (minutes on the 12-hour face). */
  readonly dial = input.required<number>();
  /** Minute steps for keys and dragging: 5, or 1 on the to-the-minute level. */
  readonly step = input<1 | 5>(5);
  readonly disabled = input(false);
  /** The first times on a device: the handles wear a gold halo. */
  readonly guided = input(false);
  readonly hourLabel = input.required<string>();
  readonly minuteLabel = input.required<string>();
  /** The time the hands show, worded for screen readers. */
  readonly valueText = input.required<string>();
  readonly dialChange = output<number>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly size = signal({ width: 0, height: 0 });
  protected readonly box = computed<DialBox>(() => {
    const { width, height } = this.size();
    return dialBox(width, height);
  });
  private readonly angles = computed(() => handAngles(this.dial()));
  protected readonly hourTip = computed(() => tip(this.angles().hour, 52));
  protected readonly minuteTip = computed(() => tip(this.angles().minute, 80));
  protected readonly hourValue = computed(() => Math.floor(wrapDial(this.dial()) / 60) || 12);
  protected readonly minuteValue = computed(() => wrapDial(this.dial()) % 60);
  private dragging: Hand | null = null;

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const measure = () =>
        this.size.set({ width: this.host.clientWidth, height: this.host.clientHeight });
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(measure);
      observer.observe(this.host);
      destroy.onDestroy(() => observer.disconnect());
    });
  }

  protected key(event: KeyboardEvent, hand: Hand) {
    if (this.disabled()) return;
    const step = hand === 'minute' ? this.step() : 60;
    const big = hand === 'minute' ? 15 : 180;
    const moves: Record<string, number> = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: big,
      PageDown: -big,
    };
    const dial = wrapDial(this.dial());
    let next: number | null = event.key in moves ? wrapDial(dial + moves[event.key]) : null;
    if (event.key === 'Home') next = hand === 'minute' ? dial - (dial % 60) : dial % 60;
    if (next === null) return;
    event.preventDefault();
    this.dialChange.emit(next);
  }

  protected grab(event: PointerEvent) {
    if (this.disabled()) return;
    const point = this.point(event);
    if (!point) return;
    const minute = this.minuteTip();
    const hour = this.hourTip();
    const near = (p: { x: number; y: number }) => Math.hypot(point.x - p.x, point.y - p.y);
    // The hand whose tip is closer, or the long hand when the touch is far out on the face.
    this.dragging =
      near(hour) < near(minute) && Math.hypot(point.x, point.y) < 66 ? 'hour' : 'minute';
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.host
      .querySelector<SVGGElement>(`.handle.${this.dragging}`)
      ?.focus({ preventScroll: true });
    event.preventDefault();
    this.drag(event);
  }

  protected drag(event: PointerEvent) {
    if (!this.dragging || this.disabled()) return;
    const point = this.point(event);
    if (!point || Math.hypot(point.x, point.y) < 8) return;
    const degrees = (Math.atan2(point.x, -point.y) * 180) / Math.PI;
    const dial = wrapDial(this.dial());
    const next =
      this.dragging === 'minute'
        ? turnMinuteHand(dial, minuteAtAngle(degrees, this.step()))
        : setHourHand(dial, hourAtAngle(degrees));
    if (next !== dial) this.dialChange.emit(next);
  }

  protected release(event: PointerEvent) {
    this.dragging = null;
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
  }

  /** The pointer in the face's own units: centre 0,0, radius 100. */
  private point(event: PointerEvent) {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * 200 - 100,
      y: ((event.clientY - rect.top) / rect.height) * 200 - 100,
    };
  }
}

function tip(degrees: number, length: number) {
  const radians = (degrees * Math.PI) / 180;
  return { x: Math.sin(radians) * length, y: -Math.cos(radians) * length };
}
