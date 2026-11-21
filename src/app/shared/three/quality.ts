/** One rung of render quality: how many canvas pixels per CSS pixel, and the shadow map scale. */
export interface QualityLevel {
  readonly pixelRatio: number;
  /** Share of the world's own shadow map size; 1 is full, 0.5 half as many texels each way. */
  readonly shadowScale: number;
}

/**
 * The rungs from best to cheapest for a screen: retina sharpness (capped at 2, which looks the
 * same as 3 on a tablet at a fraction of the cost), then steps down to 1, then a smaller shadow
 * map for worlds with shadows. Never below 1 pixel per CSS pixel, which would look blurry.
 */
export function qualityLevels(devicePixelRatio: number, shadows: boolean): QualityLevel[] {
  const top = Math.min(Math.max(devicePixelRatio || 1, 0.5), 2);
  const ratios = [top, ...[1.5, 1.25, 1].filter((ratio) => ratio < top - 0.01)];
  const levels = ratios.map((pixelRatio) => ({ pixelRatio, shadowScale: 1 }));
  if (shadows) levels.push({ pixelRatio: ratios.at(-1)!, shadowScale: 0.5 });
  return levels;
}

export interface GovernorOptions {
  /** Frames slower than this on average (seconds) count as struggling: below ~45 fps. */
  readonly slow?: number;
  /** Frames faster than this on average count as headroom: above ~55 fps. */
  readonly fast?: number;
  /** Seconds of frames averaged before each decision. */
  readonly window?: number;
  /** Seconds ignored at the start, while shaders compile and textures upload. */
  readonly warmup?: number;
  /** Seconds of headroom before trying the next better level again. */
  readonly retry?: number;
}

/**
 * Watches frame times and picks the quality level: steps down while the device struggles and
 * back up when it has headroom, so an older iPad stays smooth and a new one stays sharp.
 *
 * It guards against the usual traps. A level that made the device struggle waits twice as long
 * before the next try, and after two failures it is not tried again. A step down that does not
 * speed anything up (a 30 fps cap in Low Power Mode, a busy main thread) is undone, and the
 * governor then stops stepping down.
 */
export class QualityGovernor {
  private index = 0;
  private readonly strikes: number[];
  private readonly slow: number;
  private readonly fast: number;
  private readonly windowLength: number;
  private readonly retry: number;
  private warmup: number;
  private time = 0;
  private frames = 0;
  private slowWindows = 0;
  private headroom = 0;
  /** Average frame time just before the last step down, to check the step helped. */
  private before = 0;
  /** True once stepping down has proved useless on this device. */
  private settled = false;

  constructor(
    readonly levels: readonly QualityLevel[],
    options: GovernorOptions = {},
  ) {
    this.strikes = levels.map(() => 0);
    this.slow = options.slow ?? 1 / 45;
    this.fast = options.fast ?? 1 / 55;
    this.windowLength = options.window ?? 1;
    this.retry = options.retry ?? 5;
    this.warmup = options.warmup ?? 1.5;
  }

  get level(): QualityLevel {
    return this.levels[this.index]!;
  }

  /**
   * Feeds the time between two frames, in seconds. Returns the new level when it changes.
   * Hitches over a quarter second (a tab switch, a long task) are ignored.
   */
  sample(interval: number): QualityLevel | undefined {
    if (!(interval > 0) || interval > 0.25) return undefined;
    if (this.warmup > 1e-6) {
      this.warmup -= interval;
      return undefined;
    }
    this.time += interval;
    this.frames++;
    if (this.time < this.windowLength - 1e-6) return undefined;
    const average = this.time / this.frames;
    this.time = 0;
    this.frames = 0;
    return this.decide(average);
  }

  /** Forgets the frames so far, after a pause, so the gap does not count. */
  pause() {
    this.time = 0;
    this.frames = 0;
  }

  /** Back to the best level, e.g. when adapting is switched off. */
  reset(): QualityLevel {
    this.index = 0;
    this.pause();
    this.slowWindows = 0;
    this.headroom = 0;
    this.before = 0;
    return this.level;
  }

  private decide(average: number): QualityLevel | undefined {
    if (this.before > 0) {
      const before = this.before;
      this.before = 0;
      if (average > before * 0.9) {
        // Cheaper frames did not come faster: the limit is elsewhere, so keep the sharpness.
        this.settled = true;
        this.strikes[this.index - 1] = 0;
        return this.move(-1);
      }
    }
    if (average > this.slow) {
      this.headroom = 0;
      this.slowWindows++;
      if (this.slowWindows < 2 || this.settled || this.index >= this.levels.length - 1) return;
      this.strikes[this.index]!++;
      this.before = average;
      return this.move(1);
    }
    this.slowWindows = 0;
    if (average > this.fast || this.index === 0) return;
    this.headroom += this.windowLength;
    const strikes = this.strikes[this.index - 1]!;
    if (strikes >= 2 || this.headroom < this.retry * 2 ** strikes) return;
    return this.move(-1);
  }

  private move(step: number): QualityLevel {
    this.index += step;
    this.slowWindows = 0;
    this.headroom = 0;
    return this.level;
  }
}
