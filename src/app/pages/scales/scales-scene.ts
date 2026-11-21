import { Component, computed, input } from '@angular/core';
import { ITEM_ART } from './scales-art';
import { PanThing, ScalesFrame, stackPan } from './scales-frame';
import { dialAngle, dialMarks, dialPoint } from './scales-math';

/** Where the beam turns, how long its arms are and how far the pans hang below it. */
const PIVOT = { x: 200, y: 108 };
const ARM = 128;
const DROP = 66;
/** Pans are 112 wide; things are laid out on a 100-wide pan. */
const PAN_SCALE = 1.12;
const DIAL = { x: 200, y: 182, r: 84 };
const POT = { x: 290, top: 92, bottom: 262, width: 140 };

/**
 * Bramble's kitchen as a flat picture: the brass balance whose beam tips with a springy ease,
 * the kitchen scale with its dial, or the glass pot and jugs. It is the 2D fallback under the
 * 3D world and the stage of the demo film. It only draws the frame it is given.
 */
@Component({
  selector: 'app-scales-scene',
  templateUrl: './scales-scene.html',
  styleUrl: './scales-scene.css',
  host: { 'aria-hidden': 'true' },
})
export class ScalesScene {
  readonly frame = input.required<ScalesFrame>();
  /** The film turns off the springy ease so its steps land on time. */
  readonly quick = input(false);

  protected readonly pivot = PIVOT;
  protected readonly arm = ARM;
  protected readonly drop = DROP;
  protected readonly art = ITEM_ART;
  protected readonly dialBox = DIAL;
  protected readonly potBox = POT;
  protected readonly Math = Math;

  /** SVG turns clockwise for positive angles, and positive tilt lowers the left pan. */
  protected readonly degrees = computed(() => (-this.frame().tilt * 180) / Math.PI);
  protected readonly leftPan = computed(() => this.placeOn(this.frame().left));
  protected readonly rightPan = computed(() => this.placeOn(this.frame().right));

  protected readonly marks = computed(() => {
    const view = this.frame().dial;
    if (!view) return [];
    let label = 0;
    return dialMarks(view.dial).map((mark) => {
      const inner = dialPoint(
        DIAL.x,
        DIAL.y,
        DIAL.r - (mark.labelled ? 16 : mark.half ? 12 : 8),
        mark.angle,
      );
      const outer = dialPoint(DIAL.x, DIAL.y, DIAL.r - 2, mark.angle);
      const text = dialPoint(DIAL.x, DIAL.y, DIAL.r - 30, mark.angle);
      return {
        ...mark,
        inner,
        outer,
        text,
        label: mark.labelled ? (view.labels[label++] ?? '') : '',
      };
    });
  });
  protected readonly needle = computed(() => {
    const view = this.frame().dial;
    return view ? dialAngle(view.dial, view.value) : -135;
  });

  protected readonly pot = computed(() => {
    const view = this.frame().pot;
    if (!view) return null;
    const inner = POT.bottom - POT.top - 14;
    const height = (amount: number) => (inner * Math.min(amount, view.capacity)) / view.capacity;
    return {
      ...view,
      water: height(view.filled),
      lineY: POT.bottom - 6 - height(view.target),
      over: view.filled > view.target,
    };
  });

  /** Jugs stand in a row to the left of the pot, biggest first. */
  protected readonly jugs = computed(() => {
    const view = this.frame().pot;
    if (!view) return [];
    const biggest = Math.max(...view.jugs.map((jug) => jug.amount));
    return view.jugs.map((jug, index) => {
      const scale = 0.55 + 0.45 * Math.sqrt(jug.amount / biggest);
      return { ...jug, x: 40 + index * 62, scale, tipped: jug.amount === view.lastJug };
    });
  });

  private placeOn(things: readonly PanThing[]) {
    const placed = stackPan(things);
    return things.map((thing, index) => ({
      thing,
      x: placed[index].x * PAN_SCALE,
      // The pan's floor is DROP below the beam; things stand on it and on each other.
      y: DROP - 2 - placed[index].y * PAN_SCALE,
      w: placed[index].w * PAN_SCALE,
      h: placed[index].h * PAN_SCALE,
    }));
  }
}
