import {
  BufferGeometry,
  Color,
  InstancedMesh,
  Material,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';

const matrix = new Matrix4();
const spin = new Quaternion();
const place = new Vector3();
const size = new Vector3();
const AXIS = new Vector3(0.3, 1, 0.2).normalize();
const WHITE = new Color('#ffffff');

export interface ParticleLook {
  /** Pull down per second squared; sparkles fall, dust hardly does. */
  readonly gravity: number;
  /** How quickly they slow in the air, per second. */
  readonly drag: number;
  /** Dust swells as it drifts; sparkles pop in and shrink away. */
  readonly swell: boolean;
}

/**
 * A fixed pool of small particles drawn as one instanced mesh: sparkles kicked up by hooves,
 * dust from a stumble, fireworks over the castle. Emitting reuses the oldest slot, so nothing
 * is allocated after the world is built and the whole pool is a single draw call.
 */
export class Particles {
  readonly mesh: InstancedMesh;
  private readonly position: Float32Array;
  private readonly velocity: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly scale: Float32Array;
  /** Particles that travel with a moving object (sparkles round Lumi) rather than staying put. */
  private readonly follow: Uint8Array;
  private next = 0;
  private alive = 0;

  constructor(
    geometry: BufferGeometry,
    material: Material,
    private readonly capacity: number,
    private readonly look: ParticleLook,
  ) {
    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.position = new Float32Array(capacity * 3);
    this.velocity = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.scale = new Float32Array(capacity);
    this.follow = new Uint8Array(capacity);
    matrix.makeScale(0, 0, 0);
    for (let index = 0; index < capacity; index++) {
      this.mesh.setMatrixAt(index, matrix);
      this.mesh.setColorAt(index, WHITE);
    }
  }

  emit(
    at: Vector3,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    scale: number,
    color?: Color,
    follow = false,
  ) {
    const index = this.next;
    this.next = (this.next + 1) % this.capacity;
    if (this.life[index] <= 0) this.alive++;
    const slot = index * 3;
    this.position[slot] = at.x;
    this.position[slot + 1] = at.y;
    this.position[slot + 2] = at.z;
    this.velocity[slot] = vx;
    this.velocity[slot + 1] = vy;
    this.velocity[slot + 2] = vz;
    this.age[index] = 0;
    this.life[index] = life;
    this.scale[index] = scale;
    this.follow[index] = follow ? 1 : 0;
    if (color && this.mesh.instanceColor) {
      this.mesh.setColorAt(index, color);
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Moves every live particle on; `carry` is how far the followed object moved this frame. */
  update(dt: number, carry: Vector3) {
    if (!this.alive) return;
    const { position, velocity, age, life, look } = this;
    const slow = Math.max(0, 1 - look.drag * dt);
    for (let index = 0; index < this.capacity; index++) {
      if (life[index] <= 0) continue;
      age[index] += dt;
      const share = age[index] / life[index];
      const at = index * 3;
      if (share >= 1) {
        life[index] = 0;
        this.alive--;
        matrix.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(index, matrix);
        continue;
      }
      velocity[at + 1] -= look.gravity * dt;
      for (let axis = 0; axis < 3; axis++) {
        velocity[at + axis] *= slow;
        position[at + axis] += velocity[at + axis] * dt;
      }
      if (this.follow[index]) {
        position[at] += carry.x;
        position[at + 1] += carry.y;
        position[at + 2] += carry.z;
      }
      const grow = look.swell
        ? 0.5 + share * 1.2
        : Math.min(1, age[index] * 14) * (1 - share * share);
      const fade = look.swell ? 1 - share * share : 1;
      place.set(position[at], position[at + 1], position[at + 2]);
      size.setScalar(Math.max(0.001, this.scale[index] * grow * fade));
      spin.setFromAxisAngle(AXIS, age[index] * 7 + index);
      matrix.compose(place, spin, size);
      this.mesh.setMatrixAt(index, matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
