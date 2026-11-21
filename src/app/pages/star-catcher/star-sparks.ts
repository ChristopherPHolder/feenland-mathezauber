import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Texture,
} from 'three';

/**
 * Every little spark of the night sky in one draw call: catch bursts, the glitter a caught star
 * trails on its way up, comet sparks, the pop where a star lands. A fixed ring of slots is
 * reused, so spawning allocates nothing; a full ring simply overwrites its oldest spark.
 * Sizes are in world units and shrink with distance like any other object.
 */
export class SparkPool {
  readonly points: Points;
  private readonly geometry = new BufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly position: Float32Array;
  private readonly tint: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly velocity: Float32Array;
  /** Per slot: born, life, base size, grow, fall, base alpha, drag. */
  private readonly state: Float32Array;
  private readonly attributes: BufferAttribute[];
  private next = 0;
  private alive = 0;

  constructor(
    map: Texture,
    private readonly capacity = 384,
  ) {
    this.position = new Float32Array(capacity * 3);
    this.tint = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.velocity = new Float32Array(capacity * 3);
    this.state = new Float32Array(capacity * 7);
    for (let index = 0; index < capacity; index++) this.state[index * 7 + 1] = -1;
    this.attributes = [
      new BufferAttribute(this.position, 3),
      new BufferAttribute(this.tint, 3),
      new BufferAttribute(this.size, 1),
      new BufferAttribute(this.alpha, 1),
    ];
    ['position', 'tint', 'size', 'alpha'].forEach((name, index) =>
      this.geometry.setAttribute(name, this.attributes[index]),
    );
    this.material = new ShaderMaterial({
      uniforms: { map: { value: map }, scale: { value: 500 } },
      vertexShader: `
        attribute vec3 tint;
        attribute float size;
        attribute float alpha;
        uniform float scale;
        varying vec3 vTint;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = alpha > 0.0 ? size * scale / -mv.z : 0.0;
          gl_Position = projectionMatrix * mv;
          vTint = tint;
          vAlpha = alpha;
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying vec3 vTint;
        varying float vAlpha;
        void main() {
          vec4 texel = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vTint * texel.rgb, texel.a * vAlpha);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 19;
  }

  /** Device pixels per world unit at one unit from the camera. */
  setScale(scale: number) {
    this.material.uniforms['scale'].value = scale;
  }

  /**
   * Starts a spark at (x, y, z) flying at (vx, vy, vz) for `life` seconds. It grows by `grow`
   * times its size over its life (negative shrinks), falls with `fall` and slows with `drag`.
   */
  spawn(
    t: number,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    color: Color,
    alpha = 1,
    grow = -0.6,
    fall = 0,
    drag = 0,
  ) {
    const slot = this.next;
    this.next = (this.next + 1) % this.capacity;
    const i3 = slot * 3;
    this.position[i3] = x;
    this.position[i3 + 1] = y;
    this.position[i3 + 2] = z;
    this.velocity[i3] = vx;
    this.velocity[i3 + 1] = vy;
    this.velocity[i3 + 2] = vz;
    this.tint[i3] = color.r;
    this.tint[i3 + 1] = color.g;
    this.tint[i3 + 2] = color.b;
    const s = slot * 7;
    if (this.state[s + 1] < 0) this.alive++;
    this.state[s] = t;
    this.state[s + 1] = life;
    this.state[s + 2] = size;
    this.state[s + 3] = grow;
    this.state[s + 4] = fall;
    this.state[s + 5] = alpha;
    this.state[s + 6] = drag;
    this.size[slot] = size;
    this.alpha[slot] = alpha;
  }

  update(t: number, dt: number) {
    if (!this.alive) return;
    const { position, velocity, state, size, alpha } = this;
    for (let slot = 0; slot < this.capacity; slot++) {
      const s = slot * 7;
      const life = state[s + 1];
      if (life < 0) continue;
      const p = (t - state[s]) / life;
      if (p >= 1) {
        state[s + 1] = -1;
        alpha[slot] = 0;
        this.alive--;
        continue;
      }
      const i3 = slot * 3;
      const slow = state[s + 6] ? Math.exp(-state[s + 6] * dt) : 1;
      velocity[i3] *= slow;
      velocity[i3 + 1] = velocity[i3 + 1] * slow - state[s + 4] * dt;
      velocity[i3 + 2] *= slow;
      position[i3] += velocity[i3] * dt;
      position[i3 + 1] += velocity[i3 + 1] * dt;
      position[i3 + 2] += velocity[i3 + 2] * dt;
      size[slot] = state[s + 2] * Math.max(0.05, 1 + state[s + 3] * p);
      // Bright at once, fading over the last half.
      alpha[slot] = state[s + 5] * (p < 0.5 ? 1 : 1 - (p - 0.5) / 0.5);
    }
    for (const attribute of this.attributes) attribute.needsUpdate = true;
  }

  dispose() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
