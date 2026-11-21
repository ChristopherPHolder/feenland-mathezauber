import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
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
import { approach, smooth } from '../../shared/three/motion';
import type { RacerId } from './race';
import { HairChain, HairStrands, HairTube } from './race-hair';
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
/** An ear, standing on its base. */
const EAR = new ConeGeometry(0.055, 0.19, 8).translate(0, 0.095, 0);
const HANG = new Euler();
/** Which way a lock hangs at rest: straight down, turned by `x` (back) and `z` (to the side). */
function hang(x: number, z: number): Vector3 {
  return new Vector3(0, -1, 0).applyEuler(HANG.set(x, 0, z));
}
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
  /** -1 for the near (left) side, 1 for the right. */
  readonly side: number;
  /** Where in the stride this hoof lands at a trot and at a gallop, as a share of the stride. */
  readonly trot: number;
  readonly gallop: number;
  /** Where this leg was in its own stride last frame, to notice the hoof landing. */
  last: number;
}
/** A smoothly eased track of values over time: `[seconds, value]` pairs in order. */
type Keys = readonly (readonly [number, number])[];
function keyed(time: number, keys: Keys): number {
  if (time <= keys[0][0]) return keys[0][1];
  for (let index = 1; index < keys.length; index++) {
    const [to, value] = keys[index];
    if (time <= to) {
      const [from, before] = keys[index - 1];
      return before + (value - before) * smooth((time - from) / (to - from));
    }
  }
  return keys[keys.length - 1][1];
}
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
/**
 * A stumble, second by second: the front hoof catches, the pony pitches onto its knees with
 * its nose near the ground, slides, then pushes itself up with a hop and a toss of the head.
 */
const TRIP = {
  weight: [
    [0, 0],
    [0.06, 1],
    [0.85, 1],
    [1.1, 0],
  ] as Keys,
  pitch: [
    [0, 0],
    [0.13, -0.4],
    [0.5, -0.3],
    [0.74, 0.17],
    [0.98, 0],
  ] as Keys,
  lift: [
    [0, 0],
    [0.13, -0.04],
    [0.3, -0.15],
    [0.55, -0.13],
    [0.74, 0.09],
    [0.98, 0],
  ] as Keys,
  roll: [
    [0, 0],
    [0.15, 0.1],
    [0.4, -0.06],
    [0.7, 0],
  ] as Keys,
  neck: [
    [0, 0],
    [0.15, -0.62],
    [0.55, -0.55],
    [0.76, 0.22],
    [1, -0.1],
  ] as Keys,
  nod: [
    [0, 0],
    [0.15, -0.48],
    [0.55, -0.35],
    [0.8, 0.38],
    [1, 0],
  ] as Keys,
  kneel: [
    [0, 0],
    [0.09, 0.55],
    [0.2, 1],
    [0.56, 1],
    [0.76, 0],
  ] as Keys,
  kick: [
    [0, 0],
    [0.12, 1],
    [0.32, 0.35],
    [0.6, 0],
  ] as Keys,
  shake: [
    [0.25, 0],
    [0.32, 1],
    [0.58, 1],
    [0.66, 0],
  ] as Keys,
};
/** A right answer: a quick gather, then the pony stretches out into a burst of speed. */
const SURGE = {
  crouch: [
    [0, 0],
    [0.07, 1],
    [0.16, 0],
  ] as Keys,
  stretch: [
    [0.06, 0],
    [0.18, 1],
    [0.42, 0.3],
    [0.75, 0],
  ] as Keys,
};
/** The winner's rear, looped while it stands on the line: gather, rise, paw, land, hop. */
const REAR_SECONDS = 2.6;
const REAR = {
  pitch: [
    [0, 0],
    [0.22, -0.07],
    [0.56, 0.74],
    [1.32, 0.66],
    [1.68, 0],
    [1.8, -0.04],
    [2.6, 0],
  ] as Keys,
  lift: [
    [0, 0],
    [0.22, -0.08],
    [0.56, 0.1],
    [1.32, 0.08],
    [1.68, 0],
    [1.76, -0.06],
    [1.94, 0.1],
    [2.1, 0],
    [2.24, 0.06],
    [2.4, 0],
  ] as Keys,
  paw: [
    [0.4, 0],
    [0.6, 1],
    [1.3, 1],
    [1.55, 0],
  ] as Keys,
  neck: [
    [0, 0],
    [0.5, -0.32],
    [1.4, -0.2],
    [1.8, 0.06],
    [2.6, 0],
  ] as Keys,
  squash: [
    [1.6, 0],
    [1.7, 1],
    [1.84, 0],
    [1.94, 0],
    [2.0, 0.5],
    [2.12, 0],
  ] as Keys,
};
/** The moment in the rear the winner is at the top, when the world throws its confetti. */
const REAR_TOP = 0.56;
/** What the pony is doing this frame; the world works it out from the race. */
export interface PonyPose {
  readonly now: number;
  readonly dt: number;
  /** Metres per second over the ground. */
  readonly speed: number;
  readonly moving: boolean;
  /** Standing at the start line, eager to go. */
  readonly waiting: boolean;
  /** Rearing on the finish line after a win. */
  readonly celebrating: boolean;
  /** Standing on the finish line, pleased with the race: little hops and a nodding head. */
  readonly cheering: boolean;
  /** Wind from ahead in metres per second, for a pony that gallops on the spot. */
  readonly air?: number;
  /** Reduced motion: keep what tells the story (running, tripping, rearing), drop idle fidgets. */
  readonly calm?: boolean;
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
  /** Bit per leg (0 front left, 1 front right, 2 hind left, 3 hind right): hooves that landed this frame. */
  strikes = 0;
  /** True on the frame a rearing winner reaches the top. */
  reared = false;
  private readonly frame = new Group();
  private readonly body = new Group();
  private readonly neck = new Group();
  private readonly head = new Group();
  private readonly legs: Leg[] = [];
  private readonly ears: Group[] = [];
  private readonly wings: Group[] = [];
  private readonly ghost: boolean;
  /** Every lock of hair follows a chain: the tail, the mane along the crest and the forelock. */
  private readonly hair: HairStrands;
  private readonly tail: HairChain;
  /** The tail's three strands, drawn as smooth tubes along its chain. */
  private readonly strands: HairTube[];
  private readonly across = new Vector3();
  private readonly locks: HairChain[] = [];
  /** Sits where the tail leaves the body, turned with its first length; the bow hangs on it. */
  private readonly dock = new Group();
  /** Where in the stride the pony is, from 0 to 1. */
  private stride = 0;
  /** 0 at a trot, 1 at a gallop. */
  private gait = 0;
  private reach = 0;
  private effort = 0;
  private pitch = 0;
  private lift = 0;
  private surgeAt = -10;
  private tripAt = -10;
  private rearAt = -10;
  private wasRearing = false;
  /** A push for the hair, waiting for the frame's matrices. */
  private readonly push = new Vector3();
  private readonly wind = new Vector3();
  private pushing = false;
  /** The hair has not been placed on the track yet: drop it into shape instead of swinging it. */
  private fresh = true;
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
    this.hair = new HairStrands(LOCK, hair);
    // Everything hangs off a frame that rocks around the hips.
    const body = this.body;
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
    this.buildHead(look, coat, shade, ink, mark);
    this.buildMane(hair);
    this.tail = this.buildTail(body);
    this.strands = hair.map((material, index) => {
      const strand = new HairTube(this.tail, material, index - 1, 0.085);
      this.root.add(strand.mesh);
      return strand;
    });
    this.hair.build(this.root);
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
        this.dock.add(blob(0.09, 0.06, 0.035, ribbon, side * 0.085, -0.03, 0.01));
      this.dock.add(blob(0.035, 0.035, 0.035, ribbon, 0, -0.03, 0.02));
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
  /** A right answer: the pony gathers itself and bursts forward, its hair whipping back. */
  surge(now: number) {
    this.surgeAt = now;
    this.push.set(0, 1.2, 3.2);
    this.pushing = true;
  }
  /** A wrong answer: the pony catches a hoof, goes down onto its knees and scrambles up. */
  trip(now: number) {
    this.tripAt = now;
    // The hair flops forward over the pony as it pitches down.
    this.push.set(0, -1, -2.6);
    this.pushing = true;
  }
  /** Where hoof `index` (as in `strikes`) touches the ground, in world space. */
  hoof(index: number, target: Vector3): Vector3 {
    return this.legs[index].knee.localToWorld(target.set(0, -0.5, 0));
  }
  /** Moves the pony for one frame. */
  update(pose: PonyPose, hair = true) {
    const { now, dt, moving, waiting, celebrating, cheering } = pose;
    const calm = !!pose.calm;
    const run = moving ? Math.max(0, pose.speed) : 0;
    // A trot (diagonal pairs) below about 2.5 m/s, a four-beat gallop above about 5.
    this.gait = approach(this.gait, smooth((run - 2.2) / 2.8), 3, dt);
    this.reach = approach(this.reach, moving ? 1 : 0, 6, dt);
    this.effort = approach(this.effort, moving ? Math.min(1, 0.2 + run * 0.12) : 0, 4, dt);
    const { gait, reach, effort } = this;
    // Strides come a little quicker with speed; mostly they get longer, as a real horse's do.
    const duty = lerp(0.5, 0.36, gait);
    const rate = Math.min(2.6, 1.3 + run * 0.2);
    const sweep = Math.max(0.16, Math.min(0.62, (run * duty) / (1.9 * rate))) * reach;
    const surge = now - this.surgeAt;
    const crouch = keyed(surge, SURGE.crouch);
    const stretch = keyed(surge, SURGE.stretch);
    this.stride = (this.stride + dt * rate * (1 + stretch * 0.9)) % 1;
    // Each leg plants and pushes back while its hoof is down, then folds and swings forward.
    let frontLoad = 0;
    let hindLoad = 0;
    this.strikes = 0;
    for (let index = 0; index < this.legs.length; index++) {
      const leg = this.legs[index];
      const offset = lerp(leg.trot, leg.gallop, gait);
      const at = (this.stride - offset + 2) % 1;
      if (moving && at < leg.last && reach > 0.5) this.strikes |= 1 << index;
      leg.last = at;
      let swing: number;
      let fold = 0;
      if (at < duty) {
        const share = at / duty;
        swing = sweep * (1 - 2 * share);
        const load = Math.sin(Math.PI * share);
        if (leg.front) frontLoad += load;
        else hindLoad += load;
      } else {
        const share = (at - duty) / (1 - duty);
        swing = -sweep + 2 * sweep * smooth(share) + sweep * 0.18 * Math.sin(Math.PI * share);
        fold = Math.sin(Math.PI * Math.min(1, share * 1.15));
      }
      leg.hip.rotation.x = swing + (leg.front ? 0.1 : -0.08) * reach;
      leg.knee.rotation.x = -fold * (leg.front ? 1.5 : 1.05) * (0.4 + 0.6 * effort) * reach;
    }
    // The body sinks while hooves carry it and floats when they are all off the ground; it
    // rocks forward as the front legs land and back as the hind legs push off.
    const carried = Math.min(1, (frontLoad + hindLoad) / 1.2);
    let lift = reach * (0.015 + 0.06 * effort) * (1 - carried) - 0.025 * reach * carried;
    let pitch = reach * (0.05 + 0.07 * gait) * (hindLoad - frontLoad);
    let neck = -0.32 * effort - 0.12 * reach * (frontLoad - hindLoad) * (0.4 + 0.6 * gait);
    let nod = 0.1 * reach * (frontLoad - hindLoad) - 0.05 * effort;
    let roll = 0;
    let shake = 0;
    let earBack = -0.15 + 0.55 * effort;
    let earDroop = 0;
    let carriage = 0.5 + 0.55 * effort;
    let flap = moving ? Math.sin(Math.PI * 2 * (this.stride - 0.1)) * (0.3 + 0.25 * gait) : 0;
    let spread = moving ? 0.35 : 0.1;
    // A right answer: gather, then stretch out low and long with the ears pinned back.
    lift += -0.06 * crouch + 0.05 * stretch;
    pitch += -0.05 * crouch + 0.08 * stretch;
    neck += -0.25 * stretch;
    earBack += 0.5 * stretch;
    carriage += 0.5 * stretch;
    flap += 0.7 * stretch * Math.sin(surge * 18);
    spread += 0.5 * stretch;
    const seed = this.root.position.x;
    if (waiting) {
      // At the line: one front hoof paws the ground and the head tosses, ears pricked forward.
      const paw = calm ? 0 : Math.max(0, Math.sin(now * 3 + seed));
      this.legs[0].hip.rotation.x = paw * 0.5;
      this.legs[0].knee.rotation.x = -paw * 1.1;
      neck = calm ? 0 : Math.sin(now * 2 + seed) * 0.1;
      nod = calm ? 0 : Math.sin(now * 2.6 + seed) * 0.14;
      earBack = calm ? -0.15 : -0.15 + Math.max(0, Math.sin(now * 1.7 + seed * 2)) * 0.5;
    }
    const trip = now - this.tripAt;
    const tripping = keyed(trip, TRIP.weight);
    if (tripping > 0) {
      const kneel = keyed(trip, TRIP.kneel);
      const kick = keyed(trip, TRIP.kick);
      pitch = lerp(pitch, keyed(trip, TRIP.pitch), tripping);
      lift = lerp(lift, keyed(trip, TRIP.lift), tripping);
      neck = lerp(neck, keyed(trip, TRIP.neck), tripping);
      nod = lerp(nod, keyed(trip, TRIP.nod), tripping);
      roll = keyed(trip, TRIP.roll) * tripping;
      shake = keyed(trip, TRIP.shake) * Math.sin(trip * 30) * (calm ? 0.05 : 0.16);
      earBack = lerp(earBack, 0.4, tripping);
      earDroop = tripping;
      carriage = lerp(carriage, 0.15, tripping);
      spread = lerp(spread, 1.1, tripping);
      flap = lerp(flap, Math.sin(trip * 22) * 0.25, tripping);
      for (const leg of this.legs) {
        // The front legs buckle under; the hind legs kick up behind as the rump tips over.
        const hip = leg.front ? 0.75 : -0.35 * kick + 0.3 * kneel;
        const knee = leg.front ? -1.7 : -0.4 * kick;
        const weight = leg.front ? kneel : Math.max(kneel, kick);
        leg.hip.rotation.x = lerp(leg.hip.rotation.x, hip, weight * tripping);
        leg.knee.rotation.x = lerp(leg.knee.rotation.x, knee, weight * tripping);
      }
    }
    if (cheering) {
      const beat = now * 4.5 + seed * 1.3;
      const hop = calm ? 0 : Math.abs(Math.sin(beat));
      const paw = calm ? 0 : Math.max(0, Math.sin(beat * 0.5));
      lift = hop * 0.07;
      pitch = 0.03;
      neck = 0.08;
      nod = calm ? 0.05 : Math.sin(beat) * 0.24;
      earBack = -0.1;
      carriage = 0.8;
      this.legs[1].hip.rotation.x = paw * 0.45;
      this.legs[1].knee.rotation.x = -paw * 1;
    }
    let squash = crouch * 0.05;
    this.reared = false;
    if (celebrating) {
      if (!this.wasRearing) this.rearAt = now;
      // Calm keeps one rear, then stands; otherwise the winner rears again and again.
      const age = now - this.rearAt;
      const time = calm ? Math.min(age, REAR_SECONDS) : age % REAR_SECONDS;
      const before = calm ? Math.min(age - dt, REAR_SECONDS) : (age - dt) % REAR_SECONDS;
      this.reared = before < REAR_TOP && time >= REAR_TOP;
      const paw = keyed(time, REAR.paw);
      pitch = keyed(time, REAR.pitch);
      lift = keyed(time, REAR.lift);
      neck = keyed(time, REAR.neck);
      nod = 0.2 * paw + (calm ? 0 : Math.sin(now * 6) * 0.15 * paw);
      squash = keyed(time, REAR.squash) * 0.06;
      earBack = -0.1;
      carriage = 0.9 + 0.5 * paw;
      spread = 0.6 + 0.6 * paw;
      flap = Math.sin(now * 9) * 0.45 * paw;
      for (const leg of this.legs)
        if (leg.front) {
          const kick = Math.sin(now * 9 + (leg.side < 0 ? 0 : 1.6));
          leg.hip.rotation.x = lerp(0.1, 0.7 + kick * 0.3, paw);
          leg.knee.rotation.x = lerp(0, -1.3 + kick * 0.4, paw);
        } else {
          leg.hip.rotation.x = -pitch * 0.9;
          leg.knee.rotation.x = 0;
        }
    }
    this.wasRearing = celebrating;
    this.pitch = approach(this.pitch, pitch, tripping > 0 || celebrating ? 16 : 12, dt);
    this.lift = approach(this.lift, lift, 18, dt);
    this.frame.rotation.x = this.pitch;
    this.frame.rotation.z = roll;
    const float = this.ghost ? 0.15 + (calm ? 0 : Math.sin(now * 3) * 0.05) : 0;
    this.frame.position.y = HIPS.y + this.lift + float;
    // Squash on a gather or a landing, stretch long on a burst of speed.
    this.frame.scale.set(1 + squash * 0.5, 1 - squash - stretch * 0.04, 1 + stretch * 0.07);
    // The head follows the neck a beat late, so a nod rolls down the neck like a real one.
    this.neck.rotation.x = approach(this.neck.rotation.x, neck, 11, dt);
    this.head.rotation.x = approach(this.head.rotation.x, nod, 8, dt);
    this.head.rotation.z = shake;
    for (const ear of this.ears) {
      ear.rotation.x = approach(ear.rotation.x, earBack, 10, dt);
      const side = ear.position.x > 0 ? 1 : -1;
      ear.rotation.z = approach(ear.rotation.z, side * -0.28 - side * earDroop * 0.9, 8, dt);
    }
    for (const wing of this.wings) {
      const idle = moving || calm ? 0 : Math.sin(now * 2) * 0.07;
      const lift = pose.wingLift ?? 0;
      wing.rotation.z = approach(wing.rotation.z, spread + flap + idle + lift, 14, dt);
    }
    // The tail is carried higher the harder the pony runs, and clamped down in a stumble.
    this.tail.rest[0].set(0, -Math.cos(carriage), Math.sin(carriage));
    this.tail.rest[1].set(0, -Math.cos(carriage * 0.6), Math.sin(carriage * 0.6));
    if (hair) this.moveHair(dt, pose.air ?? 0);
  }
  /** Steps the hair after the body has moved, so every lock lags behind what the pony did. */
  private moveHair(dt: number, air: number) {
    this.root.updateMatrixWorld(true);
    if (this.fresh) {
      this.fresh = false;
      this.pushing = false;
      this.tail.reset();
      for (const lock of this.locks) lock.reset();
    }
    if (this.pushing) {
      this.pushing = false;
      const strength = this.push.length();
      this.push.transformDirection(this.root.matrixWorld).multiplyScalar(strength);
      this.tail.kick(this.push);
      for (const lock of this.locks) lock.kick(this.push);
    }
    // Air from ahead blows back along the pony, whichever way it faces.
    this.wind.set(0, 0, air).transformDirection(this.root.matrixWorld).multiplyScalar(air);
    this.tail.step(dt, this.wind);
    for (const lock of this.locks) lock.step(dt, this.wind);
    this.drawHair();
  }
  /** Moves the meshes that show the hair onto the chains. */
  private drawHair() {
    this.tail.pose(0, this.dock, false);
    this.hair.update(this.root);
    this.across.setFromMatrixColumn(this.body.matrixWorld, 0).normalize();
    for (const strand of this.strands) strand.update(this.across);
  }
  /** A standing pose, so a pony that has not been animated yet still looks right. */
  private settle() {
    this.update(
      {
        now: 0,
        dt: 1,
        speed: 0,
        moving: false,
        waiting: false,
        celebrating: false,
        cheering: false,
        calm: true,
      },
      false,
    );
    this.root.updateMatrixWorld(true);
    this.tail.reset();
    for (const lock of this.locks) lock.reset();
    this.drawHair();
    this.fresh = true;
  }
  private buildHead(look: Look, coat: Material, shade: Material, ink: Material, mark: Material) {
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
      // Each ear turns from its base, so it can prick forward, pin back or droop.
      const ear = new Group();
      const cone = new Mesh(EAR, coat);
      cone.scale.z = 0.6;
      ear.add(cone);
      ear.position.set(side * 0.075, 0.075, 0);
      ear.rotation.set(-0.2, 0, side * -0.28);
      head.add(ear);
      this.ears.push(ear);
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
      const chain = new HairChain(
        head,
        new Vector3(side * 0.05, 0.13, -0.05),
        [hang(0.95, side * 0.25)],
        { length: 0.17, stiffness: [70], drag: 2.4 },
      );
      this.locks.push(chain);
      this.hair.add(index, chain, 0, new Vector3(0.045, 0.1, 0.035));
    }
  }
  /**
   * Locks along the crest of the neck, falling to both sides. Each lock is two lengths of hair,
   * so it bends as it swings, and longer toward the withers like a real mane.
   */
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
    const locks = 19;
    for (let index = 0; index < locks; index++) {
      // From just behind the ears down to the withers.
      const share = index / (locks - 1);
      const along = 4.5 - share * 3.9;
      const from = crest[Math.floor(along)];
      const to = crest[Math.min(crest.length - 1, Math.floor(along) + 1)];
      const point = from.clone().lerp(to, along % 1);
      ridge.push({ y: point.y - 0.012, z: point.z - 0.008, rx: 0.05, ry: 0.045 });
      const side = index % 2 ? 1 : -1;
      const length = 0.15 + share * 0.09;
      const chain = new HairChain(
        this.neck,
        point,
        [hang(-0.35, side * 0.8), hang(-0.15, side * 0.45)],
        {
          length,
          stiffness: [200, 60],
          drag: 1.2,
          side,
          clearance: [0.09 + share * 0.12, 0.1 + share * 0.15],
        },
      );
      this.locks.push(chain);
      const color = index % hair.length;
      this.hair.add(color, chain, 0, new Vector3(0.042, length * 0.62, 0.068));
      this.hair.add(color, chain, 1, new Vector3(0.034, length * 0.6, 0.055));
    }
    this.neck.add(new Mesh(loft(ridge, 8), hair[0]));
  }
  /**
   * A tail of nine lengths, drawn as three strands, carried up from the dock and falling in a
   * long, full sweep. It is simulated, so it streams, swings and whips with the pony.
   */
  private buildTail(body: Group): HairChain {
    const lengths = 9;
    const root = new Vector3(0, 1.36, 0.76);
    this.dock.position.copy(root);
    body.add(this.dock);
    const chain = new HairChain(
      body,
      root,
      Array.from({ length: lengths }, (_, index) => hang(Math.min(0, -0.5 + index * 0.18), 0)),
      { length: 0.12, stiffness: [240, 90, 36, 16, 9, 6, 4, 3, 2], drag: 2.1 },
    );
    return chain;
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
  // A trot lands diagonal pairs together. A gallop lands four beats: left hind, right hind,
  // left fore, then the leading right fore, and the pony flies with all four hooves tucked.
  const trot = front === side < 0 ? 0 : 0.5;
  const gallop = front ? (side < 0 ? 0.3 : 0.4) : side < 0 ? 0 : 0.1;
  return { hip, knee, front, side, trot, gallop, last: 0 };
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
