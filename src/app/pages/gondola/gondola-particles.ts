import {
  AdditiveBlending,
  Blending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Texture,
} from 'three';

/**
 * Many small particles in one draw call: sparkles, snow glints, fireworks, dust puffs. A fixed
 * ring of slots is reused, so spawning allocates nothing; a full ring overwrites its oldest
 * particle. Sizes are in world units and shrink with distance like any other object.
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
    private readonly capacity = 256,
    blending: Blending = AdditiveBlending,
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
    ['position', 'tint', 'size', 'alpha'].forEach((name, index) => {
      this.attributes[index].setUsage(DynamicDrawUsage);
      this.geometry.setAttribute(name, this.attributes[index]);
    });
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
      blending,
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
   * Starts a particle at (x, y, z) flying at (vx, vy, vz) for `life` seconds. It grows by `grow`
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
      if (p >= 1 || p < 0) {
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

  /** Ends every particle at once, for a new turn. */
  clear() {
    for (let slot = 0; slot < this.capacity; slot++) {
      this.state[slot * 7 + 1] = -1;
      this.alpha[slot] = 0;
    }
    this.alive = 0;
    for (const attribute of this.attributes) attribute.needsUpdate = true;
  }

  dispose() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * Paper confetti that tumbles as it falls, all pieces in one instanced draw call with their own
 * colours. Slots are reused like the spark pool's.
 */
export class ConfettiPool {
  readonly mesh: InstancedMesh;
  private readonly geometry = new PlaneGeometry(0.24, 0.16);
  private readonly material = new MeshStandardMaterial({
    side: DoubleSide,
    roughness: 0.6,
    emissive: '#ffffff',
    emissiveIntensity: 0.15,
  });
  /** Per slot: x, y, z, vx, vy, vz, born, life, spin, phase. */
  private readonly state: Float32Array;
  private readonly dummy = new Object3D();
  private next = 0;
  private alive = 0;

  constructor(private readonly capacity = 160) {
    this.state = new Float32Array(capacity * 10);
    this.mesh = new InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    const white = new Color('#ffffff');
    for (let slot = 0; slot < capacity; slot++) {
      this.state[slot * 10 + 7] = -1;
      this.mesh.setMatrixAt(slot, this.dummy.matrix);
      this.mesh.setColorAt(slot, white);
    }
  }

  spawn(
    t: number,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: Color,
    life = 2.2,
  ) {
    const slot = this.next;
    this.next = (this.next + 1) % this.capacity;
    const s = slot * 10;
    if (this.state[s + 7] < 0) this.alive++;
    const state = this.state;
    state[s] = x;
    state[s + 1] = y;
    state[s + 2] = z;
    state[s + 3] = vx;
    state[s + 4] = vy;
    state[s + 5] = vz;
    state[s + 6] = t;
    state[s + 7] = life;
    state[s + 8] = 6 + (slot % 7);
    state[s + 9] = slot * 1.7;
    this.mesh.setColorAt(slot, color);
    this.mesh.instanceColor!.needsUpdate = true;
  }

  update(t: number, dt: number) {
    if (!this.alive) return;
    const { state, dummy } = this;
    for (let slot = 0; slot < this.capacity; slot++) {
      const s = slot * 10;
      if (state[s + 7] < 0) continue;
      const age = t - state[s + 6];
      if (age > state[s + 7] || age < 0) {
        state[s + 7] = -1;
        this.alive--;
        dummy.scale.setScalar(0);
      } else {
        // Paper falls fast at first, then flutters down slowly with air drag.
        const drag = Math.exp(-2.2 * dt);
        state[s + 3] *= drag;
        state[s + 5] *= drag;
        state[s + 4] = state[s + 4] * drag - 7 * dt;
        state[s] += state[s + 3] * dt + Math.sin(age * 5 + state[s + 9]) * 0.6 * dt;
        state[s + 1] += state[s + 4] * dt;
        state[s + 2] += state[s + 5] * dt;
        const spin = state[s + 8] * age + state[s + 9];
        dummy.position.set(state[s], state[s + 1], state[s + 2]);
        dummy.rotation.set(spin, spin * 0.7, spin * 0.3);
        const fade = Math.min(1, (state[s + 7] - age) * 3);
        dummy.scale.setScalar(fade);
      }
      dummy.updateMatrix();
      this.mesh.setMatrixAt(slot, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let slot = 0; slot < this.capacity; slot++) {
      this.state[slot * 10 + 7] = -1;
      this.mesh.setMatrixAt(slot, this.dummy.matrix);
    }
    this.alive = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
