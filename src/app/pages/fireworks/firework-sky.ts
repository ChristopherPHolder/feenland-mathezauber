import { Component, computed, input } from '@angular/core';
import { FireworkFrame } from './firework-frame';
import { Flick, FlickPose } from './firework-flick';
import { Box, HUES, Pattern, Point } from './firework-levels';
import { shapePath } from './firework-shapes';

/** Margin around the pattern inside the burst area, in spark units. */
const MARGIN = 0.9;
const STAR = 'M0-.42L.12-.13.4-.13.18.05.26.34 0 .17-.26.34-.18.05-.4-.13-.12-.13Z';

/** Where the show's fireworks burst, in percent of the sky. */
const SHOW_SPOTS = [
  [22, 30],
  [74, 26],
  [48, 18],
  [32, 52],
  [66, 50],
  [12, 14],
  [88, 12],
  [50, 42],
  [16, 40],
  [84, 40],
  [38, 10],
  [62, 12],
  [50, 60],
] as const;

/**
 * The firework show drawn flat: a dusk sky over the lake, a lantern-lit town, the crowd on the
 * shore and Flick on the jetty, with the spark pattern bursting in the sky. It is the picture on
 * the intro and the whole scene wherever 3D is missing, so it keeps the game's timing: the burst
 * glows up, holds for the look and dims away. Decorative only; the game's controls and live text
 * carry the same information.
 */
@Component({
  selector: 'app-firework-sky',
  imports: [Flick],
  templateUrl: './firework-sky.html',
  styleUrl: './firework-sky.css',
  host: {
    'aria-hidden': 'true',
    '[attr.data-phase]': 'frame().phase',
    '[class.is-big-show]': 'frame().bigShow',
    '[class.is-finale]': 'frame().finale',
    '[style.--hue]': 'hue()',
    '[style.--look]': 'frame().look + "s"',
  },
})
export class FireworkSky {
  readonly frame = input.required<FireworkFrame>();

  protected readonly hue = computed(() => HUES[this.frame().pattern.hue]);
  protected readonly hues = HUES;
  /** One element per burst, so a new burst (a peek, a try again) glows up afresh. */
  protected readonly burstKey = computed(() => [`${this.frame().firework}-${this.frame().bursts}`]);
  protected readonly viewBox = computed(() => {
    const box = bounds(this.frame().pattern);
    return `${box.left} ${-box.top} ${box.right - box.left} ${box.top - box.bottom}`;
  });
  protected readonly star = STAR;
  protected readonly pose = computed<FlickPose>(() => {
    const { phase } = this.frame();
    return phase === 'launch'
      ? 'light'
      : phase === 'fizzle'
        ? 'duck'
        : phase === 'bloom' || phase === 'show'
          ? 'cheer'
          : 'stand';
  });
  protected readonly showBursts = computed(() =>
    this.frame().launched.map((hue, index) => ({
      color: HUES[hue],
      x: SHOW_SPOTS[index % SHOW_SPOTS.length][0],
      y: SHOW_SPOTS[index % SHOW_SPOTS.length][1],
      delay: `${(index * 0.28).toFixed(2)}s`,
    })),
  );
  protected readonly shapePath = computed(() => shapePath(this.frame().shape));

  protected boxTransform(box: Box) {
    return `translate(${box.x} ${-box.y}) rotate(${(-box.angle * 180) / Math.PI})`;
  }
  protected at(point: Point) {
    return `translate(${point.x} ${-point.y})`;
  }
  protected shapeOf(pattern: Pattern, burst: 0 | 1) {
    return pattern.shapes[burst];
  }
}

/** The pattern's extent with a margin, in spark units (y up). */
function bounds(pattern: Pattern) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of [...pattern.sparks, ...pattern.empty]) {
    xs.push(p.x);
    ys.push(p.y);
  }
  for (const box of [...pattern.frames, ...pattern.groups]) {
    const c = Math.abs(Math.cos(box.angle));
    const s = Math.abs(Math.sin(box.angle));
    const hw = (box.w * c + box.h * s) / 2;
    const hh = (box.w * s + box.h * c) / 2;
    xs.push(box.x - hw, box.x + hw);
    ys.push(box.y - hh, box.y + hh);
  }
  return {
    left: Math.min(...xs) - MARGIN,
    right: Math.max(...xs) + MARGIN,
    bottom: Math.min(...ys) - MARGIN,
    top: Math.max(...ys) + MARGIN,
  };
}
