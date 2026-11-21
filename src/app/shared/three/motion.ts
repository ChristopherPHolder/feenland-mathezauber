/**
 * Easing and motion helpers for the 3D worlds: easings, springs, follow-through, squash and
 * stretch and a particle pool. Plain numbers and arrays only, no Three.js, so they test fast and
 * work on any object with x, y and z.
 */

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Smooth start and stop. */
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Fast start, gentle landing. */
export const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;

/** Overshoots a little and settles: good for things popping into place. */
export const easeOutBack = (t: number) => {
  const x = clamp01(t);
  const c = 1.70158;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};

/** A drop that bounces twice before resting, from 0 (start) to 1 (resting). */
export const bounce = (t: number) => {
  const x = clamp01(t);
  if (x < 1 / 2.75) return 7.5625 * x * x;
  if (x < 2 / 2.75) return 7.5625 * (x - 1.5 / 2.75) ** 2 + 0.75;
  if (x < 2.5 / 2.75) return 7.5625 * (x - 2.25 / 2.75) ** 2 + 0.9375;
  return 7.5625 * (x - 2.625 / 2.75) ** 2 + 0.984375;
};

/** Moves `current` toward `target` by a frame-rate independent fraction (`rate` per second). */
export const approach = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

/** A shake that dies away over `duration` seconds after `start`; 0 outside it. */
export const shake = (t: number, start: number, duration: number, strength: number) => {
  const age = t - start;
  if (age < 0 || age > duration) return 0;
  const fade = 1 - age / duration;
  return Math.sin(age * 55) * strength * fade * fade;
};

/**
 * Watches a counter (right answers, mistakes, placed bricks) and reports when it goes up, so a
 * world can play a burst once per event. The first value only syncs, so a rebuilt world does
 * not replay old events.
 */
export class EventCounter {
  private seen: number | undefined;
  /** Returns how many new events happened since the last call. */
  take(value: number): number {
    if (this.seen === undefined || value < this.seen) {
      this.seen = value;
      return 0;
    }
    const fresh = value - this.seen;
    this.seen = value;
    return fresh;
  }
}

/** Anything with x, y and z: a Three.js `Vector3`, a mesh's `position` or `scale`, a plain object. */
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface SpringOptions {
  /** How fast it swings, in swings per second. 2–4 feels lively, under 1 lazy. */
  readonly frequency?: number;
  /** 1 settles without overshoot, 0.3–0.6 overshoots and wobbles, 0 never stops. */
  readonly damping?: number;
}

/**
 * The exact motion of a damped spring over `dt`, as the weights that turn the start offset and
 * velocity into the new ones: offset' = a·offset + b·velocity, velocity' = c·offset + d·velocity.
 * Exact rather than stepped, so it stays stable at any frame rate and frame hitch.
 */
class SpringStep {
  a = 1;
  b = 0;
  c = 0;
  d = 1;

  solve(dt: number, frequency: number, damping: number) {
    const w = 2 * Math.PI * Math.max(0, frequency);
    const z = Math.max(0, damping);
    if (dt <= 0 || w === 0) {
      this.a = 1;
      this.b = dt > 0 ? dt : 0;
      this.c = 0;
      this.d = 1;
      return;
    }
    if (Math.abs(z - 1) < 1e-4) {
      // Critically damped.
      const e = Math.exp(-w * dt);
      this.a = (1 + w * dt) * e;
      this.b = dt * e;
      this.c = -w * w * dt * e;
      this.d = (1 - w * dt) * e;
    } else if (z < 1) {
      const wd = w * Math.sqrt(1 - z * z);
      const e = Math.exp(-z * w * dt);
      const cos = Math.cos(wd * dt);
      const sin = Math.sin(wd * dt);
      this.a = e * (cos + ((z * w) / wd) * sin);
      this.b = (e * sin) / wd;
      this.c = (-e * w * w * sin) / wd;
      this.d = e * (cos - ((z * w) / wd) * sin);
    } else {
      const root = Math.sqrt(z * z - 1);
      const r1 = -w * (z - root);
      const r2 = -w * (z + root);
      const e1 = Math.exp(r1 * dt);
      const e2 = Math.exp(r2 * dt);
      const span = r2 - r1;
      this.a = (r2 * e1 - r1 * e2) / span;
      this.b = (e2 - e1) / span;
      this.c = (r1 * r2 * (e1 - e2)) / span;
      this.d = (r2 * e2 - r1 * e1) / span;
    }
  }
}

/**
 * A number that chases its target like a weight on a spring: heads that turn to look, a pony
 * leaning into a bend, a lid that pops open and wobbles shut. Change `target` (or pass one to
 * `step`) and read `value` every frame.
 */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  frequency: number;
  damping: number;
  private readonly motion = new SpringStep();

  constructor(value = 0, options: SpringOptions = {}) {
    this.value = value;
    this.target = value;
    this.frequency = options.frequency ?? 3;
    this.damping = options.damping ?? 0.5;
  }

  /** Moves on by `dt` seconds and returns the new value. */
  step(dt: number, target = this.target): number {
    this.target = target;
    const { motion } = this;
    motion.solve(dt, this.frequency, this.damping);
    const offset = this.value - target;
    this.value = target + motion.a * offset + motion.b * this.velocity;
    this.velocity = motion.c * offset + motion.d * this.velocity;
    return this.value;
  }

  /** Jumps straight to `value` and stops. */
  snap(value: number) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  /** Adds a sudden push (units per second): a bump, a tap, a landing. */
  kick(velocity: number) {
    this.velocity += velocity;
  }

  /** True once it rests on its target. */
  get settled(): boolean {
    return Math.abs(this.value - this.target) < 1e-3 && Math.abs(this.velocity) < 1e-3;
  }
}

/** A `Spring` for positions, scales and look-at points: three springs sharing one motion. */
export class Spring3 {
  readonly value: Vec3Like;
  readonly target: Vec3Like;
  readonly velocity: Vec3Like = { x: 0, y: 0, z: 0 };
  frequency: number;
  damping: number;
  private readonly motion = new SpringStep();

  constructor(value: Vec3Like = { x: 0, y: 0, z: 0 }, options: SpringOptions = {}) {
    this.value = { x: value.x, y: value.y, z: value.z };
    this.target = { x: value.x, y: value.y, z: value.z };
    this.frequency = options.frequency ?? 3;
    this.damping = options.damping ?? 0.5;
  }

  /** Moves on by `dt` seconds; copies the result into `out` (a mesh's position) when given. */
  step(dt: number, out?: Vec3Like): Vec3Like {
    const { motion, value, target, velocity } = this;
    motion.solve(dt, this.frequency, this.damping);
    for (const axis of AXES) {
      const offset = value[axis] - target[axis];
      value[axis] = target[axis] + motion.a * offset + motion.b * velocity[axis];
      velocity[axis] = motion.c * offset + motion.d * velocity[axis];
    }
    if (out) {
      out.x = value.x;
      out.y = value.y;
      out.z = value.z;
    }
    return value;
  }

  /** Sets where it heads, without allocating. */
  aim(x: number, y: number, z: number) {
    this.target.x = x;
    this.target.y = y;
    this.target.z = z;
  }

  /** Jumps straight to a point and stops. */
  snap(x: number, y: number, z: number) {
    this.aim(x, y, z);
    this.value.x = x;
    this.value.y = y;
    this.value.z = z;
    this.velocity.x = this.velocity.y = this.velocity.z = 0;
  }

  /** Adds a sudden push, in units per second. */
  kick(x: number, y: number, z: number) {
    this.velocity.x += x;
    this.velocity.y += y;
    this.velocity.z += z;
  }
}

const AXES = ['x', 'y', 'z'] as const;

export interface FollowOptions extends SpringOptions {
  /** Each link swings this much slower than the one before, so the motion travels down. */
  readonly falloff?: number;
}

/**
 * Follow-through for tails, manes, hair, ribbons and antennae: a chain of links where each one
 * trails the one before it, so a turn of the body sweeps down the tail and the tip whips last.
 *
 * Feed the angle the root is pointing (body heading, head tilt, plus any idle sway) every frame
 * and rotate each nested joint by `angles[i]`, its bend relative to the link before. One chain
 * swings in one plane; use two for side-to-side and up-and-down.
 */
export class FollowChain {
  /** Bend of each link relative to its parent, in the units fed in (radians). */
  readonly angles: Float64Array;
  private readonly links: Spring[];

  constructor(count: number, options: FollowOptions = {}) {
    const falloff = options.falloff ?? 0.85;
    const frequency = options.frequency ?? 3.5;
    this.angles = new Float64Array(count);
    this.links = Array.from(
      { length: count },
      (_, i) =>
        new Spring(0, { frequency: frequency * falloff ** i, damping: options.damping ?? 0.4 }),
    );
  }

  /** Moves on by `dt` seconds with the root pointing at `root`; returns the bends. */
  step(dt: number, root: number): Float64Array {
    let parent = root;
    for (let i = 0; i < this.links.length; i++) {
      const link = this.links[i]!;
      const angle = link.step(dt, parent);
      this.angles[i] = angle - parent;
      parent = angle;
    }
    return this.angles;
  }

  /** Straightens the chain behind a root pointing at `root`. */
  snap(root: number) {
    for (const link of this.links) link.snap(root);
    this.angles.fill(0);
  }
}

/**
 * The scale of a body stretched `stretch` times its height (above 1 tall and thin, below 1
 * squashed wide) with its volume kept, so a squash reads as soft rather than as shrinking.
 * Writes into `out`, e.g. a mesh's `scale`, along `axis`.
 */
export function squashStretch(
  stretch: number,
  out: Vec3Like = { x: 1, y: 1, z: 1 },
  axis: 'x' | 'y' | 'z' = 'y',
): Vec3Like {
  const along = Math.max(0.2, stretch);
  const side = 1 / Math.sqrt(along);
  out.x = out.y = out.z = side;
  out[axis] = along;
  return out;
}

/** Stretch for something moving at `speed`: longer the faster it goes, up to `max`. */
export const speedStretch = (speed: number, amount = 0.04, max = 0.3) =>
  1 + Math.min(max, Math.abs(speed) * amount);

/**
 * The squash of a landing or a hit at `start`: flattens by `strength`, springs back past rest
 * and settles within `duration` seconds. Returns the stretch for `squashStretch` (1 at rest).
 */
export const impactSquash = (t: number, start: number, strength = 0.25, duration = 0.5) => {
  const age = t - start;
  if (age < 0 || age >= duration) return 1;
  const x = age / duration;
  return 1 - strength * Math.cos(x * Math.PI * 2.5) * (1 - x) ** 2;
};

/**
 * Anticipation before a jump or a throw: a small crouch the other way during the first
 * `share` of the move, then the move itself. Maps 0..1 to 0..1 with a dip below 0 first.
 */
export const anticipate = (t: number, share = 0.25, dip = 0.12) => {
  const x = clamp01(t);
  if (x < share) return -dip * Math.sin((x / share) * Math.PI * 0.5);
  return -dip + (1 + dip) * easeOut((x - share) / (1 - share));
};

export interface BurstOptions {
  /** Starting speed in units per second; each particle varies it by ±30 %. */
  readonly speed?: number;
  /** Seconds each particle lives; varies by ±25 %. */
  readonly life?: number;
  /** 1 sprays every way, 0.5 only upwards (a fountain), smaller a narrower jet. */
  readonly spread?: number;
  /** Random source, for tests. */
  readonly random?: () => number;
}

/**
 * The simulation behind a particle burst (sparkles on a right answer, crumbs, splashes): a
 * fixed pool of particles in flat arrays, reused in turn, so playing bursts never allocates.
 * `ParticleBurst` in `particles.ts` draws it; a world can also draw the arrays itself.
 */
export class BurstPool {
  readonly position: Float32Array;
  readonly velocity: Float32Array;
  /** Seconds lived; a particle is gone once `age >= life`. */
  readonly age: Float32Array;
  readonly life: Float32Array;
  private next = 0;
  private alive = 0;

  constructor(readonly capacity: number) {
    this.position = new Float32Array(capacity * 3);
    this.velocity = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
  }

  /** How many particles are still flying. */
  get live(): number {
    return this.alive;
  }

  /**
   * Throws `count` particles out from a point, reusing the oldest when the pool is full.
   * Returns the first slot used; the rest follow it, wrapping round the pool.
   */
  emit(count: number, x: number, y: number, z: number, options: BurstOptions = {}): number {
    const random = options.random ?? Math.random;
    const speed = options.speed ?? 3;
    const life = options.life ?? 0.9;
    const spread = clamp01(options.spread ?? 1);
    const first = this.next;
    const n = Math.min(count, this.capacity);
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.capacity;
      if (!(this.age[i]! < this.life[i]!)) this.alive++;
      // A random direction in a cap around +y: spread 1 is the whole sphere.
      const cos = 1 - random() * 2 * spread;
      const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
      const turn = random() * Math.PI * 2;
      const v = speed * (0.7 + random() * 0.6);
      this.position[i * 3] = x;
      this.position[i * 3 + 1] = y;
      this.position[i * 3 + 2] = z;
      this.velocity[i * 3] = Math.cos(turn) * sin * v;
      this.velocity[i * 3 + 1] = cos * v;
      this.velocity[i * 3 + 2] = Math.sin(turn) * sin * v;
      this.age[i] = 0;
      this.life[i] = life * (0.75 + random() * 0.5);
    }
    return first;
  }

  /** Moves every live particle on by `dt`: gravity pulls down, `drag` slows them (per second). */
  step(dt: number, gravity = -5, drag = 1.2) {
    if (this.alive === 0) return;
    const slow = Math.exp(-drag * dt);
    let alive = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (!(this.age[i]! < this.life[i]!)) continue;
      this.age[i]! += dt;
      if (this.age[i]! >= this.life[i]!) continue;
      alive++;
      const p = i * 3;
      this.velocity[p + 1]! += gravity * dt;
      this.velocity[p]! *= slow;
      this.velocity[p + 1]! *= slow;
      this.velocity[p + 2]! *= slow;
      this.position[p]! += this.velocity[p]! * dt;
      this.position[p + 1]! += this.velocity[p + 1]! * dt;
      this.position[p + 2]! += this.velocity[p + 2]! * dt;
    }
    this.alive = alive;
  }

  /** How much of particle `i`'s life is left, from 1 (new) to 0 (gone). */
  remaining(i: number): number {
    const life = this.life[i]!;
    return life > 0 ? clamp01(1 - this.age[i]! / life) : 0;
  }

  /** Ends every particle at once. */
  clear() {
    this.age.fill(0);
    this.life.fill(0);
    this.alive = 0;
  }
}
