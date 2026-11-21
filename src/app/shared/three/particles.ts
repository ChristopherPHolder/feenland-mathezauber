import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ColorRepresentation,
  DynamicDrawUsage,
  NormalBlending,
  Points,
  PointsMaterial,
  SRGBColorSpace,
} from 'three';
import { BurstOptions, BurstPool } from './motion';

export interface ParticleBurstOptions {
  /** Most particles in flight at once; the oldest are reused beyond it. */
  readonly capacity?: number;
  /** Size of each sparkle in world units. */
  readonly size?: number;
  /** Adds light (sparkles, magic) instead of painting over (crumbs, petals). */
  readonly glow?: boolean;
  /** Pull in units per second squared; negative falls. */
  readonly gravity?: number;
  /** How fast the particles slow down, per second. */
  readonly drag?: number;
}

/**
 * A pooled particle burst for celebrations and impacts: one `Points` draw call however many
 * bursts are playing, with no allocation per burst or per frame. Add it to the scene once,
 * call `burst()` on the event and `update(dt)` every frame; it fades each particle out and
 * hides itself when nothing is flying.
 *
 *     this.sparkles = new ParticleBurst({ glow: true });
 *     this.scene.add(this.sparkles);
 *     // on a right answer
 *     this.sparkles.burst(chest.position, '#ffd166', 24, { speed: 3, spread: 0.5 });
 */
export class ParticleBurst extends Points<BufferGeometry, PointsMaterial> {
  readonly pool: BurstPool;
  private readonly colors: Float32Array;
  private readonly tints: Float32Array;
  private readonly gravity: number;
  private readonly drag: number;
  private readonly tint = new Color();

  constructor(options: ParticleBurstOptions = {}) {
    const capacity = options.capacity ?? 96;
    const pool = new BurstPool(capacity);
    const geometry = new BufferGeometry();
    const position = new BufferAttribute(pool.position, 3).setUsage(DynamicDrawUsage);
    const colors = new Float32Array(capacity * 4);
    const color = new BufferAttribute(colors, 4).setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', position);
    geometry.setAttribute('color', color);
    const material = new PointsMaterial({
      size: options.size ?? 0.18,
      map: softDot(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: options.glow ? AdditiveBlending : NormalBlending,
    });
    super(geometry, material);
    this.pool = pool;
    this.colors = colors;
    this.tints = new Float32Array(capacity * 3);
    this.gravity = options.gravity ?? -5;
    this.drag = options.drag ?? 1.2;
    // Particles fly anywhere; a bounding sphere would cull them wrongly.
    this.frustumCulled = false;
    this.visible = false;
  }

  /** Throws `count` particles of `color` out from `origin` (in this object's space). */
  burst(
    origin: { x: number; y: number; z: number },
    color: ColorRepresentation,
    count = 20,
    options: BurstOptions = {},
  ) {
    const first = this.pool.emit(count, origin.x, origin.y, origin.z, options);
    this.tint.set(color);
    const n = Math.min(count, this.pool.capacity);
    for (let k = 0; k < n; k++) {
      const i = ((first + k) % this.pool.capacity) * 3;
      this.tints[i] = this.tint.r;
      this.tints[i + 1] = this.tint.g;
      this.tints[i + 2] = this.tint.b;
    }
    this.visible = true;
  }

  /** Moves the particles on by `dt` seconds. */
  update(dt: number) {
    if (!this.visible) return;
    const { pool, colors, tints } = this;
    pool.step(dt, this.gravity, this.drag);
    for (let i = 0; i < pool.capacity; i++) {
      const left = pool.remaining(i);
      colors[i * 4] = tints[i * 3]!;
      colors[i * 4 + 1] = tints[i * 3 + 1]!;
      colors[i * 4 + 2] = tints[i * 3 + 2]!;
      // Full for most of the flight, then fading out.
      colors[i * 4 + 3] = Math.min(1, left * 2.5);
    }
    this.geometry.attributes['position']!.needsUpdate = true;
    this.geometry.attributes['color']!.needsUpdate = true;
    this.visible = pool.live > 0;
  }

  /** Stops every particle at once. */
  stop() {
    this.pool.clear();
    this.visible = false;
  }

  /** Frees the buffers, material and dot texture; `disposeTree` does the same. */
  override dispose() {
    this.geometry.dispose();
    this.material.map?.dispose();
    this.material.dispose();
    super.dispose();
  }
}

/** A round dot with a soft rim, so points read as sparkles rather than squares. */
function softDot(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d');
  if (c) {
    const glow = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, 64, 64);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
