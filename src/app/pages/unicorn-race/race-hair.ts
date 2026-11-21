import {
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';

/** Hair hangs from its top, along -y, like the LOCK geometry. */
const DOWN = new Vector3(0, -1, 0);
/** Longest physics step; a slow frame is cut into several so the hair never explodes. */
const SUBSTEP = 1 / 90;
const MAX_SUBSTEPS = 8;
/** Gravity on hair, a little softer than real so locks float and read as light. */
const GRAVITY = 9;
/** An anchor that jumps further than this in one frame was moved, not galloped: start over. */
const TELEPORT = 2;
/** Internal friction per second, which keeps a lock from swinging on and on. */
const FRICTION = 9;
/** How quickly any swing settles, per second, measured against the pony. */
const SETTLE = 2.5;

const anchor = new Vector3();
const rest = new Vector3();
const velocity = new Vector3();
const scratch = new Vector3();
const air = new Vector3();
const parent = new Vector3();
const carried = new Vector3();
const STILL = new Vector3();
const inverse = new Matrix4();
const placed = new Matrix4();
const turn = new Quaternion();
const top = new Vector3();
const shift = new Vector3();

export interface HairOptions {
  /** Length of each segment, in the pony's units. */
  readonly length: number;
  /**
   * How strongly each segment springs back to its rest direction (per second squared). High at
   * the root, where a tail is muscle, and low at the tip, where it is only hair.
   */
  readonly stiffness: readonly number[];
  /** Air resistance per second: how hard the hair streams back for each metre a second of wind. */
  readonly drag: number;
  /**
   * For a lock that falls to one side of a mane: -1 or 1, and how far out from the middle of
   * the parent each point must stay, so the hair lies on the neck instead of sinking into it.
   */
  readonly side?: number;
  readonly clearance?: readonly number[];
}

/**
 * A lock of hair or a tail simulated in world space: a chain of points that hang from an
 * anchor on the pony, pulled down by gravity, held near their rest shape by a soft spring and
 * slowed by the air. Because the points live in the world, they lag behind whatever the pony
 * does: they stream back at a gallop, swing on every bounce, whip forward when the pony brakes
 * and droop when it stands. The chain only stores numbers; `pose` turns it into rotations for
 * the meshes that show it.
 */
export class HairChain {
  /** The rest direction of each segment in the anchor's local space; ponies may change it. */
  readonly rest: Vector3[];
  private readonly points: Vector3[];
  private readonly previous: Vector3[];
  private placed = false;

  constructor(
    private readonly parent: Object3D,
    /** Where the chain hangs from, in the parent's local space. */
    private readonly root: Vector3,
    rest: readonly Vector3[],
    private readonly options: HairOptions,
  ) {
    this.rest = rest.map((direction) => direction.clone().normalize());
    this.points = [root, ...rest].map(() => new Vector3());
    this.previous = this.points.map(() => new Vector3());
  }

  get segments(): number {
    return this.rest.length;
  }

  /** Drops the chain into its rest shape, at rest. Needs the parent's world matrix. */
  reset() {
    const { points, previous } = this;
    anchor.copy(this.root).applyMatrix4(this.parent.matrixWorld);
    points[0].copy(anchor);
    for (let index = 1; index < points.length; index++) {
      rest.copy(this.rest[index - 1]).transformDirection(this.parent.matrixWorld);
      points[index].copy(points[index - 1]).addScaledVector(rest, this.options.length);
    }
    for (let index = 0; index < points.length; index++) previous[index].copy(points[index]);
    this.placed = true;
  }

  /** Adds a sudden velocity (world units per second) to every free point, more at the tip. */
  kick(push: Vector3) {
    const count = this.points.length - 1;
    for (let index = 1; index <= count; index++)
      this.previous[index].addScaledVector(push, (-SUBSTEP * index) / count);
  }

  /**
   * Moves the chain on by `dt` seconds. The parent's world matrix must be current. `wind` is
   * the air's own velocity in world space; still air is zero.
   */
  step(dt: number, wind?: Vector3) {
    anchor.copy(this.root).applyMatrix4(this.parent.matrixWorld);
    if (!this.placed || anchor.distanceToSquared(this.points[0]) > TELEPORT * TELEPORT) {
      this.reset();
      return;
    }
    const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(dt / SUBSTEP)));
    const h = dt / steps;
    const start = scratch.copy(this.points[0]);
    for (let step = 1; step <= steps; step++) {
      // The anchor travels in a straight line across the frame's substeps.
      this.previous[0].copy(this.points[0]);
      this.points[0].lerpVectors(start, anchor, step / steps);
      this.integrate(h, wind ?? STILL);
    }
    this.keepOut();
  }

  /** Pushes points that slipped across the middle of the neck back out to their own side. */
  private keepOut() {
    const { side, clearance } = this.options;
    if (!side || !clearance) return;
    const matrix = this.parent.matrixWorld;
    inverse.copy(matrix).invert();
    for (let index = 1; index < this.points.length; index++) {
      const point = this.points[index];
      const least = clearance[index - 1] ?? 0;
      scratch.copy(point).applyMatrix4(inverse);
      if (scratch.x * side >= least) continue;
      scratch.x = least * side;
      point.copy(scratch.applyMatrix4(matrix));
    }
  }

  /**
   * Turns segment `index` into a rotation for a mesh hanging along -y from the segment's top,
   * as a quaternion in `holder`'s parent space, and moves the holder to the segment's top.
   * Pass `move: false` for a lock fixed to its pivot.
   */
  pose(index: number, holder: Object3D, move = true) {
    const space = holder.parent;
    if (!space) return;
    inverse.copy(space.matrixWorld).invert();
    if (move) holder.position.copy(this.points[index]).applyMatrix4(inverse);
    velocity.subVectors(this.points[index + 1], this.points[index]).transformDirection(inverse);
    holder.quaternion.setFromUnitVectors(DOWN, velocity);
  }

  /** The point at the end of segment `index` - 1, in world space (0 is the anchor). */
  point(index: number): Vector3 {
    return this.points[index];
  }

  private integrate(h: number, wind: Vector3) {
    const { points, previous, options } = this;
    const settle = Math.max(0, 1 - SETTLE * h);
    const friction = Math.min(1, FRICTION * h);
    const matrix = this.parent.matrixWorld;
    // How far the anchor moved this substep: the pony's own motion, which the hair rides on.
    carried.subVectors(points[0], previous[0]);
    // The air rushing past the pony, as a push per substep: it streams the hair back.
    air
      .copy(wind)
      .multiplyScalar(h)
      .sub(carried)
      .multiplyScalar(options.drag * h);
    for (let index = 1; index < points.length; index++) {
      const point = points[index];
      // Swinging dies away relative to the pony, not the ground, so a running pony's hair
      // keeps up with it and only the air streams it back.
      velocity.subVectors(point, previous[index]).sub(carried).multiplyScalar(settle).add(carried);
      // Hair rubs on hair: swinging relative to the point before it dies away quickly.
      parent.subVectors(points[index - 1], previous[index - 1]).sub(velocity);
      velocity.addScaledVector(parent, friction).add(air);
      previous[index].copy(point);
      // Where this point would sit if the hair kept its shape behind the point before it.
      rest
        .copy(this.rest[index - 1])
        .transformDirection(matrix)
        .multiplyScalar(options.length)
        .add(points[index - 1])
        .sub(point)
        .multiplyScalar(options.stiffness[index - 1] ?? 0);
      rest.y -= GRAVITY;
      point.add(velocity).addScaledVector(rest, h * h);
      // Hair does not stretch: pull the point back to one segment from the one before it.
      velocity.subVectors(point, points[index - 1]);
      const length = velocity.length() || 1;
      point.copy(points[index - 1]).addScaledVector(velocity, options.length / length);
    }
  }
}

/** One drawn lock: which chain segment it follows, its size and where it sits across it. */
interface Strand {
  readonly material: number;
  readonly index: number;
  readonly chain: HairChain;
  readonly segment: number;
  readonly scale: Vector3;
  readonly offset: Vector3;
}

/**
 * Draws every lock of one pony's hair with one instanced mesh per hair colour, so a full mane
 * and tail cost three draw calls instead of dozens. Each lock follows one segment of a chain.
 */
export class HairStrands {
  readonly meshes: InstancedMesh[] = [];
  private readonly strands: Strand[] = [];

  constructor(
    private readonly geometry: BufferGeometry,
    private readonly materials: readonly Material[],
  ) {}

  /** Adds a lock along `chain` segment `segment`; call before `build`. */
  add(material: number, chain: HairChain, segment: number, scale: Vector3, offset?: Vector3) {
    const index = this.strands.filter((strand) => strand.material === material).length;
    this.strands.push({
      material,
      index,
      chain,
      segment,
      scale,
      offset: offset ?? new Vector3(),
    });
  }

  /** Makes the meshes and adds them to `space`, the object the locks are placed in. */
  build(space: Object3D) {
    this.materials.forEach((material, which) => {
      const count = this.strands.filter((strand) => strand.material === which).length;
      const mesh = new InstancedMesh(this.geometry, material, Math.max(1, count));
      mesh.count = count;
      // The locks move every frame; a stale bounding sphere would cull them at the screen edge.
      mesh.frustumCulled = false;
      this.meshes.push(mesh);
      space.add(mesh);
    });
  }

  /** Places every lock on its chain. `space` is where the meshes live; its matrix must be current. */
  update(space: Object3D) {
    inverse.copy(space.matrixWorld).invert();
    for (const strand of this.strands) {
      const { chain, segment } = strand;
      top.copy(chain.point(segment)).applyMatrix4(inverse);
      velocity
        .subVectors(chain.point(segment + 1), chain.point(segment))
        .transformDirection(inverse);
      turn.setFromUnitVectors(DOWN, velocity);
      shift.copy(strand.offset).applyQuaternion(turn);
      placed.compose(top.add(shift), turn, strand.scale);
      this.meshes[strand.material].setMatrixAt(strand.index, placed);
    }
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }
}

const before = new Vector3();
const after = new Vector3();
const tangent = new Vector3();
const lateral = new Vector3();
const binormal = new Vector3();
const centre = new Vector3();
const across = new Vector3();
const SIDES = 10;

/**
 * One strand of a tail drawn as a smooth tube swept along a hair chain: narrow at the dock,
 * full in the middle, tapering to a fine tip, fanned out sideways toward the end so three
 * strands spread like a real tail. The surface is rebuilt from the chain every frame.
 */
export class HairTube {
  readonly mesh: Mesh<BufferGeometry, Material>;
  private readonly rings: number;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;

  constructor(
    private readonly chain: HairChain,
    material: Material,
    /** Sideways place of the strand: -1, 0 or 1. */
    private readonly offset: number,
    /** Widest half-width of the strand. */
    private readonly width: number,
  ) {
    // Two rings per segment, so the curve between chain points stays round.
    this.rings = chain.segments * 2 + 1;
    const count = this.rings * SIDES;
    this.positions = new Float32Array(count * 3);
    this.normals = new Float32Array(count * 3);
    const indices: number[] = [];
    for (let ring = 0; ring < this.rings - 1; ring++)
      for (let side = 0; side < SIDES; side++) {
        const a = ring * SIDES + side;
        const b = ring * SIDES + ((side + 1) % SIDES);
        indices.push(a, b, a + SIDES, b, b + SIDES, a + SIDES);
      }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(this.normals, 3));
    geometry.setIndex(indices);
    this.mesh = new Mesh(geometry, material);
    this.mesh.frustumCulled = false;
  }

  /**
   * Rebuilds the surface in the mesh's parent space. `side` is the pony's sideways axis in
   * world space; the strand stays flat across it like a real tail.
   */
  update(side: Vector3) {
    const space = this.mesh.parent;
    if (!space) return;
    inverse.copy(space.matrixWorld).invert();
    const last = this.rings - 1;
    for (let ring = 0; ring <= last; ring++) {
      this.sample(ring / 2, centre);
      this.sample(Math.max(0, ring - 1) / 2, before);
      this.sample(Math.min(last, ring + 1) / 2, after);
      tangent.subVectors(after, before).normalize();
      lateral.copy(side).addScaledVector(tangent, -side.dot(tangent)).normalize();
      binormal.crossVectors(tangent, lateral);
      const along = ring / last;
      // Narrow at the dock, full by a third of the way, then a long taper to a fine tip.
      const radius =
        this.width *
        (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, along * 1.5 + 0.1)) ** 0.7) *
        (1 - along ** 3 * 0.85);
      centre.addScaledVector(lateral, this.offset * this.width * (0.35 + along * 1.1));
      centre.addScaledVector(binormal, this.offset === 0 ? -this.width * 0.25 : 0);
      for (let step = 0; step < SIDES; step++) {
        const angle = (step / SIDES) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        across
          .copy(lateral)
          .multiplyScalar(cos)
          .addScaledVector(binormal, sin * 0.75);
        const at = (ring * SIDES + step) * 3;
        top.copy(centre).addScaledVector(across, radius).applyMatrix4(inverse);
        this.positions[at] = top.x;
        this.positions[at + 1] = top.y;
        this.positions[at + 2] = top.z;
        across.transformDirection(inverse);
        this.normals[at] = across.x;
        this.normals[at + 1] = across.y;
        this.normals[at + 2] = across.z;
      }
    }
    const geometry = this.mesh.geometry;
    geometry.getAttribute('position').needsUpdate = true;
    geometry.getAttribute('normal').needsUpdate = true;
  }

  /** A point on the smooth curve through the chain; `at` counts segments from the dock. */
  private sample(at: number, target: Vector3): Vector3 {
    const chain = this.chain;
    const index = Math.floor(at);
    if (at === index) return target.copy(chain.point(index));
    // Halfway between two chain points on a Catmull-Rom curve through their neighbours.
    const p0 = chain.point(Math.max(0, index - 1));
    const p1 = chain.point(index);
    const p2 = chain.point(index + 1);
    const p3 = chain.point(Math.min(chain.segments, index + 2));
    return target
      .copy(p1)
      .add(p2)
      .multiplyScalar(9 / 16)
      .addScaledVector(p0, -1 / 16)
      .addScaledVector(p3, -1 / 16);
  }
}
