import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { RacerId } from './race';
import type { Outfit } from './race-store';
import {
  COATS,
  hasHorn,
  hasWings,
  Horse,
  HORNS,
  HornPaint,
  LUMI,
  MANES,
  Marking,
  spotColour,
} from './horse';
interface Look {
  readonly coat: string;
  readonly shade: string;
  readonly mane: readonly [string, string, string];
  readonly horn: boolean;
  /** The horn's colour and its groove. */
  readonly hornPaint: HornPaint;
  readonly wings: boolean;
  readonly marking: Marking;
  /** The colour of the markings, and of spots, which are dark on a pale coat. */
  readonly mark: string;
  readonly spot: string;
  /** The flight feathers; the coverts above them take the coat's shade. */
  readonly feather: string;
  readonly bow: boolean;
  readonly crown: boolean;
  /** Below 1 the pony is see-through, like a shadow. */
  readonly opacity: number;
}
type Rival = Exclude<RacerId, 'player' | 'shadow'>;
const RIVALS: Readonly<Record<Rival, Look>> = {
  cloud: {
    coat: '#dccbff',
    shade: '#b9a3ef',
    mane: ['#fdf6ff', '#ead9ff', '#c9b1ff'],
    horn: false,
    hornPaint: HORNS.gold,
    wings: true,
    marking: 'none',
    mark: '#fffdfd',
    spot: '#fffdfd',
    feather: '#fdf6ff',
    bow: false,
    crown: false,
    opacity: 1,
  },
  mint: {
    coat: '#cdf3dd',
    shade: '#9fd9b6',
    mane: ['#ff9ed1', '#ffc3e3', '#ff7bbd'],
    horn: true,
    hornPaint: HORNS.gold,
    wings: false,
    marking: 'none',
    mark: '#fffdfd',
    spot: '#fffdfd',
    feather: '#fdf6ff',
    bow: false,
    crown: false,
    opacity: 1,
  },
  peach: {
    coat: '#ffd8bb',
    shade: '#f0b48e',
    mane: ['#fff0b8', '#ffe58a', '#ffd766'],
    horn: false,
    hornPaint: HORNS.gold,
    wings: false,
    marking: 'none',
    mark: '#fffdfd',
    spot: '#fffdfd',
    feather: '#fdf6ff',
    bow: true,
    crown: false,
    opacity: 1,
  },
  storm: {
    coat: '#8f98c4',
    shade: '#6b739e',
    mane: ['#4b3a70', '#6d4a9a', '#3a2f5c'],
    horn: false,
    hornPaint: HORNS.gold,
    wings: true,
    marking: 'none',
    mark: '#fffdfd',
    spot: '#fffdfd',
    feather: '#c3c9e6',
    bow: false,
    crown: true,
    opacity: 1,
  },
};
/** The shadow keeps its ghostly lilac but takes the shape of the child's horse. */
const GHOST = {
  coat: '#c9b8ff',
  shade: '#b09cf2',
  mark: '#c9b8ff',
  mane: ['#e2d6ff', '#d2c2ff', '#efe8ff'],
} as const;
/** How a racer looks: the rivals are fixed, the child's horse and its shadow follow the Stable. */
function lookFor(id: RacerId, horse: Horse): Look {
  if (id !== 'player' && id !== 'shadow') return RIVALS[id];
  const paint = id === 'shadow' ? GHOST : { ...COATS[horse.coat], mane: MANES[horse.mane] };
  const ghost = id === 'shadow';
  return {
    ...paint,
    horn: hasHorn(horse.kind),
    hornPaint: ghost ? HORNS.gold : HORNS[horse.horn],
    wings: hasWings(horse.kind),
    marking: ghost ? 'none' : horse.marking,
    spot: ghost ? GHOST.mark : spotColour(horse.coat),
    // Pale feathers on any coat: a lighter take on the coat, so a dark horse has dusky wings.
    feather: new Color(paint.coat).lerp(new Color('#ffffff'), 0.7).getStyle(),
    bow: false,
    crown: false,
    opacity: ghost ? 0.5 : 1,
  };
}
export const RAINBOW = ['#ff6f91', '#ffb347', '#ffe066', '#7ddf9b', '#7cc7ff', '#b79bff'];
const INK = '#26224a';
const GOLD = '#ffd54a';
const UP = new Vector3(0, 1, 0);
/** One cross-section of a lofted shape: its centre on the spine and its half width and depth. */
interface Ring {
  readonly y: number;
  readonly z: number;
  readonly rx: number;
  readonly ry: number;
}
/**
 * Skins a row of elliptical rings into one smooth surface. The rings sit on a spine in the
 * y-z plane and each one is turned to face along it, so a bent spine gives an arched neck
 * or a sloping face rather than a stack of slices.
 */
function loft(rings: readonly Ring[], segments = 16): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  rings.forEach((ring, index) => {
    const before = rings[Math.max(0, index - 1)];
    const after = rings[Math.min(rings.length - 1, index + 1)];
    const length = Math.hypot(after.y - before.y, after.z - before.z) || 1;
    const ny = -(after.z - before.z) / length;
    const nz = (after.y - before.y) / length;
    for (let step = 0; step < segments; step++) {
      const angle = (step / segments) * Math.PI * 2;
      const across = Math.cos(angle) * ring.rx;
      const along = Math.sin(angle) * ring.ry;
      positions.push(across, ring.y + ny * along, ring.z + nz * along);
    }
  });
  for (let ring = 0; ring < rings.length - 1; ring++)
    for (let step = 0; step < segments; step++) {
      const a = ring * segments + step;
      const b = ring * segments + ((step + 1) % segments);
      indices.push(a, a + segments, b, b, a + segments, b + segments);
    }
  const first = rings[0];
  const last = rings[rings.length - 1];
  const start = positions.length / 3;
  positions.push(0, first.y, first.z, 0, last.y, last.z);
  const tail = (rings.length - 1) * segments;
  for (let step = 0; step < segments; step++) {
    const next = (step + 1) % segments;
    indices.push(start, step, next, start + 1, tail + next, tail + step);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
/** A tapered limb segment from one joint to the next. */
function limb(from: Vector3, to: Vector3, startRadius: number, endRadius: number, skin: Material) {
  const direction = to.clone().sub(from);
  const mesh = new Mesh(
    new CylinderGeometry(endRadius, startRadius, direction.length(), 10, 1),
    skin,
  );
  mesh.position.copy(from).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  return mesh;
}
/** A sphere squashed into an ellipsoid, for joints, muscles and soft details. */
function blob(rx: number, ry: number, rz: number, skin: Material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(BALL, skin);
  mesh.scale.set(rx, ry, rz);
  mesh.position.set(x, y, z);
  return mesh;
}
const BALL = new SphereGeometry(1, 14, 10);
/** A lock of hair or a feather: an ellipsoid that hangs from its top instead of its middle. */
const LOCK = new SphereGeometry(1, 10, 8).translate(0, -1, 0);
const FEATHER = new SphereGeometry(1, 10, 6).translate(1, 0, 0);
/** The body from rump to chest; the top line dips behind the withers like a real back. */
const BODY: readonly Ring[] = [
  { y: 1.24, z: 0.81, rx: 0.05, ry: 0.07 },
  { y: 1.24, z: 0.76, rx: 0.19, ry: 0.21 },
  { y: 1.23, z: 0.62, rx: 0.27, ry: 0.29 },
  { y: 1.21, z: 0.42, rx: 0.33, ry: 0.33 },
  { y: 1.17, z: 0.16, rx: 0.32, ry: 0.31 },
  { y: 1.13, z: -0.1, rx: 0.34, ry: 0.34 },
  { y: 1.13, z: -0.35, rx: 0.335, ry: 0.36 },
  { y: 1.17, z: -0.55, rx: 0.3, ry: 0.37 },
  { y: 1.19, z: -0.7, rx: 0.24, ry: 0.31 },
  { y: 1.19, z: -0.8, rx: 0.12, ry: 0.18 },
  { y: 1.19, z: -0.85, rx: 0.04, ry: 0.06 },
];
/** The neck, measured from its pivot at the withers up to the poll. */
const NECK: readonly Ring[] = [
  { y: -0.1, z: 0.1, rx: 0.2, ry: 0.3 },
  { y: 0.13, z: -0.1, rx: 0.175, ry: 0.26 },
  { y: 0.34, z: -0.24, rx: 0.145, ry: 0.205 },
  { y: 0.54, z: -0.36, rx: 0.12, ry: 0.165 },
  { y: 0.7, z: -0.46, rx: 0.105, ry: 0.14 },
  { y: 0.78, z: -0.52, rx: 0.07, ry: 0.09 },
];
/** The head, measured from the poll down the face to the nose. */
const HEAD: readonly Ring[] = [
  { y: 0.05, z: 0.07, rx: 0.07, ry: 0.08 },
  { y: 0, z: 0, rx: 0.125, ry: 0.15 },
  { y: -0.1, z: -0.11, rx: 0.135, ry: 0.165 },
  { y: -0.22, z: -0.23, rx: 0.108, ry: 0.128 },
  { y: -0.33, z: -0.34, rx: 0.088, ry: 0.102 },
  { y: -0.41, z: -0.43, rx: 0.084, ry: 0.096 },
  { y: -0.46, z: -0.48, rx: 0.05, ry: 0.06 },
];
const NECK_PIVOT = new Vector3(0, 1.28, -0.52);
const HEAD_PIVOT = new Vector3(0, 0.7, -0.46);
/** Where the body rocks from: the hips, so a rearing pony keeps its hind hooves down. */
const HIPS = new Vector3(0, 1.05, 0.45);
interface Leg {
  readonly hip: Group;
  readonly knee: Group;
  readonly front: boolean;
  /** Where in the stride this leg is, so the four hooves land one after another. */
  readonly offset: number;
}
interface Strand {
  readonly pivot: Group;
  readonly rest: number;
  readonly side: number;
}
/** What the pony is doing this frame; the world works it out from the race. */
export interface PonyPose {
  readonly now: number;
  readonly dt: number;
  /** Track units per second. */
  readonly speed: number;
  readonly moving: boolean;
  /** Standing at the start line, eager to go. */
  readonly waiting: boolean;
  readonly stumbling: boolean;
  /** Rearing on the finish line after a win. */
  readonly celebrating: boolean;
  /** Standing on the finish line, pleased with the race: little hops and a nodding head. */
  readonly cheering: boolean;
  /** Extra lift for the wings, in radians, to show them off on the Stable's stand. */
  readonly wingLift?: number;
}
/**
 * One racer, modelled like a real horse: a lofted body, an arched neck and a long face,
 * legs with knees, hocks and hooves, and a mane and tail made of locks that stream in the
 * gallop. Faces down the track (-z) and stands on y = 0.
 */
export class Pony {
  readonly root = new Group();
  private readonly frame = new Group();
  private readonly neck = new Group();
  private readonly head = new Group();
  private readonly legs: Leg[] = [];
  private readonly mane: Strand[] = [];
  private readonly tail: Group[] = [];
  private readonly wings: Group[] = [];
  private readonly ghost: boolean;
  private phase = 0;
  private pitch = 0;
  private reach = 0;
  private flow = 0;
  constructor(
    readonly id: RacerId,
    outfit: Outfit | null = null,
    horse: Horse = LUMI,
  ) {
    const look = lookFor(id, horse);
    this.ghost = look.opacity < 1;
    const skin = (color: string, roughness = 0.62) =>
      new MeshStandardMaterial({
        color,
        roughness,
        metalness: 0,
        transparent: this.ghost,
        opacity: look.opacity,
      });
    const coat = skin(look.coat);
    const shade = skin(look.shade);
    const hoof = skin(new Color(look.shade).multiplyScalar(0.55).getStyle(), 0.4);
    const mark = skin(look.mark);
    const hair = look.mane.map((color) => skin(color, 0.48));
    const ink = skin(INK, 0.3);
    // Everything hangs off a frame that rocks around the hips.
    const body = new Group();
    body.position.copy(HIPS).negate();
    this.frame.position.copy(HIPS);
    this.frame.add(body);
    this.root.add(this.frame);
    body.add(new Mesh(loft(BODY, 18), coat));
    this.neck.position.copy(NECK_PIVOT);
    this.neck.add(new Mesh(loft(NECK), coat));
    body.add(this.neck);
    this.head.position.copy(HEAD_PIVOT);
    this.neck.add(this.head);
    this.buildHead(look, coat, shade, ink, hair, mark);
    this.buildMane(hair);
    this.buildTail(body, hair);
    for (const front of [true, false])
      for (const side of [-1, 1]) {
        const leg = makeLeg(front, side, coat, hoof, look.marking === 'socks' ? mark : coat);
        body.add(leg.hip);
        this.legs.push(leg);
      }
    if (look.marking === 'spots') addSpots(body, skin(look.spot));
    if (look.wings) {
      const feather = skin(look.feather, 0.7);
      for (const side of [-1, 1]) this.addWing(body, side, feather, shade);
    }
    if (look.bow) {
      const ribbon = skin('#ff6fa6', 0.5);
      for (const side of [-1, 1])
        this.tail[0].add(blob(0.09, 0.06, 0.035, ribbon, side * 0.085, 0.02, 0.01));
      this.tail[0].add(blob(0.035, 0.035, 0.035, ribbon, 0, 0.02, 0.02));
    }
    if (look.crown) {
      const gold = skin(GOLD, 0.35);
      this.addCrown(gold, 3);
      const key = new Group();
      const ring = new Mesh(new TorusGeometry(0.075, 0.022, 6, 12), gold);
      ring.rotation.y = Math.PI / 2;
      key.add(ring);
      const shaft = new Mesh(new CylinderGeometry(0.02, 0.02, 0.24, 6), gold);
      shaft.position.y = -0.19;
      key.add(shaft);
      key.position.set(0.33, 1.12, -0.05);
      body.add(key);
    }
    // A horse with wings of its own keeps them rather than wearing a second pair.
    if (outfit && !(outfit === 'wings' && look.wings)) this.dress(body, outfit, skin);
    this.root.traverse((part) => {
      if (part instanceof Mesh) part.castShadow = !this.ghost;
    });
    this.settle();
  }
  /** Moves the pony for one frame. */
  update(pose: PonyPose) {
    const { now, dt, speed, moving, waiting, stumbling, celebrating, cheering } = pose;
    const ease = (rate: number) => Math.min(1, dt * rate);
    const stride = moving ? speed : 0;
    // How hard it is running, 0 at a stand and 1 at a flat-out gallop.
    const effort = moving ? Math.min(1, 0.3 + stride * 0.12) : 0;
    this.phase += stride * dt * 2.4;
    const reach = moving ? effort : 0;
    this.reach += (reach - this.reach) * ease(6);
    this.flow += (effort - this.flow) * ease(4);
    for (const leg of this.legs) {
      const angle = this.phase + leg.offset;
      const swing = Math.sin(angle) * 0.85 * this.reach;
      // The leg folds while it swings forward and straightens to push off.
      const fold = Math.max(0, Math.cos(angle)) * this.reach;
      leg.hip.rotation.x = swing + (leg.front ? 0.12 : -0.1) * this.reach;
      leg.knee.rotation.x = -fold * (leg.front ? 1.5 : 1.15);
    }
    let pitch = Math.sin(this.phase + 0.5) * 0.07 * this.reach;
    let lift = Math.max(0, Math.sin(this.phase + 1.2)) * 0.11 * this.reach;
    let neck = -0.32 * this.reach + Math.sin(this.phase + 2) * 0.07 * this.reach;
    let nod = Math.sin(this.phase + 2.6) * 0.08 * this.reach;
    const seed = this.root.position.x;
    if (waiting) {
      // At the line: one front hoof paws the ground and the head tosses.
      const paw = Math.max(0, Math.sin(now * 3 + seed));
      this.legs[0].hip.rotation.x = paw * 0.5;
      this.legs[0].knee.rotation.x = -paw * 1.1;
      neck = Math.sin(now * 2 + seed) * 0.1;
      nod = Math.sin(now * 2.6 + seed) * 0.14;
    }
    if (stumbling) {
      // A stumble pitches the pony onto its knees with its nose near the ground.
      pitch = -0.3 + Math.sin(now * 40) * 0.03;
      lift = -0.1;
      neck = -0.55;
      nod = -0.4 + Math.sin(now * 30) * 0.08;
      for (const leg of this.legs)
        if (leg.front) {
          leg.hip.rotation.x = 0.75;
          leg.knee.rotation.x = -1.7;
        } else {
          leg.hip.rotation.x = 0.3;
          leg.knee.rotation.x = 0;
        }
    }
    if (cheering) {
      const beat = now * 4.5 + seed * 1.3;
      const hop = Math.abs(Math.sin(beat));
      const paw = Math.max(0, Math.sin(beat * 0.5));
      lift = hop * 0.07;
      pitch = 0.03;
      neck = 0.08;
      nod = Math.sin(beat) * 0.24;
      this.legs[1].hip.rotation.x = paw * 0.45;
      this.legs[1].knee.rotation.x = -paw * 1;
    }
    if (celebrating) {
      // The winner rears up, paws the air and tosses its head.
      const hop = Math.abs(Math.sin(now * 5));
      pitch = 0.6 + hop * 0.12;
      lift = hop * 0.12;
      neck = -0.25;
      nod = 0.25 + Math.sin(now * 6) * 0.15;
      for (const leg of this.legs)
        if (leg.front) {
          const paw = Math.sin(now * 9 + (leg.offset > -2.6 ? 0 : 1.6));
          leg.hip.rotation.x = 0.7 + paw * 0.3;
          leg.knee.rotation.x = -1.3 + paw * 0.4;
        } else {
          leg.hip.rotation.x = -pitch;
          leg.knee.rotation.x = 0;
        }
    }
    this.pitch += (pitch - this.pitch) * ease(celebrating || stumbling ? 9 : 14);
    this.frame.rotation.x = this.pitch;
    this.frame.rotation.z = stumbling ? Math.sin(now * 40) * 0.05 : 0;
    this.frame.position.y = HIPS.y + lift + (this.ghost ? 0.15 + Math.sin(now * 3) * 0.05 : 0);
    this.neck.rotation.x += (neck - this.neck.rotation.x) * ease(12);
    this.head.rotation.x += (nod - this.head.rotation.x) * ease(12);
    // Hair and tail stream back with speed and ripple along their length.
    for (const [index, strand] of this.mane.entries()) {
      const ripple = Math.sin(now * 9 + index * 0.9) * (0.05 + 0.12 * this.flow);
      strand.pivot.rotation.x = strand.rest - this.flow * 0.75 + ripple;
      strand.pivot.rotation.z = strand.side * (0.5 - this.flow * 0.22);
    }
    this.tail.forEach((segment, index) => {
      const wave = Math.sin(now * (3 + this.flow * 7) - index * 0.9);
      const hang = index === 0 ? -0.5 : 0.2;
      const stream = index === 0 ? -0.85 : -0.14;
      segment.rotation.x = hang + stream * this.flow + wave * (0.04 + this.flow * 0.06);
      segment.rotation.z = Math.cos(now * 2.2 + seed - index * 0.7) * (0.07 + this.flow * 0.07);
    });
    for (const wing of this.wings) {
      const flap = moving ? Math.sin(this.phase * 1.5) * 0.5 : Math.sin(now * 2) * 0.07;
      wing.rotation.z = (moving ? 0.35 : 0.1) + flap + (pose.wingLift ?? 0);
    }
  }
  /** A standing pose, so a pony that has not been animated yet still looks right. */
  private settle() {
    this.update({
      now: 0,
      dt: 1,
      speed: 0,
      moving: false,
      waiting: false,
      stumbling: false,
      celebrating: false,
      cheering: false,
    });
  }
  private buildHead(
    look: Look,
    coat: Material,
    shade: Material,
    ink: Material,
    hair: readonly Material[],
    mark: Material,
  ) {
    const head = this.head;
    head.add(new Mesh(loft(HEAD), coat));
    // A star sits between the eyes; a blaze runs from there down to the nose.
    if (look.marking === 'star') head.add(new Mesh(faceStripe(2, 3, 0.05), mark));
    if (look.marking === 'blaze') head.add(new Mesh(faceStripe(1.6, 5.2, 0.045), mark));
    head.add(blob(0.09, 0.1, 0.105, shade, 0, -0.415, -0.435));
    const glint = new MeshBasicMaterial({
      color: '#ffffff',
      transparent: this.ghost,
      opacity: look.opacity,
    });
    for (const side of [-1, 1]) {
      head.add(blob(0.022, 0.044, 0.044, ink, side * 0.122, -0.075, -0.115));
      head.add(blob(0.012, 0.014, 0.014, glint, side * 0.136, -0.058, -0.13));
      head.add(blob(0.012, 0.02, 0.016, ink, side * 0.045, -0.445, -0.515));
      const ear = new Mesh(new ConeGeometry(0.055, 0.19, 8), coat);
      ear.scale.z = 0.6;
      ear.position.set(side * 0.085, 0.16, 0);
      ear.rotation.set(-0.2, 0, side * -0.28);
      head.add(ear);
    }
    if (look.horn) {
      // A spiralled horn: a slim cone wound with a few darker turns.
      const horn = new Group();
      const gold = new MeshStandardMaterial({
        color: look.hornPaint[0],
        roughness: 0.3,
        transparent: this.ghost,
        opacity: look.opacity,
      });
      const cone = new Mesh(new ConeGeometry(0.048, 0.46, 10), gold);
      cone.position.y = 0.23;
      horn.add(cone);
      const groove = new MeshStandardMaterial({
        color: look.hornPaint[1],
        roughness: 0.4,
        transparent: this.ghost,
        opacity: look.opacity,
      });
      for (let turn = 0; turn < 4; turn++) {
        const radius = 0.043 * (1 - (turn + 0.6) / 5.2);
        const band = new Mesh(new TorusGeometry(radius, 0.008, 5, 12), groove);
        band.rotation.set(Math.PI / 2 + 0.35, 0, 0);
        band.position.y = 0.06 + turn * 0.085;
        horn.add(band);
      }
      horn.position.set(0, 0.02, -0.215);
      horn.rotation.x = -0.62;
      head.add(horn);
    }
    // The forelock falls between the ears and down the forehead.
    for (const [index, side] of [-1, 0, 1].entries()) {
      const lock = new Mesh(LOCK, hair[index]);
      lock.scale.set(0.045, 0.1, 0.035);
      lock.position.set(side * 0.05, 0.13, -0.05);
      lock.rotation.set(0.95, 0, side * 0.25);
      head.add(lock);
    }
  }
  /** Locks along the crest of the neck, falling to both sides. */
  private buildMane(hair: readonly Material[]) {
    const crest = NECK.map((ring, index) => {
      const before = NECK[Math.max(0, index - 1)];
      const after = NECK[Math.min(NECK.length - 1, index + 1)];
      const length = Math.hypot(after.y - before.y, after.z - before.z) || 1;
      return new Vector3(
        0,
        ring.y - ((after.z - before.z) / length) * ring.ry,
        ring.z + ((after.y - before.y) / length) * ring.ry,
      );
    });
    const ridge: Ring[] = [];
    const locks = 15;
    for (let index = 0; index < locks; index++) {
      // From just behind the ears down to the withers.
      const along = 4.5 - (index / (locks - 1)) * 3.9;
      const from = crest[Math.floor(along)];
      const to = crest[Math.min(crest.length - 1, Math.floor(along) + 1)];
      const point = from.clone().lerp(to, along % 1);
      ridge.push({ y: point.y - 0.012, z: point.z - 0.008, rx: 0.05, ry: 0.045 });
      const pivot = new Group();
      pivot.position.copy(point);
      const side = index % 2 ? 1 : -1;
      const lock = new Mesh(LOCK, hair[index % hair.length]);
      const length = 0.17 + (index / (locks - 1)) * 0.08;
      lock.scale.set(0.034, length, 0.095);
      pivot.add(lock);
      this.neck.add(pivot);
      this.mane.push({ pivot, rest: -0.3, side });
    }
    this.neck.add(new Mesh(loft(ridge, 8), hair[0]));
  }
  /** A tail of six jointed lengths, three strands wide, that swings and streams. */
  private buildTail(body: Group, hair: readonly Material[]) {
    const widths = [0.06, 0.095, 0.115, 0.115, 0.095, 0.06];
    let parent: Group = body;
    widths.forEach((width, index) => {
      const segment = new Group();
      if (index === 0) segment.position.set(0, 1.36, 0.76);
      else segment.position.y = -0.17;
      for (const [strand, x] of [-1, 0, 1].entries()) {
        const lock = new Mesh(LOCK, hair[strand]);
        lock.scale.set(width * 0.62, 0.2, width);
        lock.position.set(x * width * 0.62, 0.06, x === 0 ? 0.015 : 0);
        segment.add(lock);
      }
      parent.add(segment);
      parent = segment;
      this.tail.push(segment);
    });
  }
  /** A wing of overlapping flight feathers under a row of shorter coverts. */
  private addWing(body: Group, side: number, feather: Material, covert: Material) {
    const mirror = new Group();
    mirror.scale.x = side;
    const pivot = new Group();
    pivot.position.set(0.19, 1.43, -0.32);
    for (let index = 0; index < 8; index++) {
      const spread = index / 7;
      const holder = new Group();
      const blade = new Mesh(FEATHER, feather);
      blade.scale.set(0.46 - spread * 0.2, 0.014, 0.08);
      holder.rotation.y = 0.25 - spread * 1.25;
      holder.position.y = -spread * 0.02;
      holder.add(blade);
      pivot.add(holder);
    }
    for (let index = 0; index < 5; index++) {
      const spread = index / 4;
      const holder = new Group();
      const blade = new Mesh(FEATHER, covert);
      blade.scale.set(0.2 - spread * 0.06, 0.016, 0.075);
      holder.rotation.y = 0.15 - spread * 1.1;
      holder.position.y = 0.022;
      holder.add(blade);
      pivot.add(holder);
    }
    mirror.add(pivot);
    body.add(mirror);
    this.wings.push(pivot);
  }
  private addCrown(gold: Material, points: number, gem?: Material) {
    const crown = new Group();
    const band = new Mesh(new TorusGeometry(0.105, 0.028, 6, 14), gold);
    band.rotation.x = Math.PI / 2;
    crown.add(band);
    for (let index = 0; index < points; index++) {
      const angle = (index / points) * Math.PI * 2;
      const point = new Mesh(new ConeGeometry(0.032, 0.12, 4), gold);
      point.position.set(Math.sin(angle) * 0.1, 0.07, -Math.cos(angle) * 0.1);
      crown.add(point);
    }
    if (gem) crown.add(blob(0.035, 0.035, 0.035, gem, 0, 0.02, -0.12));
    crown.position.set(0, 0.17, 0.02);
    crown.rotation.x = -0.25;
    this.head.add(crown);
  }
  /** The keepsake from a finished cup, worn on top of Lumi's usual look. */
  private dress(
    body: Group,
    outfit: Outfit,
    skin: (color: string, roughness?: number) => Material,
  ) {
    switch (outfit) {
      case 'wreath': {
        const petals = ['#ff8fb8', '#ffd36b', '#ffffff', '#b79bff'].map((color) => skin(color));
        const wreath = new Group();
        for (let index = 0; index < 10; index++) {
          const angle = (index / 10) * Math.PI * 2;
          wreath.add(
            blob(
              0.05,
              0.04,
              0.05,
              petals[index % 4],
              Math.sin(angle) * 0.14,
              0,
              Math.cos(angle) * 0.14,
            ),
          );
        }
        wreath.position.set(0, 0.13, -0.02);
        wreath.rotation.x = -0.3;
        this.head.add(wreath);
        return;
      }
      case 'wings': {
        const feather = skin('#ffffff', 0.7);
        const covert = skin('#e7d8ee', 0.7);
        for (const side of [-1, 1]) this.addWing(body, side, feather, covert);
        return;
      }
      case 'tiara': {
        const silver = skin('#e8e4ff', 0.3);
        const tiara = new Group();
        const band = new Mesh(new TorusGeometry(0.12, 0.022, 6, 14, Math.PI), silver);
        tiara.add(band);
        const star = new MeshBasicMaterial({ color: '#fff4c2' });
        for (const [x, y] of [
          [0, 0.16],
          [-0.085, 0.1],
          [0.085, 0.1],
        ])
          tiara.add(blob(0.035, 0.035, 0.03, star, x, y, 0));
        tiara.position.set(0, 0.1, -0.06);
        tiara.rotation.x = -0.55;
        this.head.add(tiara);
        return;
      }
      case 'crown':
        this.addCrown(skin(GOLD, 0.35), 5, skin('#ff6f91', 0.3));
        return;
      case 'cape':
        // A rainbow blanket over the back, one stripe per colour, wrapped round the barrel.
        RAINBOW.forEach((color, index) => {
          const stripe = new Mesh(
            loft(
              [
                { y: 0.33, z: 0.72, rx: 0.02, ry: 0.01 },
                { y: 0.365, z: 0.6, rx: 0.06, ry: 0.016 },
                { y: 0.335, z: 0.1, rx: 0.06, ry: 0.016 },
                { y: 0.35, z: -0.35, rx: 0.06, ry: 0.016 },
                { y: 0.33, z: -0.45, rx: 0.02, ry: 0.01 },
              ],
              6,
            ),
            skin(color, 0.6),
          );
          const wrap = new Group();
          wrap.position.y = 1.17;
          wrap.rotation.z = ((2.5 - index) / 2.5) * 0.95;
          wrap.add(stripe);
          body.add(wrap);
        });
        return;
    }
  }
}
function makeLeg(
  front: boolean,
  side: number,
  coat: Material,
  hoof: Material,
  sock: Material,
): Leg {
  const hip = new Group();
  const knee = new Group();
  const at = (y: number, z = 0) => new Vector3(0, y, z);
  if (front) {
    hip.position.set(side * 0.17, 0.98, -0.56);
    hip.add(blob(0.12, 0.24, 0.17, coat, 0, 0.05, 0.01));
    hip.add(limb(at(0), at(-0.46), 0.11, 0.07, coat));
    knee.position.set(0, -0.46, 0);
    knee.add(blob(0.073, 0.08, 0.073, coat));
    knee.add(limb(at(0), at(-0.36), 0.064, 0.05, sock));
    knee.add(blob(0.06, 0.065, 0.062, sock, 0, -0.37, 0.004));
    const shoe = new Mesh(new CylinderGeometry(0.058, 0.08, 0.12, 12), hoof);
    shoe.position.set(0, -0.45, -0.01);
    knee.add(shoe);
  } else {
    // A hind leg zigzags: thigh forward to the stifle, back to the hock, then straight down.
    hip.position.set(side * 0.18, 1.09, 0.5);
    const stifle = at(-0.3, -0.12);
    const hock = at(-0.56, 0.07);
    hip.add(blob(0.15, 0.3, 0.27, coat, -side * 0.02, 0.0, -0.03));
    hip.add(limb(at(0.02, 0.02), stifle, 0.16, 0.105, coat));
    hip.add(blob(0.106, 0.11, 0.106, coat, 0, stifle.y, stifle.z));
    hip.add(limb(stifle, hock, 0.105, 0.066, coat));
    knee.position.copy(hock);
    knee.add(blob(0.068, 0.075, 0.07, coat));
    knee.add(limb(at(0), at(-0.37, -0.03), 0.062, 0.05, sock));
    knee.add(blob(0.06, 0.065, 0.062, sock, 0, -0.38, -0.028));
    const shoe = new Mesh(new CylinderGeometry(0.058, 0.08, 0.12, 12), hoof);
    shoe.position.set(0, -0.46, -0.04);
    knee.add(shoe);
  }
  hip.add(knee);
  // A gallop: the hind pair lands, then the front pair, each a beat apart.
  const offset = front ? (side < 0 ? -2.3 : -2.9) : side < 0 ? 0 : -0.6;
  return { hip, knee, front, offset };
}
/**
 * A white stripe down the front of the face, from one point along the head's rings to another
 * (fractional, so it can start between rings). It is a slim loft lifted just proud of the face.
 */
function faceStripe(from: number, to: number, width: number): BufferGeometry {
  const rings: Ring[] = [];
  const steps = 8;
  for (let step = 0; step <= steps; step++) {
    const at = from + ((to - from) * step) / steps;
    const index = Math.min(HEAD.length - 2, Math.floor(at));
    const a = HEAD[index];
    const b = HEAD[index + 1];
    const t = at - index;
    const y = a.y + (b.y - a.y) * t;
    const z = a.z + (b.z - a.z) * t;
    const ry = a.ry + (b.ry - a.ry) * t;
    const rx = a.rx + (b.rx - a.rx) * t;
    // The face's outward normal in the y-z plane, from the head's spine at this point.
    const length = Math.hypot(b.y - a.y, b.z - a.z) || 1;
    const ny = -(b.z - a.z) / length;
    const nz = (b.y - a.y) / length;
    // Taper both ends so a star is a diamond and a blaze narrows at the top.
    const taper = Math.sin((step / steps) * Math.PI) * 0.85 + 0.15;
    const half = Math.min(width, rx * 0.6) * taper;
    const lift = ry * 0.84;
    rings.push({ y: y + ny * lift, z: z + nz * lift, rx: half, ry: ry * 0.22 });
  }
  return loft(rings, 10);
}
/** Appaloosa spots over the rump and loins, set into the coat on both sides of the back. */
function addSpots(body: Group, mark: Material) {
  // Each spot: how far along the back (z), how high up the flank (0 at the side, 1.5 at the top), size.
  const spots: readonly (readonly [number, number, number])[] = [
    [0.62, 0.9, 0.06],
    [0.55, 0.45, 0.05],
    [0.5, 1.3, 0.05],
    [0.44, 0.7, 0.055],
    [0.36, 1.05, 0.045],
    [0.3, 0.4, 0.05],
    [0.24, 1.35, 0.04],
    [0.18, 0.75, 0.045],
    [0.68, 0.35, 0.04],
    [0.1, 1.05, 0.035],
  ];
  for (const side of [-1, 1])
    for (const [z, rise, size] of spots) {
      // Find the body's ring at this point along the back and sit the spot on its surface.
      const index = BODY.findIndex((ring) => ring.z <= z);
      const after = BODY[Math.max(1, index)];
      const before = BODY[Math.max(0, index - 1)];
      const t = (before.z - z) / (before.z - after.z || 1);
      const rx = before.rx + (after.rx - before.rx) * t;
      const ry = before.ry + (after.ry - before.ry) * t;
      const y = before.y + (after.y - before.y) * t;
      // Mostly sunk into the coat, so each spot reads as a patch, not a bead.
      const spot = blob(size, size * 0.8, size, mark);
      spot.position.set(
        side * Math.cos(rise) * rx * 0.9,
        y + Math.sin(rise) * ry * 0.9,
        z + side * 0.013,
      );
      body.add(spot);
    }
}
