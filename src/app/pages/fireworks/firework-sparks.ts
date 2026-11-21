import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  Points,
  ShaderMaterial,
  SRGBColorSpace,
} from 'three';

/** The pictures in the spark atlas, one per cell. */
export const Cell = {
  /** A soft round glow: stars, trails, flashes. */
  Glow: 0,
  /** A glowing five-pointed star, for star-shaped pattern sparks. */
  Star: 1,
  /** A soft lumpy puff of smoke. */
  Puff: 2,
  /** A four-pointed glint: crackle and glitter. */
  Glint: 3,
  /** A glow squashed flat, for reflections on the lake. */
  Streak: 4,
} as const;
export type Cell = (typeof Cell)[keyof typeof Cell];

const COLS = 3;
const ROWS = 2;
const CELL = 128;

/** Per-slot state: born, life, size, grow, gravity, drag, alpha, twinkle, fade-in, hold, seed. */
const STRIDE = 11;

/**
 * What the next `emit` starts. The world sets the fields it needs and emits, so spawning a spark
 * allocates nothing. `reset()` puts every field back to a plain glowing dot.
 */
export class SparkSpec {
  life = 1;
  /** World units across. */
  size = 0.2;
  /** How much the size changes over the life: -0.5 ends at half size, 1 ends at double. */
  grow = 0;
  /** Downward pull, in units per second squared. */
  gravity = 0;
  /** How quickly it slows, per second. */
  drag = 0;
  alpha = 1;
  /** 0 burns steadily; 1 twinkles fully on and off as it falls. */
  twinkle = 0;
  /** Seconds to glow up. */
  fadeIn = 0.04;
  /** Fraction of the life it stays at full brightness before dimming away. */
  hold = 0.4;
  cell: Cell = Cell.Glow;
  /** 0 adds light (a glow); 1 also covers what is behind (smoke). */
  cover = 0;
  readonly color = new Color('#ffffff');

  reset() {
    this.life = 1;
    this.size = 0.2;
    this.grow = 0;
    this.gravity = 0;
    this.drag = 0;
    this.alpha = 1;
    this.twinkle = 0;
    this.fadeIn = 0.04;
    this.hold = 0.4;
    this.cell = Cell.Glow;
    this.cover = 0;
    this.color.set('#ffffff');
    return this;
  }
}

/** How bright a spark is at `k` (0–1) through its life: up over `fadeIn`, hold, dim away. */
export function sparkFade(age: number, life: number, fadeIn: number, hold: number): number {
  if (age < 0 || age >= life) return 0;
  const k = age / life;
  const up = fadeIn > 0 ? Math.min(1, age / fadeIn) : 1;
  if (k < hold) return up;
  const x = (k - hold) / (1 - hold);
  return up * (1 - x * x * (3 - 2 * x));
}

/**
 * Every spark of the show in one draw call: the pattern's stars and their lake reflections, the
 * rocket's head and trail, burst flashes, crackle, glitter, smoke puffs and the book shape.
 *
 * The first `pinned` slots are placed by the world each frame (the pattern and the shape sit at
 * exact places); the rest are a ring of free-flying sparks that move under drag and gravity, so a
 * full ring simply reuses its oldest spark. Premultiplied blending lets glows add light while
 * smoke covers a little of what is behind, in the same draw call.
 */
export class FireworkSparks {
  readonly points: Points;
  readonly spec = new SparkSpec();
  private readonly geometry = new BufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly map: CanvasTexture;
  private readonly position: Float32Array;
  private readonly tint: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly look: Float32Array;
  private readonly velocity: Float32Array;
  private readonly state: Float32Array;
  private readonly attributes: BufferAttribute[];
  private next: number;
  private alive = 0;

  constructor(
    private readonly capacity: number,
    private readonly pinned: number,
  ) {
    this.next = pinned;
    this.position = new Float32Array(capacity * 3);
    this.tint = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.look = new Float32Array(capacity * 2);
    this.velocity = new Float32Array(capacity * 2);
    this.state = new Float32Array(capacity * STRIDE);
    for (let slot = 0; slot < capacity; slot++) this.state[slot * STRIDE + 1] = -1;
    this.attributes = [
      new BufferAttribute(this.position, 3),
      new BufferAttribute(this.tint, 3),
      new BufferAttribute(this.size, 1),
      new BufferAttribute(this.alpha, 1),
      new BufferAttribute(this.look, 2),
    ];
    ['position', 'tint', 'size', 'alpha', 'look'].forEach((name, index) =>
      this.geometry.setAttribute(name, this.attributes[index]),
    );
    this.map = atlas();
    this.material = new ShaderMaterial({
      uniforms: { map: { value: this.map }, scale: { value: 600 } },
      vertexShader: `
        attribute vec3 tint;
        attribute float size;
        attribute float alpha;
        attribute vec2 look;
        uniform float scale;
        varying vec3 vTint;
        varying float vAlpha;
        varying vec2 vLook;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = alpha > 0.002 ? size * scale / -mv.z : 0.0;
          gl_Position = projectionMatrix * mv;
          vTint = tint;
          vAlpha = alpha;
          vLook = look;
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying vec3 vTint;
        varying float vAlpha;
        varying vec2 vLook;
        void main() {
          float col = mod(vLook.x, ${COLS}.0);
          float row = floor(vLook.x / ${COLS}.0);
          vec2 uv = vec2(
            (gl_PointCoord.x + col) / ${COLS}.0,
            (1.0 - gl_PointCoord.y + ${ROWS - 1}.0 - row) / ${ROWS}.0
          );
          vec4 texel = texture2D(map, uv);
          float a = texel.a * vAlpha;
          gl_FragColor = vec4(vTint * texel.rgb, 1.0);
          #include <colorspace_fragment>
          gl_FragColor = vec4(gl_FragColor.rgb * a, a * vLook.y);
        }`,
      transparent: true,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
    });
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  /** Device pixels per world unit at one unit from the camera. */
  setScale(scale: number) {
    this.material.uniforms['scale'].value = scale;
  }

  /** Places pinned slot `slot` this frame. An alpha of 0 hides it. */
  pin(
    slot: number,
    x: number,
    y: number,
    z: number,
    size: number,
    color: Color,
    alpha: number,
    cell: Cell,
    cover = 0,
  ) {
    const i3 = slot * 3;
    this.position[i3] = x;
    this.position[i3 + 1] = y;
    this.position[i3 + 2] = z;
    this.tint[i3] = color.r;
    this.tint[i3 + 1] = color.g;
    this.tint[i3 + 2] = color.b;
    this.size[slot] = size;
    this.alpha[slot] = alpha;
    this.look[slot * 2] = cell;
    this.look[slot * 2 + 1] = cover;
  }

  /** Hides pinned slots `from` to `to` (not included). */
  hide(from: number, to: number) {
    for (let slot = from; slot < to; slot++) this.alpha[slot] = 0;
  }

  /** Starts a free spark at (x, y, z) flying at (vx, vy) with the current `spec`. */
  emit(t: number, x: number, y: number, z: number, vx: number, vy: number) {
    const spec = this.spec;
    const slot = this.next;
    this.next = slot + 1 >= this.capacity ? this.pinned : slot + 1;
    const i3 = slot * 3;
    this.position[i3] = x;
    this.position[i3 + 1] = y;
    this.position[i3 + 2] = z;
    this.velocity[slot * 2] = vx;
    this.velocity[slot * 2 + 1] = vy;
    this.tint[i3] = spec.color.r;
    this.tint[i3 + 1] = spec.color.g;
    this.tint[i3 + 2] = spec.color.b;
    this.look[slot * 2] = spec.cell;
    this.look[slot * 2 + 1] = spec.cover;
    const s = slot * STRIDE;
    if (this.state[s + 1] < 0) this.alive++;
    this.state[s] = t;
    this.state[s + 1] = spec.life;
    this.state[s + 2] = spec.size;
    this.state[s + 3] = spec.grow;
    this.state[s + 4] = spec.gravity;
    this.state[s + 5] = spec.drag;
    this.state[s + 6] = spec.alpha;
    this.state[s + 7] = spec.twinkle;
    this.state[s + 8] = spec.fadeIn;
    this.state[s + 9] = spec.hold;
    this.state[s + 10] = (slot * 0.618) % 1;
    this.size[slot] = 0;
    this.alpha[slot] = 0;
  }

  /** Moves the free sparks on and uploads every slot. */
  update(t: number, dt: number) {
    const { position, velocity, state, size, alpha } = this;
    if (this.alive)
      for (let slot = this.pinned; slot < this.capacity; slot++) {
        const s = slot * STRIDE;
        const life = state[s + 1];
        if (life < 0) continue;
        const age = t - state[s];
        if (age >= life) {
          state[s + 1] = -1;
          alpha[slot] = 0;
          this.alive--;
          continue;
        }
        if (age < 0) {
          alpha[slot] = 0;
          continue;
        }
        const i3 = slot * 3;
        const drag = state[s + 5];
        const slow = drag ? Math.exp(-drag * dt) : 1;
        velocity[slot * 2] *= slow;
        velocity[slot * 2 + 1] = velocity[slot * 2 + 1] * slow - state[s + 4] * dt;
        position[i3] += velocity[slot * 2] * dt;
        position[i3 + 1] += velocity[slot * 2 + 1] * dt;
        size[slot] = state[s + 2] * Math.max(0.05, 1 + state[s + 3] * (age / life));
        let glow = sparkFade(age, life, state[s + 8], state[s + 9]);
        const twinkle = state[s + 7];
        if (twinkle) {
          // A soft flicker, each spark on its own beat: it never blinks in step with the rest.
          const beat = 0.5 + 0.5 * Math.sin(age * 31 + state[s + 10] * 40);
          glow *= 1 - twinkle * beat * beat;
        }
        alpha[slot] = state[s + 6] * glow;
      }
    for (const attribute of this.attributes) attribute.needsUpdate = true;
  }

  /** True while any free spark is still in the air. */
  get busy() {
    return this.alive > 0;
  }

  dispose() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.map.dispose();
  }
}

/** The spark pictures side by side in one texture, white so each spark tints its own. */
function atlas() {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;
  const c = canvas.getContext('2d')!;
  const cell = (index: Cell, draw: (c: CanvasRenderingContext2D, s: number) => void) => {
    c.save();
    c.translate((index % COLS) * CELL, Math.floor(index / COLS) * CELL);
    c.beginPath();
    c.rect(0, 0, CELL, CELL);
    c.clip();
    draw(c, CELL);
    c.restore();
  };
  const glow = (c: CanvasRenderingContext2D, s: number) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2 - 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.28, 'rgba(255,255,255,1)');
    g.addColorStop(0.42, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.68, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  };
  cell(Cell.Glow, glow);
  cell(Cell.Star, (c, s) => {
    c.translate(s / 2, s / 2 + 4);
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? s * 0.15 : s * 0.36;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.shadowColor = 'rgba(255,255,255,0.9)';
    c.shadowBlur = 16;
    c.fillStyle = '#fff';
    c.lineJoin = 'round';
    c.lineWidth = 6;
    c.strokeStyle = '#fff';
    c.fill();
    c.stroke();
  });
  cell(Cell.Puff, (c, s) => {
    // A few overlapping soft blobs make a lumpy cloud rather than a perfect disc.
    const blobs: [number, number, number][] = [
      [0.5, 0.52, 0.36],
      [0.36, 0.44, 0.24],
      [0.64, 0.42, 0.26],
      [0.46, 0.64, 0.24],
      [0.62, 0.62, 0.22],
    ];
    for (const [x, y, r] of blobs) {
      const g = c.createRadialGradient(x * s, y * s, 0, x * s, y * s, r * s);
      g.addColorStop(0, 'rgba(255,255,255,0.42)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    }
  });
  cell(Cell.Glint, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    // Two thin crossed rays.
    for (const [w, h] of [
      [s * 0.46, s * 0.035],
      [s * 0.035, s * 0.46],
    ]) {
      const ray = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, Math.max(w, h));
      ray.addColorStop(0, 'rgba(255,255,255,0.95)');
      ray.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = ray;
      c.beginPath();
      c.ellipse(s / 2, s / 2, w, h, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
  cell(Cell.Streak, (c, s) => {
    c.translate(s / 2, s / 2);
    c.scale(1, 0.3);
    c.translate(-s / 2, -s / 2);
    glow(c, s);
  });
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return map;
}
