import { Component, computed, input } from '@angular/core';
import { capColor, DrumFrame, stepLabel } from './drum-frame';

/** Slots on the flat path: one mushroom behind Pom, his own, and three ahead. */
const BEHIND = 1;
const AHEAD = 3;
const SLOT_X = (slot: number) => 70 + slot * 90;
const SLOT_Y = (slot: number) => 190 - (slot % 2) * 26;

interface Slot {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly color: string;
  readonly text: string;
  readonly ask: boolean;
  readonly solo: boolean;
}

/**
 * The flat mushroom path: the 2D picture of the drums for devices without WebGL, and while the
 * 3D forest loads. Pom stands on his drum-mushroom, the next one glows with a "?" and a
 * countdown ring that fills with the beat, and the step arc shows after a landing or a miss.
 * It only draws; the page decides everything.
 */
@Component({
  selector: 'app-drum-path',
  host: { 'aria-hidden': 'true', '[class.is-held]': 'frame().held || frame().paused' },
  template: `<svg viewBox="0 0 500 280" preserveAspectRatio="xMidYMid meet">
    <defs>
      <radialGradient id="drum-glow" cx="50%" cy="40%" r="60%">
        <stop offset="0" stop-color="#4b3f99" />
        <stop offset="1" stop-color="#17123a" />
      </radialGradient>
    </defs>
    <rect width="500" height="280" fill="url(#drum-glow)" />
    @for (spore of spores; track $index) {
      <circle class="spore" [attr.cx]="spore[0]" [attr.cy]="spore[1]" [attr.r]="spore[2]" />
    }
    @if (arc(); as arc) {
      <path class="arc" [class.hint]="arc.hint" [attr.d]="arc.d" />
      <text class="arc-label" [attr.x]="arc.x" [attr.y]="arc.y">{{ arc.label }}</text>
    }
    @for (slot of slots(); track slot.index) {
      <g
        class="mushroom"
        [class.ask]="slot.ask"
        [attr.transform]="'translate(' + slot.x + ' ' + slot.y + ')'"
      >
        <path class="stem" d="M-12 0 Q-16 40 -10 70 H10 Q16 40 12 0 Z" />
        <path class="cap" [attr.fill]="slot.color" d="M-40 4 Q-40 -30 0 -32 Q40 -30 40 4 Z" />
        <ellipse class="skin" cx="0" cy="-30" rx="30" ry="9" />
        @if (slot.ask) {
          @for (ring of rings(); track ring.key) {
            <circle
              class="ring"
              r="36"
              cy="-8"
              pathLength="100"
              [style.animation-duration.s]="ring.duration"
              [style.animation-delay.s]="ring.delay"
            />
          }
        }
        <text class="number" y="-9">{{ slot.text }}</text>
      </g>
    }
    <g
      class="pom"
      [class.waiting]="frame().waiting"
      [style.transform]="pom().transform"
      [style.transition-duration.s]="pom().duration"
      [style.transition-delay.s]="pom().delay"
    >
      <g class="pom-body">
        <path
          class="spines"
          d="M-26 -8 L-34 -18 L-24 -22 L-28 -34 L-16 -32 L-14 -44 L-4 -38 L2 -48 L8 -38 L18 -42 L18 -30 L28 -30 L24 -18 L32 -12 L22 -6 Z"
        />
        <ellipse class="belly" cx="10" cy="-12" rx="18" ry="13" />
        <path class="snout" d="M22 -18 Q36 -16 40 -10 Q34 -6 24 -6 Z" />
        <circle class="nose" cx="40" cy="-10" r="3.2" />
        <circle class="eye" cx="24" cy="-17" r="2.4" />
        <circle class="feet" cx="0" cy="0" r="4" />
        <circle class="feet" cx="16" cy="0" r="4" />
      </g>
    </g>
  </svg>`,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .spore {
      fill: #c9f3ff;
      opacity: 0.6;
    }
    .stem {
      fill: #efe4cf;
    }
    .cap {
      stroke: #0004;
      stroke-width: 2;
    }
    .skin {
      fill: #fff8e8;
      stroke: #8a5a2b;
      stroke-width: 3;
    }
    /* The number sits on the cap's face, below Pom's feet, with a pale halo on every cap colour. */
    .number {
      font: 600 24px var(--font-sans);
      fill: #1d1844;
      stroke: #fff8e8;
      stroke-width: 5px;
      paint-order: stroke;
      text-anchor: middle;
      dominant-baseline: middle;
    }
    .ring {
      fill: none;
      stroke: #ffd23f;
      stroke-width: 5;
      stroke-linecap: round;
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      transform: rotate(-90deg);
      transform-box: fill-box;
      transform-origin: center;
      animation: fill-ring linear forwards;
    }
    :host(.is-held) .ring {
      animation-play-state: paused;
    }
    @keyframes fill-ring {
      to {
        stroke-dashoffset: 0;
      }
    }
    .arc {
      fill: none;
      stroke: #ffffffaa;
      stroke-width: 3;
      stroke-dasharray: 6 6;
    }
    .arc.hint {
      stroke: #ffd23f;
      stroke-width: 4;
    }
    .arc-label {
      font: 600 20px var(--font-sans);
      fill: #fff6bf;
      text-anchor: middle;
    }
    .pom {
      transition-property: transform;
      transition-timing-function: ease-in-out;
    }
    .spines {
      fill: #6b4a2e;
      stroke: #3d2816;
      stroke-width: 2;
      stroke-linejoin: round;
    }
    .belly,
    .snout {
      fill: #e9cfa5;
    }
    .nose,
    .eye {
      fill: #1b1208;
    }
    .feet {
      fill: #4a3220;
    }
    @media (prefers-reduced-motion: no-preference) {
      .pom.waiting .pom-body {
        animation: wobble 0.5s ease-in-out infinite alternate;
      }
    }
    .pom-body {
      transform-box: fill-box;
      transform-origin: 50% 100%;
    }
    @keyframes wobble {
      from {
        transform: rotate(-6deg);
      }
      to {
        transform: rotate(6deg);
      }
    }
    :host-context(.calm-motion) .pom.waiting .pom-body {
      animation: none;
    }
  `,
})
export class DrumPath {
  readonly frame = input.required<DrumFrame>();

  protected readonly spores = [
    [40, 40, 2],
    [130, 70, 1.5],
    [210, 30, 2.5],
    [300, 60, 1.5],
    [380, 25, 2],
    [460, 80, 1.5],
    [90, 120, 1.2],
    [430, 140, 1.8],
  ] as const;

  /** The window of mushrooms around Pom. */
  protected readonly slots = computed<Slot[]>(() => {
    const frame = this.frame();
    const slots: Slot[] = [];
    for (let slot = 0; slot <= BEHIND + AHEAD; slot++) {
      const index = frame.at - BEHIND + slot;
      const mushroom = frame.mushrooms[index];
      if (!mushroom) continue;
      const answered = index <= frame.at || index === frame.hop?.to;
      const ask = index === frame.ask;
      slots.push({
        index,
        x: SLOT_X(slot),
        y: SLOT_Y(slot),
        color: capColor(index, mushroom),
        text: ask ? '?' : mushroom.given || answered ? String(mushroom.value) : '',
        ask,
        solo: mushroom.solo,
      });
    }
    return slots;
  });

  /** A new ring element per question, so its fill animation starts from the beginning. */
  protected readonly rings = computed(() => {
    const frame = this.frame();
    if (!frame.ring || frame.held) return [];
    const duration = Math.max(0.1, frame.ring.end - frame.ring.start);
    return [{ key: frame.ring.start, duration, delay: frame.ring.start - frame.now() }];
  });

  /** Pom's spot; a hop slides him to the next mushroom over the hop's own time. */
  protected readonly pom = computed(() => {
    const frame = this.frame();
    const now = frame.now();
    const target = frame.hop ? frame.hop.to : frame.at;
    const slot = target - frame.at + BEHIND;
    const edge = frame.waiting ? 20 : 0;
    const transform = `translate(${SLOT_X(slot) - 12 + edge}px, ${SLOT_Y(slot) - 33}px)`;
    if (!frame.hop) return { transform, duration: 0, delay: 0 };
    const start = Math.max(now, frame.hop.start);
    return {
      transform,
      duration: Math.max(0.05, frame.hop.end - start),
      delay: Math.max(0, frame.hop.start - now),
    };
  });

  /** The step arc: after a miss towards the "?", during a jump over it, else over the last jump. */
  protected readonly arc = computed(() => {
    const frame = this.frame();
    const slot = (index: number) => index - frame.at + BEHIND;
    if (frame.stepHint && frame.ask !== null) {
      return this.arcBetween(slot(frame.ask - 1), slot(frame.ask), frame.stepHint, true);
    }
    const to = frame.hop ? frame.hop.to : frame.at;
    const mushroom = frame.mushrooms[to];
    if (!mushroom || mushroom.fresh || to === 0) return null;
    return this.arcBetween(slot(to - 1), slot(to), stepLabel(mushroom.step), false);
  });

  private arcBetween(a: number, b: number, label: string, hint: boolean) {
    const x1 = SLOT_X(a);
    const x2 = SLOT_X(b);
    const y1 = SLOT_Y(a) - 48;
    const y2 = SLOT_Y(b) - 48;
    const mid = (x1 + x2) / 2;
    const top = Math.min(y1, y2) - 46;
    return { d: `M${x1} ${y1} Q${mid} ${top} ${x2} ${y2}`, x: mid, y: top + 14, label, hint };
  }
}
