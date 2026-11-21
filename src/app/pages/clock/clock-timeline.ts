import { Component, computed, input } from '@angular/core';

/**
 * The empty time line after a wrong "how long?": the start, the full hours on the way and the
 * end, with a hop arc between each stop and a "?" on every hop. The hops are drawn to scale, but
 * their lengths are never written, so the child still adds them up.
 */
@Component({
  selector: 'app-clock-timeline',
  template: `<svg viewBox="0 0 320 78" role="img" [attr.aria-label]="label()">
    <line class="line" x1="12" y1="58" x2="308" y2="58" />
    @for (hop of hops(); track $index) {
      <path class="hop" [attr.d]="hop.path" />
      <g [attr.transform]="'translate(' + hop.mid + ' ' + hop.top + ')'">
        <circle class="gap" r="10" />
        <text class="gap-text" y="5">?</text>
      </g>
    }
    @for (stop of points(); track $index) {
      <circle class="stop" [class.end]="$last" [attr.cx]="stop.x" cy="58" r="5" />
      <text class="stop-text" [attr.x]="stop.x" y="76">{{ stop.label }}</text>
    }
  </svg>`,
  styles: `
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .line {
      stroke: #9bb3cc;
      stroke-width: 3;
      stroke-linecap: round;
    }
    .hop {
      fill: none;
      stroke: var(--sky-deep);
      stroke-width: 2.5;
      stroke-dasharray: 5 4;
    }
    .gap {
      fill: var(--paper);
      stroke: var(--sky-deep);
      stroke-width: 2;
    }
    .gap-text {
      font: 600 15px var(--font-sans);
      fill: var(--sky-deep);
      text-anchor: middle;
    }
    .stop {
      fill: var(--sky-deep);
    }
    .stop.end {
      fill: var(--pink);
    }
    .stop-text {
      font: 600 13px var(--font-sans);
      fill: var(--ink);
      text-anchor: middle;
    }
  `,
})
export class ClockTimeline {
  /** Every stop as minutes from the start, the start (0) and the end included. */
  readonly stops = input.required<readonly number[]>();
  /** The stops' times, already written ("3:40", "4:00", "4:15"). */
  readonly labels = input.required<readonly string[]>();
  readonly label = input.required<string>();

  protected readonly points = computed(() => {
    const stops = this.stops();
    const total = Math.max(1, stops.at(-1) ?? 1);
    // Short hops still get room for their "?" bubble.
    const min = 0.16;
    const shares = stops
      .slice(1)
      .map((stop, index) => Math.max(min, (stop - stops[index]) / total));
    const sum = shares.reduce((a, b) => a + b, 0);
    let x = 24;
    const points = [{ x, label: this.labels()[0] ?? '' }];
    shares.forEach((share, index) => {
      x += (share / sum) * 272;
      points.push({ x, label: this.labels()[index + 1] ?? '' });
    });
    return points;
  });
  protected readonly hops = computed(() => {
    const points = this.points();
    return points.slice(1).map((point, index) => {
      const from = points[index].x;
      const mid = (from + point.x) / 2;
      const top = 58 - Math.min(40, (point.x - from) * 0.45 + 12);
      return { path: `M${from} 54 Q${mid} ${top - 10} ${point.x} 54`, mid, top: top - 2 };
    });
  });
}
